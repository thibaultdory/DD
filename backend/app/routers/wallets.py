from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.wallet import Wallet, WalletTransaction
from app.schemas import ConvertRequest, ReprocessRequest
from app.core.jobs import process_daily_rewards_for_date
from datetime import datetime, date, timedelta
import logging

router = APIRouter()
logger = logging.getLogger(__name__) # Add logger instance

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
        logger.warning(f"Unauthorized wallet access attempt for child {child_id} by user {current_user.id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    wallet = await db.get(Wallet, child_id)
    if not wallet:
        logger.info(f"Wallet not found for child {child_id}, creating a new one.")
        try:
            wallet = Wallet(child_id=child_id, balance=0.0)
            db.add(wallet)
            await db.commit()
            await db.refresh(wallet)
            logger.info(f"Successfully created wallet for child {child_id}")
        except Exception as e:
            logger.error(f"Failed to create wallet for child {child_id}: {e}", exc_info=True)
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create wallet")
    
    # Fetch transactions (refresh needed even if wallet existed)
    try:
        await db.refresh(wallet, attribute_names=['transactions']) # Explicitly refresh transactions
    except Exception as e:
        # Log error but proceed, maybe return empty transactions?
        logger.error(f"Failed to refresh wallet transactions for child {child_id}: {e}", exc_info=True)
        # Depending on requirements, might want to raise 500 or return partial data
        # For now, return potentially stale/empty transactions

    return {
        "childId": str(wallet.child_id),
        "balance": wallet.balance,
        "transactions": [serialize_transaction(t) for t in wallet.transactions] # This might be empty if refresh failed
    }

@router.get("/wallets/{child_id}/transactions")
async def get_wallet_transactions(child_id: UUID, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not (current_user.is_parent or current_user.id == child_id):
        logger.warning(f"Unauthorized transaction access attempt for child {child_id} by user {current_user.id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        result = await db.execute(select(WalletTransaction).where(WalletTransaction.child_id == child_id))
        txs = result.scalars().all()
        return [serialize_transaction(tx) for tx in txs]
    except Exception as e:
        logger.error(f"Failed to retrieve transactions for child {child_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve transactions")

@router.post("/wallets/{child_id}/convert")
async def convert_wallet(child_id: UUID, req: ConvertRequest, parent=Depends(require_parent), db: AsyncSession = Depends(get_db)):
    wallet = await db.get(Wallet, child_id)
    if not wallet:
        logger.warning(f"Convert attempt on non-existent wallet for child: {child_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")
    
    amount = req.amount
    if amount <= 0 or amount > wallet.balance:
        logger.warning(f"Invalid conversion amount requested for child {child_id}: {amount} (Balance: {wallet.balance})")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid amount")

    try:
        logger.info(f"Converting {amount} from wallet {child_id}")
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
        await db.refresh(wallet, attribute_names=['transactions']) # Refresh wallet and transactions
        logger.info(f"Successfully converted {amount} for child {child_id}. New balance: {wallet.balance}")
        return {
            "childId": str(wallet.child_id),
            "balance": wallet.balance,
            "transactions": [serialize_transaction(t) for t in wallet.transactions]
        }
    except Exception as e:
        logger.error(f"Failed to convert amount {amount} for child {child_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process conversion")

@router.post("/admin/reprocess-rewards")
async def reprocess_rewards(
    req: ReprocessRequest,
    parent=Depends(require_parent),
    db: AsyncSession = Depends(get_db)
):
    """Reprocess daily rewards for a date range (admin/parent only)."""
    start_date = req.startDate
    end_date = req.endDate
    
    # Validate date range
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before or equal to end date"
        )
    
    # Limit to reasonable date range (e.g., max 30 days)
    if (end_date - start_date).days > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 30 days"
        )
    
    # Don't allow future dates
    today = date.today()
    if start_date > today or end_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reprocess rewards for future dates"
        )
    
    logger.info(f"🔄 ADMIN: Parent {parent.id} requested reprocessing rewards from {start_date} to {end_date}")
    
    try:
        results = []
        current_date = start_date
        
        while current_date <= end_date:
            logger.info(f"🔄 ADMIN: Reprocessing rewards for {current_date}")
            result = await process_daily_rewards_for_date(current_date)
            results.append(result)
            current_date += timedelta(days=1)
        
        # Calculate totals
        total_processed = sum(r["rewards_processed"] for r in results)
        total_skipped = sum(r["rewards_skipped"] for r in results)
        total_amount = sum(r["total_amount_credited"] for r in results)
        
        logger.info(f"✅ ADMIN: Reprocessing completed. Total: {total_processed} processed, {total_skipped} skipped, €{total_amount:.2f} credited")
        
        return {
            "success": True,
            "message": f"Reprocessed rewards from {start_date} to {end_date}",
            "summary": {
                "total_rewards_processed": total_processed,
                "total_rewards_skipped": total_skipped,
                "total_amount_credited": total_amount,
                "days_processed": len(results)
            },
            "daily_results": results
        }
        
    except Exception as e:
        logger.error(f"💥 ADMIN: Error during reward reprocessing: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reprocess rewards"
        )
