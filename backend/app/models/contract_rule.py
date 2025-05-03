import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.contract import Contract

class ContractRule(Base):
    __tablename__ = "contract_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    description = Column(String, nullable=False)
    is_task = Column(Boolean, default=False, nullable=False)

    contract = relationship("Contract", back_populates="rules")