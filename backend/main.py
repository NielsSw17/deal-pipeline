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
            ("lost_reason",     "TEXT"),
        ]
        for col, typedef in new_cols:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE deals ADD COLUMN {col} {typedef}"))

        # deal_notes
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

        # deal_documents
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deal_documents (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id       INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                filename      TEXT NOT NULL,
                original_name TEXT NOT NULL,
                category      TEXT NOT NULL DEFAULT 'Other',
                uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # deal_contacts
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deal_contacts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                role       TEXT,
                email      TEXT,
                phone      TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # contact_interactions
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS contact_interactions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL REFERENCES deal_contacts(id) ON DELETE CASCADE,
                deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                type       TEXT NOT NULL,
                date       TEXT NOT NULL,
                note       TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.commit()


_migrate()

# ── Upload directory ──────────────────────────────────────────────────────────

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Deal Pipeline CRM", version="2.1.0")

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
    lost_reason:    Optional[str]   = None


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
    lost_reason:    Optional[str]   = None


class DealResponse(DealBase):
    id:         int
    position:   int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
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


class DocumentResponse(BaseModel):
    id:            int
    deal_id:       int
    filename:      str
    original_name: str
    category:      str
    uploaded_at:   Optional[datetime] = None
    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    category: str


class ContactCreate(BaseModel):
    name:  str
    role:  Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ContactUpdate(BaseModel):
    name:  Optional[str] = None
    role:  Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class InteractionCreate(BaseModel):
    type: str
    date: str
    note: Optional[str] = None


class InteractionUpdate(BaseModel):
    type: Optional[str] = None
    date: Optional[str] = None
    note: Optional[str] = None


class InteractionResponse(BaseModel):
    id:         int
    contact_id: int
    deal_id:    int
    type:       str
    date:       str
    note:       Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class ContactResponse(BaseModel):
    id:           int
    deal_id:      int
    name:         str
    role:         Optional[str] = None
    email:        Optional[str] = None
    phone:        Optional[str] = None
    created_at:   Optional[datetime] = None
    interactions: List[InteractionResponse] = []
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


# ── Documents CRUD ────────────────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".png", ".jpg", ".jpeg"}

DOC_CATEGORIES = ["IC Memo", "Term Sheet", "NDA", "Financial Model", "Management Presentation", "Other"]


@app.get("/api/deals/{deal_id}/documents", response_model=List[DocumentResponse])
def get_documents(deal_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Document)
        .filter(models.Document.deal_id == deal_id)
        .order_by(models.Document.uploaded_at.desc())
        .all()
    )


@app.post("/api/deals/{deal_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    deal_id: int,
    category: str = "Other",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.query(models.Deal).filter(models.Deal.id == deal_id).first():
        raise HTTPException(status_code=404, detail="Deal not found")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed")
    if category not in DOC_CATEGORIES:
        category = "Other"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    doc = models.Document(
        deal_id=deal_id,
        filename=filename,
        original_name=file.filename,
        category=category,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@app.patch("/api/documents/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: int, update: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.category = update.category
    db.commit()
    db.refresh(doc)
    return doc


@app.delete("/api/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Remove file from disk
    path = os.path.join(UPLOAD_DIR, doc.filename)
    if os.path.exists(path):
        os.remove(path)
    db.delete(doc)
    db.commit()


# ── Contacts & Interactions CRUD ──────────────────────────────────────────────

@app.get("/api/deals/{deal_id}/contacts", response_model=List[ContactResponse])
def get_contacts(deal_id: int, db: Session = Depends(get_db)):
    contacts = (
        db.query(models.Contact)
        .filter(models.Contact.deal_id == deal_id)
        .order_by(models.Contact.created_at)
        .all()
    )
    result = []
    for c in contacts:
        interactions = (
            db.query(models.Interaction)
            .filter(models.Interaction.contact_id == c.id)
            .order_by(models.Interaction.date.desc())
            .all()
        )
        result.append(ContactResponse(
            id=c.id, deal_id=c.deal_id, name=c.name, role=c.role,
            email=c.email, phone=c.phone, created_at=c.created_at,
            interactions=[InteractionResponse.model_validate(i) for i in interactions],
        ))
    return result


@app.post("/api/deals/{deal_id}/contacts", response_model=ContactResponse, status_code=201)
def create_contact(deal_id: int, contact: ContactCreate, db: Session = Depends(get_db)):
    if not db.query(models.Deal).filter(models.Deal.id == deal_id).first():
        raise HTTPException(status_code=404, detail="Deal not found")
    db_contact = models.Contact(deal_id=deal_id, **contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return ContactResponse(
        id=db_contact.id, deal_id=db_contact.deal_id, name=db_contact.name,
        role=db_contact.role, email=db_contact.email, phone=db_contact.phone,
        created_at=db_contact.created_at, interactions=[],
    )


@app.put("/api/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(contact_id: int, contact: ContactUpdate, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, value in contact.model_dump(exclude_unset=True).items():
        setattr(db_contact, key, value)
    db.commit()
    db.refresh(db_contact)
    interactions = (
        db.query(models.Interaction)
        .filter(models.Interaction.contact_id == contact_id)
        .order_by(models.Interaction.date.desc())
        .all()
    )
    return ContactResponse(
        id=db_contact.id, deal_id=db_contact.deal_id, name=db_contact.name,
        role=db_contact.role, email=db_contact.email, phone=db_contact.phone,
        created_at=db_contact.created_at,
        interactions=[InteractionResponse.model_validate(i) for i in interactions],
    )


@app.delete("/api/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(db_contact)
    db.commit()


@app.post("/api/contacts/{contact_id}/interactions", response_model=InteractionResponse, status_code=201)
def create_interaction(contact_id: int, interaction: InteractionCreate, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db_int = models.Interaction(
        contact_id=contact_id,
        deal_id=db_contact.deal_id,
        **interaction.model_dump(),
    )
    db.add(db_int)
    db.commit()
    db.refresh(db_int)
    return db_int


@app.put("/api/interactions/{interaction_id}", response_model=InteractionResponse)
def update_interaction(interaction_id: int, update: InteractionUpdate, db: Session = Depends(get_db)):
    db_int = db.query(models.Interaction).filter(models.Interaction.id == interaction_id).first()
    if not db_int:
        raise HTTPException(status_code=404, detail="Interaction not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(db_int, key, value)
    db.commit()
    db.refresh(db_int)
    return db_int


@app.delete("/api/interactions/{interaction_id}", status_code=204)
def delete_interaction(interaction_id: int, db: Session = Depends(get_db)):
    db_int = db.query(models.Interaction).filter(models.Interaction.id == interaction_id).first()
    if not db_int:
        raise HTTPException(status_code=404, detail="Interaction not found")
    db.delete(db_int)
    db.commit()


# ── Generic file upload (stage gates) ────────────────────────────────────────

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
