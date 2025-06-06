import uuid
from datetime import date, datetime
from sqlalchemy import Column, String, Date, Boolean, DateTime, Table, ForeignKey, ARRAY, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base

# Association table between tasks and users
task_assignments = Table(
    "task_assignments",
    Base.metadata,
    Column("task_id", UUID(as_uuid=True), ForeignKey("tasks.id"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    due_date = Column(Date, nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Champs pour la récurrence
    is_recurring = Column(Boolean, default=False, nullable=False)
    # Stocke les jours de la semaine (1-7 pour lundi-dimanche)
    weekdays = Column(ARRAY(Integer), nullable=True)
    # Date de fin pour les tâches récurrentes
    end_date = Column(Date, nullable=True)
    # ID de la tâche parente si c'est une instance d'une tâche récurrente
    parent_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True)

    assigned_to = relationship("User", secondary=task_assignments, back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[created_by])
    # Relation avec les instances de tâches récurrentes
    recurring_instances = relationship("Task", backref="parent_task", remote_side=[id])
