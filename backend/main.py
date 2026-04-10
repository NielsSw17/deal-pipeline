from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import os
import models
from database import engine, get_db, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Deal Pipeline CRM", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STAGES = ["Sourcing", "Screening", "IC", "Due Diligence", "Signed", "Closed", "Lost"]


class DealCreate(BaseModel):
    company_name: str
    stage: str = "Sourcing"
    sector: Optional[str] = None
    ev: Optional[float] = None
    country: Optional[str] = None
    owner: Optional[str] = None
    notes: Optional[str] = None
    position: Optional[int] = 0


class DealUpdate(BaseModel):
    company_name: Optional[str] = None
    stage: Optional[str] = None
    sector: Optional[str] = None
    ev: Optional[float] = None
    country: Optional[str] = None
    owner: Optional[str] = None
    notes: Optional[str] = None
    position: Optional[int] = None


class DealResponse(BaseModel):
    id: int
    company_name: str
    stage: str
    sector: Optional[str] = None
    ev: Optional[float] = None
    country: Optional[str] = None
    owner: Optional[str] = None
    notes: Optional[str] = None
    position: int = 0

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: int
    position: int
    stage: str


@app.get("/api/deals", response_model=List[DealResponse])
def get_deals(db: Session = Depends(get_db)):
    return (
        db.query(models.Deal)
        .order_by(models.Deal.stage, models.Deal.position, models.Deal.id)
        .all()
    )


@app.post("/api/deals", response_model=DealResponse, status_code=201)
def create_deal(deal: DealCreate, db: Session = Depends(get_db)):
    # Auto-assign position at end of stage
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
    # If stage changed, move to end of new stage
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


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve built frontend in production
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
