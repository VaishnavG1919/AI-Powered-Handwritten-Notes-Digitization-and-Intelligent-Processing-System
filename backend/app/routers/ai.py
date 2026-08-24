import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Document, Page
from app.schemas import ExplainRequest, AskRequest, SummarizeRequest, QuestionGenRequest, EquationExplainRequest
from app.auth import get_current_user
from app.services import mistral_client
from app.services.mistral_client import MistralError

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _owned_document(document_id: str, db: Session, current_user: User) -> Document:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this document.")
    return document


def _document_context(document: Document, db: Session) -> str:
    pages = db.query(Page).filter(Page.document_id == document.id).order_by(Page.page_number).all()
    return "\n\n".join(f"[Page {p.page_number}]\n{p.content}" for p in pages if p.content)


async def _guard(coro):
    try:
        return await coro
    except MistralError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/documents/{document_id}/explain")
async def explain(document_id: str, payload: ExplainRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owned_document(document_id, db, current_user)
    result = await _guard(mistral_client.explain_topic(payload.text, payload.mode))
    return {"explanation": result}


@router.post("/documents/{document_id}/ask")
async def ask(document_id: str, payload: AskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    document = _owned_document(document_id, db, current_user)
    context = _document_context(document, db)
    if not context.strip():
        raise HTTPException(status_code=400, detail="This document has no processed content yet.")
    result = await _guard(mistral_client.ask_notes(payload.question, context))
    return {"answer": result}


@router.post("/documents/{document_id}/summarize")
async def summarize(document_id: str, payload: SummarizeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    document = _owned_document(document_id, db, current_user)
    context = _document_context(document, db)
    if not context.strip():
        raise HTTPException(status_code=400, detail="This document has no processed content yet.")
    result = await _guard(mistral_client.summarize(context, payload.style))
    return {"summary": result}


@router.post("/documents/{document_id}/questions")
async def generate_questions(document_id: str, payload: QuestionGenRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    document = _owned_document(document_id, db, current_user)
    context = _document_context(document, db)
    if not context.strip():
        raise HTTPException(status_code=400, detail="This document has no processed content yet.")
    raw = await _guard(
        mistral_client.generate_questions(context, payload.question_types, payload.count, payload.difficulty)
    )
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Mistral returned an unexpected format for questions.")
    return parsed


@router.post("/equations/explain")
async def explain_equation(payload: EquationExplainRequest, current_user: User = Depends(get_current_user)):
    result = await _guard(mistral_client.explain_equation(payload.latex, payload.raw))
    return {"explanation": result}
