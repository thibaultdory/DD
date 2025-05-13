import uuid
from datetime import date, datetime
from sqlalchemy import Column, String, Date, Boolean, DateTime, Table, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

class TaskSeries(Base):
    __tablename__ = "task_series"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    until_date = Column(Date, nullable=True)  # null = no end
    rrule = Column(Text, nullable=False)  # RFC-5545 RRULE (e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR")
    timezone = Column(String, nullable=False, default="Europe/Brussels")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    creator = relationship("User", foreign_keys=[creator_id])
    assignees = relationship("User", secondary="task_series_assignees", back_populates="assigned_task_series")
    occurrences = relationship("TaskOccurrence", back_populates="series", cascade="all, delete-orphan")

task_series_assignees = Table(
    "task_series_assignees",
    Base.metadata,
    Column("series_id", UUID(as_uuid=True), ForeignKey("task_series.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

class TaskOccurrence(Base):
    __tablename__ = "task_occurrences"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id = Column(UUID(as_uuid=True), ForeignKey("task_series.id", ondelete="CASCADE"), nullable=False)
    due_date = Column(Date, nullable=False, index=True) # Added index=True
    completed = Column(Boolean, default=False, nullable=False)
    cancelled = Column(Boolean, default=False, nullable=False)  # for “delete one occurrence”
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    series = relationship("TaskSeries", back_populates="occurrences")

    # Add a unique constraint for (series_id, due_date) as per the plan
    __table_args__ = (UniqueConstraint('series_id', 'due_date', name='_series_due_date_uc'),)
