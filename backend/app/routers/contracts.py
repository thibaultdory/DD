from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import require_parent
from app.models.contract import Contract
from app.models.contract_rule import ContractRule
from app.schemas import ContractCreate, ContractUpdate, ContractRuleCreate

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
    result = await db.execute(select(Contract))
    contracts = result.scalars().all()
    return [serialize_contract(c) for c in contracts]

@router.get("/contracts/{contract_id}")
async def get_contract(contract_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return serialize_contract(contract)

@router.get("/contracts/child/{child_id}")
async def get_child_contracts(child_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contract).where(Contract.child_id == child_id))
    contracts = result.scalars().all()
    return [serialize_contract(c) for c in contracts]

@router.post("/contracts")
async def create_contract(data: ContractCreate, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
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
    await db.flush()
    # add rules
    for r in data.rules:
        rule = ContractRule(description=r.description, is_task=r.isTask, contract=contract)
        db.add(rule)
    await db.commit()
    await db.refresh(contract)
    return serialize_contract(contract)

@router.put("/contracts/{contract_id}")
async def update_contract(contract_id: UUID, data: ContractUpdate, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    updates = data.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(contract, field.lower() if field != 'dailyReward' else 'daily_reward', value)
    await db.commit()
    await db.refresh(contract)
    return serialize_contract(contract)

@router.put("/contracts/{contract_id}/deactivate")
async def deactivate_contract(contract_id: UUID, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    contract.active = False
    await db.commit()
    await db.refresh(contract)
    return serialize_contract(contract)
