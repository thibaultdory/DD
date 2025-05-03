import uuid
from datetime import date
from sqlalchemy import Column, String, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

import uuid
from sqlalchemy import Column, String, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class RuleViolation(Base):
    __tablename__ = "rule_violations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("contract_rules.id"), nullable=False)
    child_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=True)
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    child = relationship("User", foreign_keys=[child_id])
    reporter = relationship("User", foreign_keys=[reported_by])
    contract = relationship("Contract", foreign_keys=[rule_id])