from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.wallet import Wallet, WalletTransaction
from app.schemas import ConvertRequest
from datetime import datetime

router = APIRouter()

def serialize_transaction(tx):
    return {
        "id": str(tx.id),
        "childId": str(tx.child_id),
        "amount": tx.amount,
        "date": tx.date.isoformat(),
        "reason": tx.reason,
        "contractId": str(tx.contract_id) if tx.contract_id else None,
    }

@router.get("/wallets/{child_id}")
async def get_wallet(child_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Only parent or the child themselves can view
    if not (current_user.is_parent or current_user.id == child_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    wallet = await db.get(Wallet, child_id)
    if not wallet:
        wallet = Wallet(child_id=child_id, balance=0.0)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    # fetch transactions
    await db.refresh(wallet)
    return {
        "childId": str(wallet.child_id),
        "balance": wallet.balance,
        "transactions": [serialize_transaction(t) for t in wallet.transactions]
    }

@router.get("/wallets/{child_id}/transactions")
async def get_wallet_transactions(child_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not (current_user.is_parent or current_user.id == child_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    result = await db.execute(select(WalletTransaction).where(WalletTransaction.child_id == child_id))
    txs = result.scalars().all()
    return [serialize_transaction(tx) for tx in txs]

@router.post("/wallets/{child_id}/convert")
async def convert_wallet(child_id: UUID, req: ConvertRequest, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    wallet = await db.get(Wallet, child_id)
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")
    amount = req.amount
    if amount <= 0 or amount > wallet.balance:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid amount")
    wallet.balance -= amount
    tx = WalletTransaction(
        child_id=child_id,
        amount=-amount,
        reason="Conversion en euros réels",
        contract_id=None,
        date=datetime.utcnow()
    )
    db.add(tx)
    await db.commit()
    await db.refresh(wallet)
    return {
        "childId": str(wallet.child_id),
        "balance": wallet.balance,
        "transactions": [serialize_transaction(t) for t in wallet.transactions]
    }
