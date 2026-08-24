import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Integer, Text, Boolean, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="Untitled Notes")
    language = Column(String, nullable=False, default="en")
    status = Column(String, nullable=False, default="pending")
    # pending | processing | ready | failed
    progress_stage = Column(String, nullable=True)  # human-readable current step
    error_message = Column(Text, nullable=True)
    page_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    owner = relationship("User", back_populates="documents")
    pages = relationship(
        "Page", back_populates="document",
        cascade="all, delete-orphan", order_by="Page.page_number"
    )


class Page(Base):
    __tablename__ = "pages"

    id = Column(String, primary_key=True, default=gen_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)

    original_image_path = Column(String, nullable=False)
    preprocessed_image_path = Column(String, nullable=True)

    status = Column(String, nullable=False, default="pending")
    # pending | preprocessing | ocr | cleanup | ready | failed
    error_message = Column(Text, nullable=True)

    raw_ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Integer, nullable=True)  # 0-100, when available

    cleaned_markdown = Column(Text, nullable=True)   # Mistral-cleaned + structured content
    equations = Column(JSON, nullable=True)          # [{raw, latex}]
    tables = Column(JSON, nullable=True)              # [{rows: [[...]]}]

    edited_markdown = Column(Text, nullable=True)     # user's edited version, if any

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    document = relationship("Document", back_populates="pages")

    @property
    def content(self) -> str:
        """Returns the user-edited content if present, otherwise the AI-cleaned version."""
        return self.edited_markdown if self.edited_markdown is not None else (self.cleaned_markdown or "")
