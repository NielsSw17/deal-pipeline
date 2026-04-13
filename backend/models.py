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
