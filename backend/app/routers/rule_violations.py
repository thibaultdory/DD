from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.rule_violation import RuleViolation
from app.schemas import RuleViolationCreate

router = APIRouter()

def serialize_violation(v: RuleViolation):
    return {
        "id": str(v.id),
        "ruleId": str(v.rule_id),
        "childId": str(v.child_id),
        "date": v.date.isoformat(),
        "description": v.description,
        "reportedBy": str(v.reported_by),
    }

@router.get("/rule-violations")
async def get_violations(parent: Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RuleViolation))
    violations = result.scalars().all()
    return [serialize_violation(v) for v in violations]

@router.get("/rule-violations/child/{child_id}")
async def get_child_violations(child_id: UUID, parent: Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RuleViolation).where(RuleViolation.child_id == child_id))
    violations = result.scalars().all()
    return [serialize_violation(v) for v in violations]

@router.get("/rule-violations/date/{date_str}")
async def get_date_violations(date_str: str, parent: Depends(require_parent), db: AsyncSession = Depends(get_db)):
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format")
    result = await db.execute(select(RuleViolation).where(RuleViolation.date == day))
    violations = result.scalars().all()
    return [serialize_violation(v) for v in violations]

@router.post("/rule-violations")
async def create_violation(v_in: RuleViolationCreate, parent: Depends(require_parent), db: AsyncSession = Depends(get_db)):
    violation = RuleViolation(
        rule_id=v_in.ruleId,
        child_id=v_in.childId,
        date=v_in.date,
        description=v_in.description,
        reported_by=v_in.reportedBy,
    )
    db.add(violation)
    await db.commit()
    await db.refresh(violation)
    return serialize_violation(violation)

@router.delete("/rule-violations/{violation_id}")
async def delete_violation(violation_id: UUID, parent: Depends(require_parent), db: AsyncSession = Depends(get_db)):
    violation = await db.get(RuleViolation, violation_id)
    if not violation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    await db.delete(violation)
    await db.commit()
    return {"success": True}
