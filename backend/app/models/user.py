import uuid
from datetime import date
from sqlalchemy import Column, String, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base
from sqlalchemy.orm import relationship
from app.models.task import task_assignments

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)
    assigned_tasks = relationship("Task", secondary=task_assignments, back_populates="assigned_to")
    is_parent = Column(Boolean, nullable=False)
    profile_picture = Column(String, nullable=True)