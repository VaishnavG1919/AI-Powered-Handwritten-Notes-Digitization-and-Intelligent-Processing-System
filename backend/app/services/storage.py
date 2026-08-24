import os
import uuid
from pathlib import Path

from app.config import settings

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


def new_document_dir(document_id: str) -> Path:
    d = Path(settings.upload_dir) / document_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_upload_bytes(document_id: str, filename: str, data: bytes) -> str:
    """Saves raw bytes to disk and returns the relative path (for DB storage)."""
    ext = os.path.splitext(filename)[1] or ".bin"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    doc_dir = new_document_dir(document_id)
    path = doc_dir / safe_name
    with open(path, "wb") as f:
        f.write(data)
    return str(path)


def to_url(path: str) -> str:
    """Converts a filesystem path under upload_dir into a servable /files URL."""
    rel = os.path.relpath(path, settings.upload_dir).replace(os.sep, "/")
    return f"/files/{rel}"
