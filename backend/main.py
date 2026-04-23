from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date as date_type
import os, shutil, uuid, io, json, smtplib, time
from collections import defaultdict
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import models
import auth
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
            # new
            ("owners",          "TEXT"),
            ("sourcing",        "TEXT"),
            ("lost_note",       "TEXT"),
            ("crit_thematic",   "BOOLEAN DEFAULT 0"),
            ("crit_technology", "BOOLEAN DEFAULT 0"),
            ("crit_commercial", "BOOLEAN DEFAULT 0"),
            ("crit_geography",  "BOOLEAN DEFAULT 0"),
            ("crit_majority",   "BOOLEAN DEFAULT 0"),
            ("crit_ticket",     "BOOLEAN DEFAULT 0"),
            ("ev_range",              "TEXT"),
            ("sectors",               "TEXT"),
            ("deal_type",             "TEXT"),
            ("last_contact_at",       "TEXT"),
            ("postpone_reason",       "TEXT"),
            ("postpone_notes",        "TEXT"),
            ("next_action_assignees", "TEXT"),
        ]
        for col, typedef in new_cols:
            col_name = col
            if col_name not in existing:
                conn.execute(text(f"ALTER TABLE deals ADD COLUMN {col} {typedef}"))

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

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deal_contacts (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id      INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                name         TEXT NOT NULL,
                role         TEXT,
                email        TEXT,
                phone        TEXT,
                linkedin_url TEXT,
                notes        TEXT,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        # Add new columns to deal_contacts if they don't exist (for existing DBs)
        try:
            existing_contact_cols = {col["name"] for col in inspect(engine).get_columns("deal_contacts")}
            for col, typedef in [("linkedin_url", "TEXT"), ("notes", "TEXT")]:
                if col not in existing_contact_cols:
                    conn.execute(text(f"ALTER TABLE deal_contacts ADD COLUMN {col} {typedef}"))
        except Exception:
            pass

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

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deal_stage_history (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                stage      TEXT NOT NULL,
                entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                exited_at  DATETIME
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sectors (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL UNIQUE,
                theme      TEXT,
                is_custom  BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Seed taxonomy sectors
        taxonomy = [
            ("Renewable Energy",              "Energy"),
            ("Smart Grid",                    "Energy"),
            ("Energy Storage",                "Energy"),
            ("Energy Efficiency",             "Energy"),
            ("Energy Management",             "Energy"),
            ("AgTech",                        "Food"),
            ("Food Processing Technology",    "Food"),
            ("Post-Harvest & Supply Chain",   "Food"),
            ("MedTech",                       "Health"),
            ("Digital Health",                "Health"),
            ("Prevention",                    "Health"),
            ("Remote Monitoring Technology",  "Health"),
        ]
        for name, theme in taxonomy:
            conn.execute(
                text("INSERT OR IGNORE INTO sectors (name, theme, is_custom) VALUES (:n, :t, 0)"),
                {"n": name, "t": theme},
            )

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS correspondence (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id               INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
                type                  TEXT NOT NULL,
                date                  TEXT NOT NULL,
                team_members          TEXT,
                external_participants TEXT,
                subject               TEXT,
                notes                 TEXT,
                filename              TEXT,
                original_filename     TEXT,
                created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Team members table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS team_members (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL UNIQUE,
                email      TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        default_team = ['Hans', 'Mark', 'Niels', 'Pauline', 'Bart', 'Pieter', 'Henk']
        for name in default_team:
            conn.execute(
                text("INSERT OR IGNORE INTO team_members (name) VALUES (:n)"),
                {"n": name},
            )

        # Users table for authentication
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT NOT NULL UNIQUE,
                full_name       TEXT NOT NULL,
                email           TEXT,
                role            TEXT NOT NULL DEFAULT 'member',
                hashed_password TEXT NOT NULL,
                is_active       BOOLEAN NOT NULL DEFAULT 1,
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Seed initial users if table is empty
        try:
            count_row = conn.execute(text("SELECT COUNT(*) FROM users")).fetchone()
            if count_row[0] == 0:
                seed_users = [
                    ("hans",    "Hans",    "hans@dte.nl",    "admin",  "DTEhans2026!"),
                    ("mark",    "Mark",    "mark@dte.nl",    "admin",  "DTEmark2026!"),
                    ("niels",   "Niels",   "niels@dte.nl",   "admin",  "DTEniels2026!"),
                    ("pauline", "Pauline", "pauline@dte.nl", "member", "DTEpauline2026!"),
                    ("bart",    "Bart",    "bart@dte.nl",    "member", "DTEbart2026!"),
                    ("pieter",  "Pieter",  "pieter@dte.nl",  "member", "DTEpieter2026!"),
                    ("henk",    "Henk",    "henk@dte.nl",    "member", "DTEhenk2026!"),
                ]
                for username, full_name, email, role, password in seed_users:
                    hashed = auth.get_password_hash(password)
                    conn.execute(
                        text("INSERT INTO users (username, full_name, email, role, hashed_password, is_active) VALUES (:u, :f, :e, :r, :h, 1)"),
                        {"u": username, "f": full_name, "e": email, "r": role, "h": hashed},
                    )
        except Exception as e:
            print(f"[migrate] user seed error: {e}")

        conn.commit()


_migrate()


# ── APScheduler (daily 08:00 Amsterdam alert emails) ─────────────────────────

def _send_overdue_emails():
    """Send daily alert emails for overdue / due-today next actions."""
    from sqlalchemy.orm import sessionmaker as _SM
    _Session = _SM(bind=engine)
    db = _Session()
    try:
        today = date_type.today().isoformat()
        overdue = (
            db.query(models.Deal)
            .filter(
                models.Deal.next_action_due.isnot(None),
                models.Deal.next_action_due <= today,
                models.Deal.stage.not_in(["Lost"]),
            )
            .all()
        )
        if not overdue:
            return

        smtp_host = os.getenv("SMTP_HOST", "")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASSWORD", "")
        if not smtp_host or not smtp_user:
            return

        # Build email body
        body_lines = ["<h2>DTE Deal Pipeline — Overdue Next Actions</h2><ul>"]
        for d in overdue:
            status = "OVERDUE" if d.next_action_due < today else "Due Today"
            body_lines.append(
                f"<li><b>{d.company_name}</b> ({d.stage}) — {d.next_action or 'Follow up'} "
                f"— Deadline: {d.next_action_due} <span style='color:red'>[{status}]</span></li>"
            )
        body_lines.append("</ul>")
        body_html = "\n".join(body_lines)

        # Collect recipient emails from team_members table
        team_emails = [tm.email for tm in db.query(models.TeamMember).filter(models.TeamMember.email.isnot(None)).all()]
        if not team_emails:
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"DTE Deal Pipeline — {len(overdue)} overdue action(s)"
        msg["From"] = smtp_user
        msg["To"] = ", ".join(team_emails)
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, team_emails, msg.as_string())
    except Exception as e:
        print(f"[scheduler] email error: {e}")
    finally:
        db.close()


try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    import pytz
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _send_overdue_emails,
        CronTrigger(hour=8, minute=0, timezone=pytz.timezone("Europe/Amsterdam")),
    )
    _scheduler.start()
except Exception:
    pass  # APScheduler or pytz not available

# ── Upload directory ──────────────────────────────────────────────────────────

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Deal Pipeline CRM", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth middleware ───────────────────────────────────────────────────────────

PUBLIC_PATHS = {"/api/auth/login", "/api/auth/logout", "/api/health"}

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Allow public paths, static files, and non-API routes
        if (path in PUBLIC_PATHS or
                not path.startswith("/api/") or
                path.startswith("/api/uploads/")):
            return await call_next(request)

        token = request.cookies.get("access_token")
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        payload = auth.decode_token(token)
        if not payload:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        request.state.user_id = payload.get("sub")
        request.state.user_role = payload.get("role", "member")
        return await call_next(request)

app.add_middleware(AuthMiddleware)

# ── In-memory rate limiter for login attempts ─────────────────────────────────

_login_attempts: dict = defaultdict(list)  # ip -> [timestamp, ...]
RATE_LIMIT_MAX     = 5
RATE_LIMIT_WINDOW  = 900  # 15 minutes in seconds


def _check_rate_limit(ip: str):
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < RATE_LIMIT_WINDOW]
    _login_attempts[ip] = attempts
    if len(attempts) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Try again in 15 minutes.")
    return attempts


def _get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    """Extract current user from request state (set by middleware)."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(models.User).filter(models.User.username == user_id, models.User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def _require_admin(current_user: models.User = Depends(_get_current_user)) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


STAGE_ORDER = ["Sourcing", "Screening", "IC", "Due Diligence", "Portfolio", "Postponed"]

# ── Stage history helper ──────────────────────────────────────────────────────

def _record_stage_entry(db: Session, deal_id: int, new_stage: str):
    """Close any open history record for this deal and open a new one."""
    from sqlalchemy import text
    now = datetime.utcnow()
    db.execute(
        text("UPDATE deal_stage_history SET exited_at = :now WHERE deal_id = :did AND exited_at IS NULL"),
        {"now": now, "did": deal_id},
    )
    db.add(models.DealStageHistory(deal_id=deal_id, stage=new_stage, entered_at=now))


# ── Schemas ───────────────────────────────────────────────────────────────────

class DealBase(BaseModel):
    company_name:   str
    stage:          str             = "Sourcing"
    sector:         Optional[str]   = None
    sectors:        Optional[str]   = None   # JSON array string
    deal_type:      Optional[str]   = None   # Platform / Add-on / Carve-out
    ev:             Optional[float] = None
    ev_range:       Optional[str]   = None
    country:        Optional[str]   = None
    owner:          Optional[str]   = None
    owners:         Optional[str]   = None   # comma-separated
    notes:          Optional[str]   = None
    domain:         Optional[str]   = None
    theme:          Optional[str]   = None
    sourcing:       Optional[str]   = None
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
    next_action:          Optional[str]   = None
    next_action_due:      Optional[str]   = None
    next_action_assignees:Optional[str]   = None
    lost_reason:          Optional[str]   = None
    lost_note:            Optional[str]   = None
    postpone_reason:      Optional[str]   = None
    postpone_notes:       Optional[str]   = None
    # Criteria
    crit_thematic:   Optional[bool] = False
    crit_technology: Optional[bool] = False
    crit_commercial: Optional[bool] = False
    crit_geography:  Optional[bool] = False
    crit_majority:   Optional[bool] = False
    crit_ticket:     Optional[bool] = False
    last_contact_at: Optional[str]  = None


class DealCreate(DealBase):
    position: Optional[int] = 0


class DealUpdate(BaseModel):
    company_name:   Optional[str]   = None
    stage:          Optional[str]   = None
    sector:         Optional[str]   = None
    sectors:        Optional[str]   = None
    deal_type:      Optional[str]   = None
    ev:             Optional[float] = None
    ev_range:       Optional[str]   = None
    country:        Optional[str]   = None
    owner:          Optional[str]   = None
    owners:         Optional[str]   = None
    notes:          Optional[str]   = None
    position:       Optional[int]   = None
    domain:         Optional[str]   = None
    theme:          Optional[str]   = None
    sourcing:       Optional[str]   = None
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
    next_action:          Optional[str]   = None
    next_action_due:      Optional[str]   = None
    next_action_assignees:Optional[str]   = None
    lost_reason:          Optional[str]   = None
    lost_note:            Optional[str]   = None
    postpone_reason:      Optional[str]   = None
    postpone_notes:       Optional[str]   = None
    crit_thematic:   Optional[bool] = None
    crit_technology: Optional[bool] = None
    crit_commercial: Optional[bool] = None
    crit_geography:  Optional[bool] = None
    crit_majority:   Optional[bool] = None
    crit_ticket:     Optional[bool] = None
    last_contact_at: Optional[str]  = None


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
    name:         str
    role:         Optional[str] = None
    email:        Optional[str] = None
    phone:        Optional[str] = None
    linkedin_url: Optional[str] = None
    notes:        Optional[str] = None


class ContactUpdate(BaseModel):
    name:         Optional[str] = None
    role:         Optional[str] = None
    email:        Optional[str] = None
    phone:        Optional[str] = None
    linkedin_url: Optional[str] = None
    notes:        Optional[str] = None


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
    linkedin_url: Optional[str] = None
    notes:        Optional[str] = None
    created_at:   Optional[datetime] = None
    interactions: List[InteractionResponse] = []
    model_config = {"from_attributes": True}


# ── Auth schemas ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id:         int
    username:   str
    full_name:  str
    email:      Optional[str] = None
    role:       str
    is_active:  bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username:  str
    full_name: str
    email:     Optional[str] = None
    role:      str = "member"
    password:  str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email:     Optional[str] = None
    role:      Optional[str] = None
    is_active: Optional[bool] = None
    password:  Optional[str] = None  # if provided, change password


# ── Auth endpoints ────────────────────────────────────────────────────────────

IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"


@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user or not user.is_active or not auth.verify_password(body.password, user.hashed_password):
        _login_attempts[ip].append(time.time())
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Successful login — clear rate limit for this IP
    _login_attempts[ip] = []

    token = auth.create_access_token({"sub": user.username, "role": user.role})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=86400,
        samesite="lax",
        secure=IS_PRODUCTION,
    )
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        }
    }


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token", samesite="lax")
    return {"ok": True}


@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(_get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
    }


@app.post("/api/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user: models.User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    if not auth.verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.hashed_password = auth.get_password_hash(body.new_password)
    db.commit()
    return {"ok": True}


# ── User management (admin only) ──────────────────────────────────────────────

@app.get("/api/users", response_model=List[UserResponse])
def list_users(_: models.User = Depends(_require_admin), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.id).all()


@app.post("/api/users", response_model=UserResponse, status_code=201)
def create_user(body: UserCreate, _: models.User = Depends(_require_admin), db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = models.User(
        username=body.username,
        full_name=body.full_name,
        email=body.email,
        role=body.role,
        hashed_password=auth.get_password_hash(body.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.patch("/api/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserUpdate,
    _: models.User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = body.model_dump(exclude_unset=True)
    if "password" in updates:
        pw = updates.pop("password")
        if pw and len(pw) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        if pw:
            user.hashed_password = auth.get_password_hash(pw)
    for key, value in updates.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: models.User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


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
    db.flush()  # get id
    _record_stage_entry(db, db_deal.id, db_deal.stage)
    db.commit()
    db.refresh(db_deal)
    return db_deal


@app.patch("/api/deals/{deal_id}", response_model=DealResponse)
@app.put("/api/deals/{deal_id}", response_model=DealResponse)
def update_deal(deal_id: int, deal: DealUpdate, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    updates = deal.model_dump(exclude_unset=True)

    stage_changed = "stage" in updates and updates["stage"] != db_deal.stage
    if stage_changed and "position" not in updates:
        stage_count = db.query(models.Deal).filter(models.Deal.stage == updates["stage"]).count()
        updates["position"] = stage_count

    for key, value in updates.items():
        setattr(db_deal, key, value)

    if stage_changed:
        _record_stage_entry(db, deal_id, updates["stage"])

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
            stage_changed = db_deal.stage != item.stage
            db_deal.position = item.position
            db_deal.stage    = item.stage
            if stage_changed:
                _record_stage_entry(db, item.id, item.stage)
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
    doc = models.Document(deal_id=deal_id, filename=filename, original_name=file.filename, category=category)
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
        linkedin_url=db_contact.linkedin_url, notes=db_contact.notes,
        created_at=db_contact.created_at, interactions=[],
    )


@app.patch("/api/contacts/{contact_id}", response_model=ContactResponse)
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
        linkedin_url=db_contact.linkedin_url, notes=db_contact.notes,
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
    db_int = models.Interaction(contact_id=contact_id, deal_id=db_contact.deal_id, **interaction.model_dump())
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
    filename = os.path.basename(filename)
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


# ── Sector schemas ────────────────────────────────────────────────────────────

class SectorCreate(BaseModel):
    name:  str
    theme: Optional[str] = None

class SectorResponse(BaseModel):
    id:        int
    name:      str
    theme:     Optional[str] = None
    is_custom: bool
    model_config = {"from_attributes": True}


# ── Correspondence schemas ─────────────────────────────────────────────────────

class CorrespondenceCreate(BaseModel):
    type:                  str
    date:                  str
    team_members:          Optional[str] = None
    external_participants: Optional[str] = None
    subject:               Optional[str] = None
    notes:                 Optional[str] = None
    filename:              Optional[str] = None
    original_filename:     Optional[str] = None

class CorrespondenceResponse(BaseModel):
    id:                    int
    deal_id:               int
    type:                  str
    date:                  str
    team_members:          Optional[str] = None
    external_participants: Optional[str] = None
    subject:               Optional[str] = None
    notes:                 Optional[str] = None
    filename:              Optional[str] = None
    original_filename:     Optional[str] = None
    created_at:            Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Import helpers ────────────────────────────────────────────────────────────

THEME_MAP = {
    "energy":      "Energy",
    "food":        "Food",
    "health":      "Health",
    "healthcare":  "Health",
}

SOURCING_MAP = {
    "proprietary": "Proprietary",
    "in-bound":    "Inbound",
    "inbound":     "Inbound",
    "auction":     "Auction",
    "referral":    "Referral",
    "co-investor": "Co-investor",
}

LAST_PHASE_STAGE_MAP = {
    "l":        "Sourcing",
    "sc":       "Screening",
    "sl":       "Screening",
    "wl":       "Screening",
    "a":        "Screening",
    "3":        "Screening",
    "dv":       "IC",
    "4":        "IC",
    "an":       "IC",
    "5":        "IC",
    "dd":       "Due Diligence",
    "6":        "Due Diligence",
    "d":        "Closed",
    "declined": "Lost",
}


def _ev_range_to_midpoint(ev_str: str) -> Optional[float]:
    """Parse '10-20' → 15.0, '10' → 10.0. Returns None on failure."""
    if not ev_str:
        return None
    ev_str = str(ev_str).strip()
    if "-" in ev_str:
        parts = ev_str.split("-")
        try:
            lo, hi = float(parts[0]), float(parts[-1])
            return (lo + hi) / 2
        except ValueError:
            return None
    try:
        return float(ev_str)
    except ValueError:
        return None


def _map_deal_row(row: dict) -> Optional[dict]:
    """Map a raw Excel row dict to deal fields. Returns None if no company name."""
    company = str(row.get("Company") or "").strip()
    if not company:
        return None

    # Sector → theme
    sector_raw = str(row.get("Sector") or "").strip().lower()
    theme = THEME_MAP.get(sector_raw)

    # Country
    country = str(row.get("Country") or "").strip() or None

    # Type → co_investor field repurposed as deal type — actually store in sourcing/notes
    deal_type = str(row.get("Type") or "").strip() or None

    # Channel → sourcing
    channel_raw = str(row.get("Channel") or "").strip().lower()
    sourcing = SOURCING_MAP.get(channel_raw)

    # Ticket → ev_range + ev midpoint
    ticket_raw = str(row.get("Ticket (€m)") or row.get("Ticket") or "").strip()
    ev_range   = ticket_raw if ticket_raw else None
    ev_mid     = _ev_range_to_midpoint(ticket_raw)

    # Last phase → stage
    last_phase_raw = str(row.get("Last phase") or "").strip()
    stage = LAST_PHASE_STAGE_MAP.get(last_phase_raw.lower(), "Sourcing") if last_phase_raw else "Sourcing"

    # Notes — prepend last phase prefix
    notes_raw = str(row.get("Notes") or "").strip()
    notes_parts = []
    if last_phase_raw:
        notes_parts.append(f"Last phase: {last_phase_raw}.")
    if deal_type:
        notes_parts.append(f"Type: {deal_type}.")
    if notes_raw:
        notes_parts.append(notes_raw)
    notes = " ".join(notes_parts) or None

    lost_reason = "Other" if stage == "Lost" else None

    return {
        "company_name": company,
        "stage":        stage,
        "theme":        theme,
        "country":      country,
        "sourcing":     sourcing,
        "ev_range":     ev_range,
        "ev":           ev_mid,
        "notes":        notes,
        "lost_reason":  lost_reason,
        "deal_type":    deal_type,
    }


def _bulk_import(deals_data: list, db: Session) -> dict:
    """Insert mapped deal rows into the DB, skipping duplicates. Returns summary."""
    existing_names = {d.company_name.lower() for d in db.query(models.Deal.company_name).all()}
    imported = 0
    skipped  = 0

    for row in deals_data:
        if not row:
            continue
        name_lower = row["company_name"].lower()
        if name_lower in existing_names:
            skipped += 1
            continue
        stage_count = db.query(models.Deal).filter(models.Deal.stage == row["stage"]).count()
        db_deal = models.Deal(
            company_name=row["company_name"],
            stage       =row["stage"],
            theme       =row.get("theme"),
            country     =row.get("country"),
            sourcing    =row.get("sourcing"),
            ev_range    =row.get("ev_range"),
            ev          =row.get("ev"),
            notes       =row.get("notes"),
            lost_reason =row.get("lost_reason"),
            deal_type   =row.get("deal_type"),
            position    =stage_count,
        )
        db.add(db_deal)
        db.flush()
        _record_stage_entry(db, db_deal.id, db_deal.stage)
        existing_names.add(name_lower)
        imported += 1

    db.commit()
    return {"imported": imported, "skipped": skipped}


@app.post("/api/deals/import")
async def import_deals(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx files are accepted")
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "openpyxl not installed")

    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    ws = wb.active

    # Find header row — first row where first non-empty cell contains "Company"
    header_row_idx = None
    headers = []
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        cells = [str(c).strip() if c is not None else "" for c in row]
        if any("Company" in c or "company" in c.lower() for c in cells):
            header_row_idx = i
            headers = cells
            break

    if header_row_idx is None:
        raise HTTPException(400, "Could not find header row with 'Company' column")

    deals_data = []
    for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
        if all(c is None or str(c).strip() == "" for c in row):
            continue
        row_dict = {headers[i]: (str(row[i]).strip() if row[i] is not None else "") for i in range(min(len(headers), len(row)))}
        mapped = _map_deal_row(row_dict)
        if mapped:
            deals_data.append(mapped)

    result = _bulk_import(deals_data, db)
    return result


# ── Seed ──────────────────────────────────────────────────────────────────────

SEED_DEALS = [
    {"company_name": "SEA Water",             "stage": "IC",       "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: AN. Awaiting large SEA Water contracts."},
    {"company_name": "PerfoTec",              "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. Awaiting founder to realize majority sell is necessary."},
    {"company_name": "HatchTech",             "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Not yet willing to give up majority."},
    {"company_name": "VitalFluid",            "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L."},
    {"company_name": "Innax",                 "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Waiting for last party to fail negotiations."},
    {"company_name": "MyMesh",                "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. Serious interest from founder to sell to DTE."},
    {"company_name": "Circotex",              "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. Aiming to move production to Portugal and US."},
    {"company_name": "Inspektor",             "stage": "Sourcing", "theme": "Health", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. In talks with founders, awaiting production cost decrease."},
    {"company_name": "Moos",                  "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Meetings in November and December 2025."},
    {"company_name": "ElementAir",            "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L."},
    {"company_name": "BatterijVoorThuis",     "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. In scope 2027. Type: Add-on."},
    {"company_name": "Technologies Added",    "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. In talks."},
    {"company_name": "Triple Solar",          "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": None,    "ev": None,  "notes": "Last phase: L."},
    {"company_name": "Dutch Climate Systems", "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. Meeting with founder/CEO."},
    {"company_name": "iXora",                 "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L."},
    {"company_name": "XINTC",                 "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L."},
    {"company_name": "Valess - Dalco",        "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. Type: Carve-out. Complex carve-out structure."},
    {"company_name": "Currentt",              "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. Type: Add-on. Expecting big sales increase in 2026."},
    {"company_name": "DutchVentus",           "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. In scope 2028."},
    {"company_name": "TTA x ISO",             "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Inbound",     "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L."},
    {"company_name": "Superlofts",            "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. Type: Add-on."},
    {"company_name": "Suncom",                "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Not interested in majority sale."},
    {"company_name": "PlanetFarms",           "stage": "Sourcing", "theme": "Food",   "country": "IT", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Potential deal in 2027."},
    {"company_name": "Greenphyto",            "stage": "Sourcing", "theme": "Food",   "country": "SG", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Awaiting EU entry strategy."},
    {"company_name": "The Sauce Company",     "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. On hold for commercial uplift."},
    {"company_name": "AquaBattery",           "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. Type: Add-on. Too early, potential deal 2029."},
    {"company_name": "Onera Health",          "stage": "Sourcing", "theme": "Health", "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: L. Too early stage, potential deal 2028."},
    {"company_name": "Airborne",              "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. In talks on buy strategy."},
    {"company_name": "Orbital Eye",           "stage": "Sourcing", "theme": "Energy", "country": "NL", "sourcing": "Inbound",     "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. Working towards potential NBO."},
    {"company_name": "Augmedit",              "stage": "Sourcing", "theme": "Health", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L. Founder contacted DTE."},
    {"company_name": "Gilbertt",              "stage": "Sourcing", "theme": "Health", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: L. Type: Add-on. Potential deal 2028."},
    {"company_name": "Octiva",               "stage": "Lost",     "theme": "Food",   "country": "BE", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: Declined. Stopped - IP issues.", "lost_reason": "Other"},
    {"company_name": "Ksyos",                "stage": "Lost",     "theme": "Health", "country": "NL", "sourcing": "Inbound",     "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: Declined. Stopped - bid increase request without new info.", "lost_reason": "Valuation too high"},
    {"company_name": "Nedstack",             "stage": "Lost",     "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: Declined. Not profitable on unit economics.", "lost_reason": "Mandate mismatch"},
    {"company_name": "Leydenjar",            "stage": "Lost",     "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: Declined. Too early and too high valuation.", "lost_reason": "Valuation too high"},
    {"company_name": "Growy",               "stage": "Lost",     "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: Declined. Too early stage.", "lost_reason": "Too early stage"},
    {"company_name": "Rocsys",              "stage": "Lost",     "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "20-30", "ev": 25.0, "notes": "Last phase: Declined. Too early stage, potential deal 2028.", "lost_reason": "Too early stage"},
    {"company_name": "GBM Works",           "stage": "Lost",     "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: Declined. Too early stage.", "lost_reason": "Too early stage"},
    {"company_name": "Paques Biomaterials", "stage": "Lost",     "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "10-20", "ev": 15.0, "notes": "Last phase: Declined. Too early stage.", "lost_reason": "Too early stage"},
    {"company_name": "Trabotyx",            "stage": "Lost",     "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: Declined. Type: Add-on. Too early stage.", "lost_reason": "Too early stage"},
    {"company_name": "Eatch Robot Kitchen", "stage": "Lost",     "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: Declined. Too early stage.", "lost_reason": "Too early stage"},
    {"company_name": "Sea 02",              "stage": "Lost",     "theme": "Energy", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: Declined. Too early stage.", "lost_reason": "Too early stage"},
    {"company_name": "Ningaloo",            "stage": "Lost",     "theme": "Health", "country": "NL", "sourcing": "Inbound",     "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: Declined. Type: Add-on. Too early and out of scope.", "lost_reason": "Mandate mismatch"},
    {"company_name": "PULS",               "stage": "Lost",     "theme": "Health", "country": "NL", "sourcing": "Inbound",     "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: Declined. Type: Add-on. Too early and out of scope.", "lost_reason": "Mandate mismatch"},
    {"company_name": "Momo Medical",       "stage": "Sourcing", "theme": "Health", "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L."},
    {"company_name": "SDS Separation",     "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L."},
    {"company_name": "SusPhos",            "stage": "Sourcing", "theme": "Food",   "country": "NL", "sourcing": "Proprietary", "ev_range": "5-10",  "ev": 7.5,  "notes": "Last phase: L."},
]


@app.post("/api/deals/seed")
def seed_deals(db: Session = Depends(get_db)):
    """One-time seed with hardcoded DTE pipeline data. Skips existing companies."""
    result = _bulk_import(SEED_DEALS, db)
    return result


# ── Sectors ───────────────────────────────────────────────────────────────────

@app.get("/api/sectors", response_model=List[SectorResponse])
def get_sectors(db: Session = Depends(get_db)):
    return db.query(models.Sector).order_by(models.Sector.theme, models.Sector.name).all()


@app.post("/api/sectors", response_model=SectorResponse, status_code=201)
def create_sector(sector: SectorCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Sector).filter(models.Sector.name == sector.name).first()
    if existing:
        raise HTTPException(400, "Sector already exists")
    db_sector = models.Sector(name=sector.name, theme=sector.theme, is_custom=True)
    db.add(db_sector)
    db.commit()
    db.refresh(db_sector)
    return db_sector


# ── Correspondence ─────────────────────────────────────────────────────────────

@app.get("/api/deals/{deal_id}/correspondence", response_model=List[CorrespondenceResponse])
def get_correspondence(deal_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Correspondence)
        .filter(models.Correspondence.deal_id == deal_id)
        .order_by(models.Correspondence.date.desc(), models.Correspondence.created_at.desc())
        .all()
    )


@app.post("/api/deals/{deal_id}/correspondence", response_model=CorrespondenceResponse, status_code=201)
def create_correspondence(deal_id: int, entry: CorrespondenceCreate, db: Session = Depends(get_db)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(404, "Deal not found")
    db_entry = models.Correspondence(deal_id=deal_id, **entry.model_dump())
    db.add(db_entry)
    db.flush()
    # Update last_contact_at on the deal if this entry's date is newer
    if not deal.last_contact_at or entry.date >= deal.last_contact_at:
        deal.last_contact_at = entry.date
    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.delete("/api/deals/{deal_id}/correspondence/{entry_id}", status_code=204)
def delete_correspondence(deal_id: int, entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.Correspondence).filter(
        models.Correspondence.id == entry_id,
        models.Correspondence.deal_id == deal_id,
    ).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.flush()
    # Recompute last_contact_at from remaining entries
    remaining = (
        db.query(models.Correspondence)
        .filter(models.Correspondence.deal_id == deal_id)
        .order_by(models.Correspondence.date.desc())
        .first()
    )
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if deal:
        deal.last_contact_at = remaining.date if remaining else None
    db.commit()


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/api/analytics/")
def get_analytics(db: Session = Depends(get_db)):
    from collections import defaultdict

    deals  = db.query(models.Deal).all()
    active = [d for d in deals if d.stage != "Lost"]
    lost   = [d for d in deals if d.stage == "Lost"]

    # 1. Funnel (show Sourcing→Portfolio progression + Postponed; no conversion for Postponed)
    FUNNEL_STAGES = ["Sourcing", "Screening", "IC", "Due Diligence", "Portfolio"]
    funnel = []
    for i, stage in enumerate(FUNNEL_STAGES):
        count      = len([d for d in deals if d.stage == stage])
        prev_count = len([d for d in deals if d.stage == FUNNEL_STAGES[i - 1]]) if i > 0 else None
        conv_pct   = round(count / prev_count * 100) if prev_count else None
        funnel.append({"stage": stage, "count": count, "conversion_pct": conv_pct})
    # Append Postponed without conversion rate
    postponed_count = len([d for d in deals if d.stage == "Postponed"])
    funnel.append({"stage": "Postponed", "count": postponed_count, "conversion_pct": None})

    # 2. Avg days per stage (from history records) — key: deal_count for frontend
    stage_time = []
    for stage in STAGE_ORDER:
        histories = (
            db.query(models.DealStageHistory)
            .filter(
                models.DealStageHistory.stage == stage,
                models.DealStageHistory.exited_at.isnot(None),
            )
            .all()
        )
        if histories:
            avg = sum((h.exited_at - h.entered_at).days for h in histories) / len(histories)
            stage_time.append({"stage": stage, "avg_days": round(avg, 1), "deal_count": len(histories)})
        else:
            current = [d for d in deals if d.stage == stage and d.created_at]
            if current:
                avg = sum((datetime.utcnow() - d.created_at).days for d in current) / len(current)
                stage_time.append({"stage": stage, "avg_days": round(avg, 1), "deal_count": len(current)})
            else:
                stage_time.append({"stage": stage, "avg_days": 0, "deal_count": 0})

    # 3. Themes
    themes_data = []
    for theme in ["Energy", "Food", "Health"]:
        themed   = [d for d in active if d.theme == theme]
        total_ev = sum(d.ev or 0 for d in themed)
        themes_data.append({"theme": theme, "count": len(themed), "total_ev": round(total_ev, 1)})

    # 4. Sourcing breakdown — key must be "sourcing" for frontend
    sourcing_data = []
    for src in ["Proprietary", "Auction", "Referral", "Co-investor"]:
        count = len([d for d in active if d.sourcing == src])
        if count > 0:
            sourcing_data.append({"sourcing": src, "count": count})

    # 5. Criteria completion — return as object {crit_*: count, total_active: n}
    crit_keys = ["thematic", "technology", "commercial", "geography", "majority", "ticket"]
    criteria_obj: dict = {"total_active": len(active)}
    for key in crit_keys:
        col = f"crit_{key}"
        criteria_obj[col] = sum(1 for d in active if getattr(d, col, False))

    # 6. Lost reasons
    reason_counts: dict = defaultdict(int)
    for d in lost:
        r = d.lost_reason or "Unknown"
        reason_counts[r] += 1
    lost_breakdown = [
        {"reason": k, "count": v}
        for k, v in sorted(reason_counts.items(), key=lambda x: -x[1])
    ]

    # 7. Team workload — keys: owner, deal_count, total_ev
    workload: dict = defaultdict(lambda: {"deal_count": 0, "total_ev": 0.0})
    for d in active:
        people = d.owners.split(",") if d.owners else ([d.owner] if d.owner else [])
        for p in people:
            p = p.strip()
            if p:
                workload[p]["deal_count"] += 1
                workload[p]["total_ev"]   += d.ev or 0
    team_data = [
        {"owner": k, "deal_count": v["deal_count"], "total_ev": round(v["total_ev"], 1)}
        for k, v in sorted(workload.items(), key=lambda x: -x[1]["deal_count"])
    ]

    # 8. Deals per month — key "month" matches frontend
    monthly: dict = defaultdict(int)
    for d in deals:
        if d.created_at:
            monthly[d.created_at.strftime("%b %y")] += 1
    monthly_data = [{"month": k, "count": v} for k, v in sorted(monthly.items())]

    # 9. Postpone reasons breakdown
    postpone_counts: dict = defaultdict(int)
    for d in deals:
        if d.stage == "Postponed" and d.postpone_reason:
            postpone_counts[d.postpone_reason] += 1
    postpone_breakdown = [
        {"reason": k, "count": v}
        for k, v in sorted(postpone_counts.items(), key=lambda x: -x[1])
    ]

    # Totals — keys must match frontend KPIRow
    portfolio_deals = [d for d in deals if d.stage == "Portfolio"]
    win_rate = round(len(portfolio_deals) / (len(portfolio_deals) + len(lost)) * 100) if (portfolio_deals or lost) else 0

    # Correspondence recency
    deals_with_contact = [d for d in active if d.last_contact_at]
    avg_days_since_contact = None
    if deals_with_contact:
        total_days = sum(
            (datetime.utcnow().date() - datetime.strptime(d.last_contact_at, "%Y-%m-%d").date()).days
            for d in deals_with_contact
        )
        avg_days_since_contact = round(total_days / len(deals_with_contact), 1)

    return {
        "funnel":     funnel,
        "stage_time": [s for s in stage_time if s["deal_count"] > 0],
        "themes":     themes_data,
        "sourcing":   sourcing_data,
        "criteria":   criteria_obj,
        "lost":       lost_breakdown,
        "postponed":  postpone_breakdown,
        "team":       team_data,
        "monthly":    monthly_data,
        "totals": {
            "active_deals": len(active),
            "lost_count":   len(lost),
            "total":        len(deals),
            "pipeline_ev":  round(sum(d.ev or 0 for d in active), 1),
            "closed_ev":    round(sum(d.ev or 0 for d in portfolio_deals), 1),
            "win_rate":              win_rate,
            "postponed_count":       postponed_count,
            "avg_days_since_contact": avg_days_since_contact,
        },
    }


# ── Alerts ───────────────────────────────────────────────────────────────────

@app.get("/api/alerts/overdue")
def get_overdue_alerts(db: Session = Depends(get_db)):
    today = date_type.today().isoformat()
    overdue_deals = (
        db.query(models.Deal)
        .filter(
            models.Deal.next_action_due.isnot(None),
            models.Deal.next_action_due <= today,
            models.Deal.stage.not_in(["Lost"]),
        )
        .order_by(models.Deal.next_action_due)
        .all()
    )
    return [
        {
            "id":                   d.id,
            "company_name":         d.company_name,
            "stage":                d.stage,
            "next_action":          d.next_action,
            "next_action_due":      d.next_action_due,
            "next_action_assignees": d.next_action_assignees,
            "is_overdue":           d.next_action_due < today,
        }
        for d in overdue_deals
    ]


@app.post("/api/alerts/send-email")
def send_alert_emails(db: Session = Depends(get_db)):
    try:
        _send_overdue_emails()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Team members CRUD ─────────────────────────────────────────────────────────

class TeamMemberResponse(BaseModel):
    id:    int
    name:  str
    email: Optional[str] = None
    model_config = {"from_attributes": True}

class TeamMemberUpdate(BaseModel):
    email: Optional[str] = None


@app.get("/api/team-members", response_model=List[TeamMemberResponse])
def get_team_members(db: Session = Depends(get_db)):
    return db.query(models.TeamMember).order_by(models.TeamMember.name).all()


@app.patch("/api/team-members/{member_id}", response_model=TeamMemberResponse)
def update_team_member(member_id: int, update: TeamMemberUpdate, db: Session = Depends(get_db)):
    member = db.query(models.TeamMember).filter(models.TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(404, "Team member not found")
    if update.email is not None:
        member.email = update.email
    db.commit()
    db.refresh(member)
    return member


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
