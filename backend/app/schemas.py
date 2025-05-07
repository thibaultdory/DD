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
    ruleId: UUID
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