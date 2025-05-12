from datetime import date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
import logging # Import logging
from app.models import Contract, Task, task_assignments, RuleViolation, Wallet, WalletTransaction
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__) # Add logger instance
async def process_daily_rewards():
    today = date.today()
    async with AsyncSessionLocal() as session:
        try:
            # Get active contracts for today
            result = await session.execute(
                select(Contract).where(
                    Contract.active == True,
                    Contract.start_date <= today,
                    Contract.end_date >= today
                )
            )
            contracts = result.scalars().all()
            logger.info(f"Processing daily rewards for {len(contracts)} active contracts on {today}.")

            for contract in contracts:
                child_id = contract.child_id
                logger.debug(f"Processing contract {contract.id} for child {child_id}.")
                # Check tasks
                task_res = await session.execute(
                    select(Task).join(task_assignments).where(
                        task_assignments.c.user_id == child_id,
                        Task.due_date == today
                    )
                )
                tasks = task_res.scalars().all()
                if any(not t.completed for t in tasks):
                    logger.info(f"Child {child_id} did not complete all tasks for {today}. No reward for contract {contract.id}.")
                    continue
                
                # Check rule violations
                violation_res = await session.execute(
                    select(RuleViolation).where(
                        RuleViolation.child_id == child_id,
                        RuleViolation.date == today
                    )
                )
                violations = violation_res.scalars().all()
                if violations:
                    logger.info(f"Child {child_id} had {len(violations)} rule violations on {today}. No reward for contract {contract.id}.")
                    continue
                
                # Credit wallet
                wallet = await session.get(Wallet, child_id)
                if not wallet:
                    logger.info(f"Creating wallet for child {child_id}.")
                    wallet = Wallet(child_id=child_id, balance=0.0)
                    session.add(wallet)
                
                wallet.balance += contract.daily_reward
                transaction = WalletTransaction(
                    child_id=child_id,
                    amount=contract.daily_reward,
                    reason="Récompense journalière",
                    contract_id=contract.id
                )
                session.add(transaction)
                logger.info(f"Credited {contract.daily_reward} to child {child_id} for contract {contract.id}.")

            await session.commit()
            logger.info("Daily reward processing completed successfully.")
        except Exception as e:
            logger.error(f"Error during daily reward processing: {e}", exc_info=True)
            await session.rollback() # Rollback in case of error
            raise # Re-raise the exception if needed, or handle appropriately