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
    endDate: Optional[date] = None  # Pour les tâches récurrentes, date de fin optionnelle

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

class RuleCreate(BaseModel):
    description: str
    isTask: bool

class RuleUpdate(BaseModel):
    description: Optional[str]
    isTask: Optional[bool]
    active: Optional[bool]

class ContractCreate(BaseModel):
    title: str
    childId: UUID
    parentId: UUID
    ruleIds: List[UUID]  # Changed from embedded rules to rule IDs
    dailyReward: float
    startDate: date
    endDate: date

class ContractUpdate(BaseModel):
    title: Optional[str]
    childId: Optional[UUID]
    parentId: Optional[UUID]
    ruleIds: Optional[List[UUID]]  # Changed from embedded rules to rule IDs
    dailyReward: Optional[float]
    startDate: Optional[date]
    endDate: Optional[date]
    active: Optional[bool]

class ConvertRequest(BaseModel):
    amount: float
    comment: Optional[str] = None

class ReprocessRequest(BaseModel):
    startDate: date
    endDate: date

class Comparison(BaseModel):
    current: float
    previous: float

class AnalyticsResponse(BaseModel):
    perfectDays: Comparison
    longestStreak: Comparison
    taskCompletionRate: Comparison  # Percentage 0-100
    infractions: Comparison
    privilegesEarned: Comparison
    rewardsEarned: Comparison