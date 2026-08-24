# Handwriting to Digital Notes Converter

AI-based web app that converts handwritten notes (images or PDFs) into clean,
structured, editable digital notes using Mistral AI for both OCR and cleanup.

## Status

This is a working core build covering:
- Auth (register/login, JWT)
- Multi-page upload (images + PDF splitting), drag-and-drop, page thumbnails
- Real image preprocessing (OpenCV: denoise, contrast, deskew)
- Real Mistral AI OCR + cleanup/structuring pipeline (no mocked responses)
- Side-by-side original vs. digital notes view, editable notes
- Dashboard with stats, search, rename, delete
- Ask My Notes, Explain This Topic, Summarize, Question Generation (all real Mistral calls)
- Export to PDF / DOCX / Markdown / TXT
- Dark/light mode, responsive layout, live processing status

Not yet built (next phases): dedicated equation/table editing UI (the data is
generated and stored, just needs a richer editor), full-text search across
documents, and a couple of polish passes.

## Running it

### Backend

**Windows (PowerShell):**
```powershell
cd backend
# Create and activate virtual environment (if not already done)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies (already installed in the existing venv)
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux:**
```bash
cd backend
.\venv\Scripts\Activate.ps1
# python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173

## Important

- Get a Mistral API key at https://console.mistral.ai — the app will run and
  let you upload documents without one, but OCR/cleanup/AI features will
  return a clear error until it's set in `backend/.env`.
- SQLite is used by default for local dev (`backend/notes.db`, created
  automatically). Swap `DATABASE_URL` in `.env` for a Postgres URL in production.
