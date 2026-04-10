from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    stage = Column(String, nullable=False, default="Sourcing")
    sector = Column(String, nullable=True)
    ev = Column(Float, nullable=True)
    country = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    position = Column(Integer, default=0, nullable=False)
    domain = Column(String, nullable=True)
    theme = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
