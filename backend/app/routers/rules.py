from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import logging
from app.core.database import get_db
from app.core.dependencies import require_parent, get_current_user
from app.models.rule import Rule
from app.schemas import RuleCreate, RuleUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

def serialize_rule(rule: Rule):
    return {
        "id": str(rule.id),
        "description": rule.description,
        "isTask": rule.is_task,
        "active": rule.active
    }

@router.get("/rules")
async def get_rules(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve all active rules"""
    result = await db.execute(select(Rule).where(Rule.active == True))
    rules = result.scalars().all()
    return [serialize_rule(rule) for rule in rules]

@router.get("/rules/{rule_id}")
async def get_rule(rule_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve a single rule by ID"""
    rule = await db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return serialize_rule(rule)

@router.post("/rules")
async def create_rule(data: RuleCreate, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    """Create a new rule (parents only)"""
    try:
        rule = Rule(
            description=data.description,
            is_task=data.isTask,
            active=True
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
        logger.info(f"Created rule '{data.description}'")
        return serialize_rule(rule)
    except Exception as e:
        logger.error(f"Failed to create rule: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create rule")

@router.put("/rules/{rule_id}")
async def update_rule(rule_id: UUID, data: RuleUpdate, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    """Update a rule (parents only)"""
    rule = await db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    
    try:
        updates = data.dict(exclude_unset=True)
        for field, value in updates.items():
            # Convert camelCase to snake_case
            model_field = field
            if field == 'isTask':
                model_field = 'is_task'
            
            if hasattr(rule, model_field):
                setattr(rule, model_field, value)
        
        await db.commit()
        await db.refresh(rule)
        logger.info(f"Updated rule {rule_id}")
        return serialize_rule(rule)
    except Exception as e:
        logger.error(f"Failed to update rule {rule_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update rule")

@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    """Delete a rule (parents only) - soft delete by setting active=False"""
    rule = await db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    
    try:
        # Soft delete - just mark as inactive
        rule.active = False
        await db.commit()
        logger.info(f"Deactivated rule {rule_id}")
        return {"message": "Rule deactivated successfully", "ruleId": str(rule_id)}
    except Exception as e:
        logger.error(f"Failed to deactivate rule {rule_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to deactivate rule")
