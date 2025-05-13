from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import date

from dateutil.relativedelta import relativedelta

class TaskCreate(BaseModel):
    title: str
    description: Optional[str]
    assignedTo: List[UUID]
    dueDate: date  # Pour les tâches récurrentes, c'est la date de début
    isRecurring: bool = False
    weekdays: Optional[List[int]] = None  # 1-7 pour lundi-dimanche
    endDate: Optional[date] = None  # Pour les tâches récurrentes, date de fin optionnelle (par défaut 1 an)

class TaskUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    assignedTo: Optional[List[UUID]]
    dueDate: Optional[date]
    completed: Optional[bool]
    isRecurring: Optional[bool]
    weekdays: Optional[List[int]]  # 1-7 pour lundi-dimanche


class TaskSeriesCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignedTo: List[UUID]
    startDate: date
    endDate: Optional[date] = None # For UNTIL part of rrule
    # Instead of rrule directly, take weekdays for FREQ=WEEKLY as per plan example
    weekdays: List[int] # 1-7 for Mon-Sun, to be converted to BYDAY=MO,TU...
    timezone: Optional[str] = 'Europe/Brussels'

class TaskSeriesUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignedTo: Optional[List[UUID]] = None
    startDate: Optional[date] = None
    endDate: Optional[date] = None # Use None to remove UNTIL
    weekdays: Optional[List[int]] = None
    timezone: Optional[str] = None

class TaskOccurrenceUpdate(BaseModel):
    completed: Optional[bool] = None
    cancelled: Optional[bool] = None

# Schema for reading tasks (can be one-off or an occurrence)
class TaskRead(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    assignedTo: List[UUID] # In new model, this would be from TaskSeries.assignees
    dueDate: date
    completed: bool
    createdBy: Optional[UUID] # For one-off tasks
    createdAt: str # datetime isoformat
    isRecurring: bool # True if it's part of a series
    seriesId: Optional[UUID] = None # If part of a series
    parentTaskId: Optional[UUID] = None # Legacy, to be removed
    weekdays: Optional[List[int]] = None # Legacy, to be removed
    cancelled: Optional[bool] = None # For occurrences

    class Config:
        orm_mode = True

class PrivilegeCreate(BaseModel):
    title: str
    description: Optional[str]
    assignedTo: UUID
    date: date
    earned: bool = False

class PrivilegeUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    assignedTo: Optional[UUID]
    earned: Optional[bool]
    date: Optional[date]

class RuleViolationCreate(BaseModel):
    ruleId: str
    childId: UUID
    date: date
    description: Optional[str]
    reportedBy: UUID

class ContractRuleCreate(BaseModel):
    description: str
    isTask: bool

class ContractCreate(BaseModel):
    title: str
    childId: UUID
    parentId: UUID
    rules: List[ContractRuleCreate]
    dailyReward: float
    startDate: date
    endDate: date

class ContractUpdate(BaseModel):
    title: Optional[str]
    childId: Optional[UUID]
    parentId: Optional[UUID]
    dailyReward: Optional[float]
    startDate: Optional[date]
    endDate: Optional[date]
    active: Optional[bool]

class ConvertRequest(BaseModel):
    amount: float