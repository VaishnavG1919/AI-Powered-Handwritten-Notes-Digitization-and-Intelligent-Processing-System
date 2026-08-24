from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------

class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Pages ----------

class PageOut(BaseModel):
    id: str
    page_number: int
    status: str
    error_message: Optional[str] = None
    original_image_url: Optional[str] = None
    raw_ocr_text: Optional[str] = None
    ocr_confidence: Optional[int] = None
    content: str = ""
    equations: Optional[List[Any]] = None
    tables: Optional[List[Any]] = None

    class Config:
        from_attributes = True


class PageUpdate(BaseModel):
    edited_markdown: str


# ---------- Documents ----------

class DocumentOut(BaseModel):
    id: str
    title: str
    language: str
    status: str
    progress_stage: Optional[str] = None
    error_message: Optional[str] = None
    page_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentDetailOut(DocumentOut):
    pages: List[PageOut] = []


class DocumentRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


# ---------- AI actions ----------

class ExplainRequest(BaseModel):
    text: str
    mode: str = "simple"  # simple | detailed | exam | example | beginner


class AskRequest(BaseModel):
    question: str


class SummarizeRequest(BaseModel):
    style: str = "short"  # short | detailed | exam_revision


class QuestionGenRequest(BaseModel):
    question_types: List[str] = ["mcq"]
    count: int = 5
    difficulty: str = "medium"  # easy | medium | hard


class EquationExplainRequest(BaseModel):
    latex: str
    raw: Optional[str] = None
