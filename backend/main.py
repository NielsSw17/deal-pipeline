from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os, shutil, uuid

import models
from database import engine, get_db, Base

# ── Create / migrate database ─────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)


def _migrate():
    """Add any columns/tables that may be missing in existing databases."""
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        existing = {col["name"] for col in inspect(engine).get_columns("deals")}
        new_cols = [
            ("domain",          "TEXT"),
            ("theme",           "TEXT"),
            ("revenue",         "REAL"),
            ("ebitda",          "REAL"),
            ("ownership_pct",   "REAL"),
            ("geography",       "TEXT"),
            ("deal_source",     "TEXT"),
            ("co_investor",     "TEXT"),
            ("thesis",          "TEXT"),
            ("ic_date",         "TEXT"),
            ("ic_memo",         "TEXT"),
            ("term_sheet",      "TEXT"),
            ("close_date",      "TEXT"),
            ("next_action",     "TEXT"),
            ("next_action_due", "TEXT"),
        ]
        for col, typedef in new_cols:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE deals ADD COLUMN {col} {typedef}"))

        # deal_notes table (created by create_all above, but safety net)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deal_notes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                text       TEXT NOT NULL,
                author     TEXT NOT NULL,
                is_pinned  BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()


_migrate()

# ── Upload directory ──────────────────────────────────────────────────────────

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Deal Pipeline CRM", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STAGES = ["Sourcing", "Screening", "IC", "Due Diligence", "Signed", "Closed", "Lost"]

# ── Schemas ───────────────────────────────────────────────────────────────────

class DealBase(BaseModel):
    company_name:   str
    stage:          str          = "Sourcing"
    sector:         Optional[str]   = None
    ev:             Optional[float] = None
    country:        Optional[str]   = None
    owner:          Optional[str]   = None
    notes:          Optional[str]   = None
    domain:         Optional[str]   = None
    theme:          Optional[str]   = None
    revenue:        Optional[float] = None
    ebitda:         Optional[float] = None
    ownership_pct:  Optional[float] = None
    geography:      Optional[str]   = None
    deal_source:    Optional[str]   = None
    co_investor:    Optional[str]   = None
    thesis:         Optional[str]   = None
    ic_date:        Optional[str]   = None
    ic_memo:        Optional[str]   = None
    term_sheet:     Optional[str]   = None
    close_date:     Optional[str]   = None
    next_action:    Optional[str]   = None
    next_action_due:Optional[str]   = None


class DealCreate(DealBase):
    position: Optional[int] = 0


class DealUpdate(BaseModel):
    company_name:   Optional[str]   = None
    stage:          Optional[str]   = None
    sector:         Optional[str]   = None
    ev:             Optional[float] = None
    country:        Optional[str]   = None
    owner:          Optional[str]   = None
    notes:          Optional[str]   = None
    position:       Optional[int]   = None
    domain:         Optional[str]   = None
    theme:          Optional[str]   = None
    revenue:        Optional[float] = None
    ebitda:         Optional[float] = None
    ownership_pct:  Optional[float] = None
    geography:      Optional[str]   = None
    deal_source:    Optional[str]   = None
    co_investor:    Optional[str]   = None
    thesis:         Optional[str]   = None
    ic_date:        Optional[str]   = None
    ic_memo:        Optional[str]   = None
    term_sheet:     Optional[str]   = None
    close_date:     Optional[str]   = None
    next_action:    Optional[str]   = None
    next_action_due:Optional[str]   = None


class DealResponse(DealBase):
    id:       int
    position: int = 0
    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id:       int
    position: int
    stage:    str


class NoteCreate(BaseModel):
    text:      str
    author:    str
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    text:      Optional[str]  = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id:        int
    deal_id:   int
    text:      str
    author:    str
    is_pinned: bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Deal CRUD ─────────────────────────────────────────────────────────────────

@app.get("/api/deals", response_model=List[DealResponse])
def get_deals(db: Session = Depends(get_db)):
    return (
        db.query(models.Deal)
        .order_by(models.Deal.stage, models.Deal.position, models.Deal.id)
        .all()
    )


@app.post("/api/deals", response_model=DealResponse, status_code=201)
def create_deal(deal: DealCreate, db: Session = Depends(get_db)):
    stage_count = db.query(models.Deal).filter(models.Deal.stage == deal.stage).count()
    db_deal = models.Deal(**deal.model_dump())
    db_deal.position = stage_count
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal


@app.put("/api/deals/{deal_id}", response_model=DealResponse)
def update_deal(deal_id: int, deal: DealUpdate, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    updates = deal.model_dump(exclude_unset=True)
    if "stage" in updates and updates["stage"] != db_deal.stage and "position" not in updates:
        stage_count = db.query(models.Deal).filter(models.Deal.stage == updates["stage"]).count()
        updates["position"] = stage_count
    for key, value in updates.items():
        setattr(db_deal, key, value)
    db.commit()
    db.refresh(db_deal)
    return db_deal


@app.delete("/api/deals/{deal_id}")
def delete_deal(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    db.delete(db_deal)
    db.commit()
    return {"ok": True}


@app.post("/api/deals/reorder")
def reorder_deals(items: List[ReorderItem], db: Session = Depends(get_db)):
    for item in items:
        db_deal = db.query(models.Deal).filter(models.Deal.id == item.id).first()
        if db_deal:
            db_deal.position = item.position
            db_deal.stage = item.stage
    db.commit()
    return {"ok": True}


# ── Notes CRUD ────────────────────────────────────────────────────────────────

@app.get("/api/deals/{deal_id}/notes", response_model=List[NoteResponse])
def get_notes(deal_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Note)
        .filter(models.Note.deal_id == deal_id)
        .order_by(models.Note.created_at)
        .all()
    )


@app.post("/api/deals/{deal_id}/notes", response_model=NoteResponse, status_code=201)
def create_note(deal_id: int, note: NoteCreate, db: Session = Depends(get_db)):
    if not db.query(models.Deal).filter(models.Deal.id == deal_id).first():
        raise HTTPException(status_code=404, detail="Deal not found")
    if note.is_pinned:
        db.query(models.Note).filter(
            models.Note.deal_id == deal_id, models.Note.is_pinned == True
        ).update({"is_pinned": False})
    db_note = models.Note(deal_id=deal_id, **note.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


@app.put("/api/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, note: NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.is_pinned:
        db.query(models.Note).filter(
            models.Note.deal_id == db_note.deal_id,
            models.Note.is_pinned == True,
            models.Note.id != note_id,
        ).update({"is_pinned": False})
    for key, value in note.model_dump(exclude_unset=True).items():
        setattr(db_note, key, value)
    db.commit()
    db.refresh(db_note)
    return db_note


@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(db_note)
    db.commit()


# ── File upload ───────────────────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".png", ".jpg", ".jpeg"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed")
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"filename": filename, "original_name": file.filename}


@app.get("/api/uploads/{filename}")
def serve_upload(filename: str):
    filename = os.path.basename(filename)   # prevent path traversal
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Serve React SPA ───────────────────────────────────────────────────────────

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
