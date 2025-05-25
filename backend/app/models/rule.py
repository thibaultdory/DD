import uuid
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class Rule(Base):
    __tablename__ = "rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description = Column(String, nullable=False)
    is_task = Column(Boolean, default=False, nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    # Many-to-many relationship with contracts
    contracts = relationship("Contract", secondary="contract_rules", back_populates="rules") 