import uuid
from datetime import date
from sqlalchemy import Column, String, Date, Boolean, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    child_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    daily_reward = Column(Float, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    # Many-to-many relationship with rules
    rules = relationship("Rule", secondary="contract_rules", back_populates="contracts")
