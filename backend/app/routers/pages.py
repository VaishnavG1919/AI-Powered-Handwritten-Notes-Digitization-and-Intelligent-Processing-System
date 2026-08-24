from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Page, Document
from app.schemas import PageUpdate, PageOut
from app.auth import get_current_user
from app.services.storage import to_url

router = APIRouter(prefix="/api/pages", tags=["pages"])


def _owned_page(page_id: str, db: Session, current_user: User) -> Page:
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found.")
    document = db.query(Document).filter(Document.id == page.document_id).first()
    if not document or document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this page.")
    return page


@router.patch("/{page_id}", response_model=PageOut)
def update_page(
    page_id: str, payload: PageUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    page = _owned_page(page_id, db, current_user)
    page.edited_markdown = payload.edited_markdown
    db.commit()
    db.refresh(page)
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
