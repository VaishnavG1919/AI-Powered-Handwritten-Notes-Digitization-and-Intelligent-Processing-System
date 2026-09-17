"""
Orchestrates the per-page processing pipeline and updates the database
as each stage completes, so the frontend can poll for live progress.
"""
import logging
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Document, Page
from app.services import preprocessing
from app.services.mistral_client import ocr_image, clean_and_structure, MistralError

logger = logging.getLogger("pipeline")


def _set_doc_stage(db: Session, document: Document, stage: str):
    document.progress_stage = stage
    db.commit()


async def process_document(
    document_id: str,
    page_ids: Optional[list[str]] = None,
):
    """
    Runs the processing pipeline for a document.

    If page_ids is provided, only those pages are processed.
    This is used when adding new pages to an existing document.

    If page_ids is None, all pages are processed.
    This preserves the original behavior for a new document upload.

    Uses its own DB session since it runs outside the request lifecycle.
    """
    db = SessionLocal()

    try:
        document = (
            db.query(Document)
            .filter(Document.id == document_id)
            .first()
        )

        if not document:
            return

        document.status = "processing"
        _set_doc_stage(db, document, "Starting")

        # ---------------------------------------------------------
        # Select pages to process
        # ---------------------------------------------------------
        if page_ids:
            pages = (
                db.query(Page)
                .filter(
                    Page.document_id == document_id,
                    Page.id.in_(page_ids),
                )
                .order_by(Page.page_number)
                .all()
            )
        else:
            # Normal behavior for a brand-new document
            pages = (
                db.query(Page)
                .filter(Page.document_id == document_id)
                .order_by(Page.page_number)
                .all()
            )

        any_failed = False

        # ---------------------------------------------------------
        # Process selected pages
        # ---------------------------------------------------------
        for page in pages:
            try:
                # 1. Preprocess
                page.status = "preprocessing"

                _set_doc_stage(
                    db,
                    document,
                    f"Preprocessing page {page.page_number}",
                )

                db.commit()

                base, ext = os.path.splitext(page.original_image_path)
                out_path = f"{base}_processed.png"

                preprocessing.preprocess_image(
                    page.original_image_path,
                    out_path,
                )

                page.preprocessed_image_path = out_path
                db.commit()

                # 2. OCR (Mistral)
                page.status = "ocr"

                _set_doc_stage(
                    db,
                    document,
                    f"Extracting handwriting on page {page.page_number}",
                )

                db.commit()

                ocr_result = await ocr_image(out_path)

                page.raw_ocr_text = ocr_result["markdown"]
                page.ocr_confidence = ocr_result["confidence"]

                db.commit()

                # 3. Cleanup + structuring (Mistral)
                page.status = "cleanup"

                _set_doc_stage(
                    db,
                    document,
                    f"Cleaning up page {page.page_number} with Mistral AI",
                )

                db.commit()

                cleaned = await clean_and_structure(
                    page.raw_ocr_text or "",
                    document.language,
                )

                page.cleaned_markdown = cleaned["markdown"]
                page.equations = cleaned["equations"]
                page.tables = cleaned["tables"]

                page.status = "ready"
                db.commit()

            except MistralError as e:
                page.status = "failed"
                page.error_message = str(e)

                db.commit()

                any_failed = True

                logger.warning(
                    "Mistral error on page %s: %s",
                    page.id,
                    e,
                )

            except Exception as e:
                page.status = "failed"
                page.error_message = f"Processing failed: {e}"

                db.commit()

                any_failed = True

                logger.exception(
                    "Unexpected error processing page %s",
                    page.id,
                )

        # ---------------------------------------------------------
        # Check the status of ALL pages in the document
        # ---------------------------------------------------------
        all_pages = (
            db.query(Page)
            .filter(Page.document_id == document_id)
            .order_by(Page.page_number)
            .all()
        )

        all_failed = (
            bool(all_pages)
            and all(page.status == "failed" for page in all_pages)
        )

        if all_failed:
            document.status = "failed"
            document.progress_stage = "Some pages failed"
        else:
            # Existing pages + newly added pages can coexist.
            # A failed new page does not make the whole document unusable.
            document.status = "ready"

            if any_failed:
                document.progress_stage = (
                    "Completed with some page errors"
                )
            else:
                document.progress_stage = "Finalizing digital notes"

        db.commit()

    finally:
        db.close()