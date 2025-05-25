from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from uuid import UUID
import logging # Import logging
from app.core.database import get_db
from app.core.dependencies import require_parent
from app.models.contract import Contract
from app.models.contract_rule import ContractRule
from app.models.wallet import WalletTransaction
from app.schemas import ContractCreate, ContractUpdate, ContractRuleCreate

logger = logging.getLogger(__name__) # Add logger instance
router = APIRouter()

def serialize_contract(contract: Contract):
    return {
        "id": str(contract.id),
        "title": contract.title,
        "childId": str(contract.child_id),
        "parentId": str(contract.parent_id),
        "dailyReward": contract.daily_reward,
        "startDate": contract.start_date.isoformat(),
        "endDate": contract.end_date.isoformat(),
        "active": contract.active,
        "rules": [
            {"id": str(rule.id), "description": rule.description, "isTask": rule.is_task}
            for rule in contract.rules
        ],
    }

@router.get("/contracts")
async def get_contracts(parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).options(selectinload(Contract.rules)))
    contracts = result.scalars().all()
    return [serialize_contract(c) for c in contracts]

@router.get("/contracts/{contract_id}")
async def get_contract(contract_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return serialize_contract(contract)

@router.get("/contracts/child/{child_id}")
async def get_child_contracts(child_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.child_id == child_id))
    contracts = result.scalars().all()
    return [serialize_contract(c) for c in contracts]

@router.post("/contracts")
async def create_contract(data: ContractCreate, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    try:
        contract = Contract(
            title=data.title,
            child_id=data.childId,
            parent_id=data.parentId,
            daily_reward=data.dailyReward,
            start_date=data.startDate,
            end_date=data.endDate,
            active=True,
        )
        db.add(contract)
        await db.flush() # Flush to get the contract ID for rules
        logger.info(f"Creating contract '{data.title}' for child {data.childId}")

        # add rules
        for r in data.rules:
            rule = ContractRule(description=r.description, is_task=r.isTask, contract_id=contract.id)
            db.add(rule)
            logger.debug(f"Adding rule '{r.description}' to contract {contract.id}")
        
        await db.commit()
        
        # Reload the contract with rules using eager loading
        result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract.id))
        contract = result.scalar_one()
        
        logger.info(f"Successfully created contract {contract.id}")
        return serialize_contract(contract)
    except Exception as e:
        logger.error(f"Failed to create contract: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create contract")

@router.put("/contracts/{contract_id}")
async def update_contract(contract_id: UUID, data: ContractUpdate, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        logger.warning(f"Update attempt on non-existent contract: {contract_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    try:
        updates = data.dict(exclude_unset=True)
        logger.info(f"Updating contract {contract_id} with data: {updates}")
        for field, value in updates.items():
            # Adjust field names from schema (camelCase) to model (snake_case)
            model_field = field
            if field == 'dailyReward':
                model_field = 'daily_reward'
            elif field == 'startDate':
                model_field = 'start_date'
            elif field == 'endDate':
                model_field = 'end_date'
            elif field == 'childId':
                model_field = 'child_id'
            elif field == 'parentId':
                 model_field = 'parent_id'
            
            if hasattr(contract, model_field):
                setattr(contract, model_field, value)
            else:
                logger.warning(f"Attempted to update non-existent field '{model_field}' (from '{field}') on contract {contract_id}")

        await db.commit()
        
        # Reload the contract with rules using eager loading
        result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract.id))
        contract = result.scalar_one()
        
        logger.info(f"Successfully updated contract {contract_id}")
        return serialize_contract(contract)
    except Exception as e:
        logger.error(f"Failed to update contract {contract_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update contract")

@router.put("/contracts/{contract_id}/deactivate")
async def deactivate_contract(contract_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        logger.warning(f"Deactivation attempt on non-existent contract: {contract_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    try:
        contract.active = False
        await db.commit()
        
        # Reload the contract with rules using eager loading
        result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract.id))
        contract = result.scalar_one()
        
        logger.info(f"Successfully deactivated contract {contract_id}")
        return serialize_contract(contract)
    except Exception as e:
        logger.error(f"Failed to deactivate contract {contract_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to deactivate contract")

@router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).options(selectinload(Contract.rules)).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        logger.warning(f"Delete attempt on non-existent contract: {contract_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    
    try:
        logger.info(f"Deleting contract {contract_id} ('{contract.title}')")
        
        # First, update wallet transactions to remove the contract reference
        # This prevents foreign key constraint violations
        await db.execute(
            update(WalletTransaction)
            .where(WalletTransaction.contract_id == contract_id)
            .values(contract_id=None)
        )
        logger.debug(f"Updated wallet transactions to remove contract reference for contract {contract_id}")
        
        # Delete the contract (rules will be automatically deleted due to cascade)
        await db.delete(contract)
        await db.commit()
        
        logger.info(f"Successfully deleted contract {contract_id}")
        return {"message": "Contract deleted successfully", "contractId": str(contract_id)}
    except Exception as e:
        logger.error(f"Failed to delete contract {contract_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete contract")
