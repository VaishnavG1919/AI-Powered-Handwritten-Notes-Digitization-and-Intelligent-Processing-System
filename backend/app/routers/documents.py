import io
import os
from typing import List, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import User, Document, Page
from app.schemas import DocumentOut, DocumentDetailOut, DocumentRename, PageOut
from app.auth import get_current_user
from app.services.storage import save_upload_bytes, to_url
from app.services.pipeline import process_document
from app.services.exporter import export_to_pdf, export_to_docx, export_to_txt, export_to_md
from app.config import settings

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
ALLOWED_PDF_TYPE = "application/pdf"


def _page_out(page: Page) -> PageOut:
    return PageOut(
        id=page.id,
        page_number=page.page_number,
        status=page.status,
        error_message=page.error_message,
        original_image_url=to_url(page.original_image_path) if page.original_image_path else None,
        raw_ocr_text=page.raw_ocr_text,
        ocr_confidence=page.ocr_confidence,
        content=page.content,
        equations=page.equations,
        tables=page.tables,
    )


@router.post("", response_model=DocumentDetailOut, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    title: str = Form("Untitled Notes"),
    language: str = Form("en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    max_bytes = settings.max_upload_mb * 1024 * 1024

    document = Document(owner_id=current_user.id, title=title.strip() or "Untitled Notes", language=language)
    db.add(document)
    db.commit()
    db.refresh(document)

    page_number = 1
    try:
        for upload in files:
            data = await upload.read()
            if len(data) == 0:
                continue
            if len(data) > max_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{upload.filename}' exceeds the {settings.max_upload_mb}MB upload limit.",
                )

            content_type = upload.content_type or ""

            if content_type == ALLOWED_PDF_TYPE or (upload.filename or "").lower().endswith(".pdf"):
                try:
                    pdf = fitz.open(stream=data, filetype="pdf")
                except Exception:
                    raise HTTPException(status_code=400, detail=f"'{upload.filename}' is not a valid PDF file.")

                if pdf.page_count == 0:
                    raise HTTPException(status_code=400, detail=f"'{upload.filename}' has no pages.")

                for pdf_page_index in range(pdf.page_count):
                    pix = pdf[pdf_page_index].get_pixmap(dpi=200)
                    img_bytes = pix.tobytes("png")
                    path = save_upload_bytes(document.id, f"page_{page_number}.png", img_bytes)
                    db.add(Page(document_id=document.id, page_number=page_number, original_image_path=path))
                    page_number += 1

            elif content_type in ALLOWED_IMAGE_TYPES or (upload.filename or "").lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp", ".heic")
            ):
                path = save_upload_bytes(document.id, upload.filename or f"page_{page_number}", data)
                db.add(Page(document_id=document.id, page_number=page_number, original_image_path=path))
                page_number += 1
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{upload.filename}' is an unsupported file type. Upload JPG, PNG, WEBP, or PDF.",
                )

        if page_number == 1:
            raise HTTPException(status_code=400, detail="No valid pages were found in the uploaded files.")

        document.page_count = page_number - 1
        db.commit()
        db.refresh(document)

    except HTTPException:
        db.delete(document)
        db.commit()
        raise
    except Exception as e:
        db.delete(document)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    background_tasks.add_task(process_document, document.id)

    pages = db.query(Page).filter(Page.document_id == document.id).order_by(Page.page_number).all()
    return DocumentDetailOut(
        **DocumentOut.model_validate(document).model_dump(),
        pages=[_page_out(p) for p in pages],
    )


@router.get("", response_model=List[DocumentOut])
def list_documents(
    q: Optional[str] = None,
    language: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document).filter(Document.owner_id == current_user.id)
    if q:
        query = query.filter(Document.title.ilike(f"%{q}%"))
    if language:
        query = query.filter(Document.language == language)
    if status_filter:
        query = query.filter(Document.status == status_filter)
    docs = query.order_by(Document.updated_at.desc()).all()
    return docs


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.owner_id == current_user.id).all()
    total_pages = sum(d.page_count for d in docs)
    languages = sorted({d.language for d in docs})
    recent = sorted(docs, key=lambda d: d.updated_at, reverse=True)[:5]
    return {
        "total_documents": len(docs),
        "total_pages": total_pages,
        "languages_used": languages,
        "recent_documents": [DocumentOut.model_validate(d) for d in recent],
    }


@router.get("/{document_id}", response_model=DocumentDetailOut)
def get_document(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    document = _owned_document(document_id, db, current_user)
    pages = db.query(Page).filter(Page.document_id == document.id).order_by(Page.page_number).all()
    return DocumentDetailOut(
        **DocumentOut.model_validate(document).model_dump(),
        pages=[_page_out(p) for p in pages],
    )


@router.patch("/{document_id}", response_model=DocumentOut)
def rename_document(
    document_id: str, payload: DocumentRename, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    document = _owned_document(document_id, db, current_user)
    document.title = payload.title.strip()
    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    document = _owned_document(document_id, db, current_user)
    db.delete(document)
    db.commit()
    return None


@router.get("/{document_id}/export")
def export_document(
    document_id: str,
    fmt: str = "md",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _owned_document(document_id, db, current_user)
    pages = db.query(Page).filter(Page.document_id == document.id).order_by(Page.page_number).all()
    pages_content = [(p.page_number, p.content or "") for p in pages if p.content]

    safe_title = "".join(c for c in document.title if c.isalnum() or c in (" ", "_", "-")).strip() or "notes"

    if fmt == "md":
        buf = export_to_md(document.title, pages_content)
        return StreamingResponse(
            buf,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.md"'},
        )
    elif fmt == "txt":
        buf = export_to_txt(document.title, pages_content)
        return StreamingResponse(
            buf,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.txt"'},
        )
    elif fmt == "docx":
        buf = export_to_docx(document.title, pages_content)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.docx"'},
        )
    elif fmt == "pdf":
        buf = export_to_pdf(document.title, pages_content)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported export format. Use md, txt, docx, or pdf.")


def _owned_document(document_id: str, db: Session, current_user: User) -> Document:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this document.")
    return document
