from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import date
import logging # Import logging

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.rule_violation import RuleViolation
from app.schemas import RuleViolationCreate
from app.models.user import User

logger = logging.getLogger(__name__) # Add logger instance
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
async def get_violations(parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RuleViolation))
    violations = result.scalars().all()
    return [serialize_violation(v) for v in violations]

@router.get("/rule-violations/child/{child_id}")
async def get_child_violations(child_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Allow parents to access any child's violations, or children to access their own violations
    if not (current_user.is_parent or current_user.id == child_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    result = await db.execute(select(RuleViolation).where(RuleViolation.child_id == child_id))
    violations = result.scalars().all()
    return [serialize_violation(v) for v in violations]

@router.get("/rule-violations/date/{date_str}")
async def get_date_violations(date_str: str, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    try:
        day = date.fromisoformat(date_str)
    except ValueError as e:
        logger.warning(f"Invalid date format received: {date_str}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format")
    result = await db.execute(select(RuleViolation).where(RuleViolation.date == day))
    violations = result.scalars().all()
    return [serialize_violation(v) for v in violations]

@router.post("/rule-violations")
async def create_violation(v_in: RuleViolationCreate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    try:
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
        logger.info(f"Created rule violation for child {v_in.childId} on {v_in.date} (Rule ID: {v_in.ruleId})")
        return serialize_violation(violation)
    except Exception as e:
        logger.error(f"Failed to create rule violation: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create rule violation")

@router.delete("/rule-violations/{violation_id}")
async def delete_violation(violation_id: UUID, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    violation = await db.get(RuleViolation, violation_id)
    if not violation:
        logger.warning(f"Delete attempt on non-existent rule violation: {violation_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    try:
        await db.delete(violation)
        await db.commit()
        logger.info(f"Successfully deleted rule violation {violation_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to delete rule violation {violation_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete rule violation")

@router.get("/rule-violations/calendar")
async def get_violations_for_calendar(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Get all rule violations for calendar view.
    Parents can see and modify all violations.
    Children can see all violations but can only view their own violations (read-only).
    """
    result = await db.execute(select(RuleViolation))
    violations = result.scalars().all()
    
    serialized_violations = []
    for violation in violations:
        violation_data = serialize_violation(violation)
        # Add permission flag for frontend
        if current_user.is_parent:
            violation_data["canModify"] = True
        else:
            # Children can only view their own violations (read-only)
            is_assigned = str(current_user.id) == violation_data["childId"]
            violation_data["canModify"] = False  # Always read-only for children
            violation_data["canView"] = is_assigned
        
        serialized_violations.append(violation_data)
    
    return serialized_violations

@router.get("/rule-violations/calendar/range")
async def get_violations_for_calendar_range(
    start_date: str = Query(..., description="Start date for the range (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date for the range (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Get rule violations for calendar view within a specific date range.
    More efficient than fetching all violations when only viewing a specific period.
    """
    from fastapi import Query
    
    # Parse and validate dates
    try:
        start_dt = date.fromisoformat(start_date)
        end_dt = date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD format."
        )
    
    if start_dt > end_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    # Get violations within the date range
    stmt = select(RuleViolation).where(
        RuleViolation.date >= start_dt,
        RuleViolation.date <= end_dt
    )
    result = await db.execute(stmt)
    violations = result.scalars().all()
    
    serialized_violations = []
    for violation in violations:
        violation_data = serialize_violation(violation)
        # Add permission flag for frontend
        if current_user.is_parent:
            violation_data["canModify"] = True
        else:
            # Children can only view their own violations (read-only)
            is_assigned = str(current_user.id) == violation_data["childId"]
            violation_data["canModify"] = False  # Always read-only for children
            violation_data["canView"] = is_assigned
        
        serialized_violations.append(violation_data)
    
    return serialized_violations
