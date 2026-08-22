from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./garment_cloud.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class OrderDB(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    po_code = Column(String(50), index=True)
    customer = Column(String(100))
    style_code = Column(String(50))
    qty_s = Column(Integer, default=0)
    qty_m = Column(Integer, default=0)
    qty_l = Column(Integer, default=0)
    qty_xl = Column(Integer, default=0)
    qty_xxl = Column(Integer, default=0)
    price_cm = Column(Float, default=0.0)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Garment ERP Cloud API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def home():
    return {"status": "Garment ERP Cloud API is running"}

@app.get("/api/orders")
def get_orders(db: Session = Depends(get_db)):
    return db.query(OrderDB).all()

class OrderSchema(BaseModel):
    po_code: str
    customer: str
    style_code: str
    qty_s: int
    qty_m: int
    qty_l: int
    qty_xl: int
    qty_xxl: int
    price_cm: float

@app.post("/api/orders")
def update_order(order: OrderSchema, db: Session = Depends(get_db)):
    db_order = OrderDB(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return {"status": "success", "data": db_order}
