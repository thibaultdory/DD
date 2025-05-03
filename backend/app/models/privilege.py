import uuid
from datetime import date
from sqlalchemy import Column, String, Boolean, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class Privilege(Base):
    __tablename__ = "privileges"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    earned = Column(Boolean, default=False, nullable=False)
    date = Column(Date, nullable=False)

    user = relationship("User", foreign_keys=[assigned_to])