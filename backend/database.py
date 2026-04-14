from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Default to /data/deals.db for Railway persistent volume; fall back to local
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/deals.db")

# Ensure the /data directory exists (Railway mounts it, but local dev needs it)
if DATABASE_URL.startswith("sqlite:////data/"):
    os.makedirs("/data", exist_ok=True)
elif DATABASE_URL.startswith("sqlite:///./"):
    pass  # relative path, already in working dir

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
