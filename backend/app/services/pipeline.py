"""
Orchestrates the per-page processing pipeline and updates the database
as each stage completes, so the frontend can poll for live progress.
"""
import logging
import os

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Document, Page
from app.services import preprocessing
from app.services.mistral_client import ocr_image, clean_and_structure, MistralError

logger = logging.getLogger("pipeline")


def _set_doc_stage(db: Session, document: Document, stage: str):
    document.progress_stage = stage
    db.commit()


async def process_document(document_id: str):
    """
    Runs the full pipeline for every page of a document, in order.
    Intended to be scheduled as a FastAPI BackgroundTask right after upload.
    Uses its own DB session since it runs outside the request lifecycle.
    """
    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return

        document.status = "processing"
        _set_doc_stage(db, document, "Starting")

        pages = (
            db.query(Page)
            .filter(Page.document_id == document_id)
            .order_by(Page.page_number)
            .all()
        )

        any_failed = False

        for page in pages:
            try:
                # 1. Preprocess
                page.status = "preprocessing"
                _set_doc_stage(db, document, f"Preprocessing page {page.page_number}")
                db.commit()

                base, ext = os.path.splitext(page.original_image_path)
                out_path = f"{base}_processed.png"
                preprocessing.preprocess_image(page.original_image_path, out_path)
                page.preprocessed_image_path = out_path
                db.commit()

                # 2. OCR (Mistral)
                page.status = "ocr"
                _set_doc_stage(db, document, f"Extracting handwriting on page {page.page_number}")
                db.commit()

                ocr_result = await ocr_image(out_path)
                page.raw_ocr_text = ocr_result["markdown"]
                page.ocr_confidence = ocr_result["confidence"]
                db.commit()

                # 3. Cleanup + structuring (Mistral)
                page.status = "cleanup"
                _set_doc_stage(db, document, f"Cleaning up page {page.page_number} with Mistral AI")
                db.commit()

                cleaned = await clean_and_structure(page.raw_ocr_text or "", document.language)
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
                logger.warning("Mistral error on page %s: %s", page.id, e)
            except Exception as e:
                page.status = "failed"
                page.error_message = f"Processing failed: {e}"
                db.commit()
                any_failed = True
                logger.exception("Unexpected error processing page %s", page.id)

        document.status = "failed" if any_failed and all(p.status == "failed" for p in pages) else "ready"
        if any_failed and document.status == "ready":
            document.status = "ready"  # partial success — pages carry their own failed state
        document.progress_stage = "Finalizing digital notes" if document.status == "ready" else "Some pages failed"
        db.commit()

    finally:
        db.close()
