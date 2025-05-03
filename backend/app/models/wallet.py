import uuid
from datetime import datetime
from sqlalchemy import Column, Float, DateTime, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class Wallet(Base):
    __tablename__ = "wallets"
    child_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    balance = Column(Float, default=0.0, nullable=False)

    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan")

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    child_id = Column(UUID(as_uuid=True), ForeignKey("wallets.child_id"), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.utcnow, nullable=False)
    reason = Column(String, nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=True)

    wallet = relationship("Wallet", back_populates="transactions")
    contract = relationship("Contract")