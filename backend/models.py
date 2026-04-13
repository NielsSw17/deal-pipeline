from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Deal(Base):
    __tablename__ = "deals"

    id            = Column(Integer, primary_key=True, index=True)
    company_name  = Column(String, nullable=False)
    stage         = Column(String, nullable=False, default="Sourcing")
    sector        = Column(String, nullable=True)
    ev            = Column(Float,  nullable=True)
    country       = Column(String, nullable=True)
    owner         = Column(String, nullable=True)
    notes         = Column(String, nullable=True)   # legacy single-note field
    position      = Column(Integer, default=0, nullable=False)
    domain        = Column(String, nullable=True)
    theme         = Column(String, nullable=True)
    # DTE fields
    revenue       = Column(Float,  nullable=True)
    ebitda        = Column(Float,  nullable=True)
    ownership_pct = Column(Float,  nullable=True)
    geography     = Column(String, nullable=True)
    deal_source   = Column(String, nullable=True)
    co_investor   = Column(String, nullable=True)
    thesis        = Column(Text,   nullable=True)
    ic_date       = Column(String, nullable=True)
    ic_memo       = Column(String, nullable=True)   # stored filename
    term_sheet    = Column(String, nullable=True)   # stored filename
    close_date    = Column(String, nullable=True)
    # Next action
    next_action     = Column(String, nullable=True)
    next_action_due = Column(String, nullable=True)
    # Lost tracking
    lost_reason   = Column(String, nullable=True)
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, onupdate=func.now())


class Note(Base):
    __tablename__ = "deal_notes"

    id        = Column(Integer, primary_key=True, index=True)
    deal_id   = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    text      = Column(Text,    nullable=False)
    author    = Column(String,  nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Document(Base):
    __tablename__ = "deal_documents"

    id            = Column(Integer, primary_key=True, index=True)
    deal_id       = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    filename      = Column(String, nullable=False)   # stored UUID name
    original_name = Column(String, nullable=False)
    category      = Column(String, nullable=False, default="Other")
    uploaded_at   = Column(DateTime, server_default=func.now())


class Contact(Base):
    __tablename__ = "deal_contacts"

    id      = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    name    = Column(String, nullable=False)
    role    = Column(String, nullable=True)
    email   = Column(String, nullable=True)
    phone   = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Interaction(Base):
    __tablename__ = "contact_interactions"

    id         = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("deal_contacts.id", ondelete="CASCADE"), nullable=False)
    deal_id    = Column(Integer, ForeignKey("deals.id",         ondelete="CASCADE"), nullable=False)
    type       = Column(String, nullable=False)   # Call / Email / Meeting
    date       = Column(String, nullable=False)
    note       = Column(Text,   nullable=True)
    created_at = Column(DateTime, server_default=func.now())
