from datetime import date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
import logging # Import logging
from app.models import Contract, Task, task_assignments, RuleViolation, Wallet, WalletTransaction
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__) # Add logger instance

async def process_daily_rewards():
    """Process daily rewards for all active contracts."""
    today = date.today()
    start_time = date.today()
    
    logger.info(f"🎯 SCHEDULER: Starting daily rewards processing for {today}")
    
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
            logger.info(f"📋 SCHEDULER: Found {len(contracts)} active contracts to process on {today}")
            
            if not contracts:
                logger.info(f"✅ SCHEDULER: No active contracts found for {today} - processing complete")
                return

            rewards_processed = 0
            rewards_skipped = 0
            total_amount_credited = 0.0

            for contract in contracts:
                child_id = contract.child_id
                contract_id = contract.id
                daily_reward = contract.daily_reward
                
                logger.info(f"🔍 SCHEDULER: Processing contract {contract_id} (€{daily_reward}/day) for child {child_id}")
                
                # Check tasks
                task_res = await session.execute(
                    select(Task).join(task_assignments).where(
                        task_assignments.c.user_id == child_id,
                        Task.due_date == today
                    )
                )
                tasks = task_res.scalars().all()
                
                incomplete_tasks = [t for t in tasks if not t.completed]
                if incomplete_tasks:
                    logger.warning(f"❌ SCHEDULER: Child {child_id} has {len(incomplete_tasks)} incomplete tasks for {today} - no reward for contract {contract_id}")
                    for task in incomplete_tasks:
                        logger.debug(f"   📝 Incomplete task: '{task.title}' (ID: {task.id})")
                    rewards_skipped += 1
                    continue
                
                if tasks:
                    logger.info(f"✅ SCHEDULER: Child {child_id} completed all {len(tasks)} tasks for {today}")
                else:
                    logger.info(f"ℹ️  SCHEDULER: Child {child_id} has no tasks assigned for {today}")
                
                # Check rule violations
                violation_res = await session.execute(
                    select(RuleViolation).where(
                        RuleViolation.child_id == child_id,
                        RuleViolation.date == today
                    )
                )
                violations = violation_res.scalars().all()
                if violations:
                    logger.warning(f"❌ SCHEDULER: Child {child_id} had {len(violations)} rule violations on {today} - no reward for contract {contract_id}")
                    for violation in violations:
                        logger.debug(f"   ⚠️  Rule violation: {violation.description}")
                    rewards_skipped += 1
                    continue
                
                logger.info(f"✅ SCHEDULER: Child {child_id} has no rule violations for {today}")
                
                # Credit wallet
                wallet = await session.get(Wallet, child_id)
                if not wallet:
                    logger.info(f"💰 SCHEDULER: Creating new wallet for child {child_id}")
                    wallet = Wallet(child_id=child_id, balance=0.0)
                    session.add(wallet)
                    await session.flush()  # Get the wallet ID
                
                old_balance = wallet.balance
                wallet.balance += daily_reward
                new_balance = wallet.balance
                
                transaction = WalletTransaction(
                    child_id=child_id,
                    amount=daily_reward,
                    reason="Récompense journalière",
                    contract_id=contract_id
                )
                session.add(transaction)
                
                logger.info(f"💰 SCHEDULER: Credited €{daily_reward} to child {child_id} for contract {contract_id} (balance: €{old_balance:.2f} → €{new_balance:.2f})")
                
                rewards_processed += 1
                total_amount_credited += daily_reward

            await session.commit()
            
            # Final summary
            logger.info(f"🎉 SCHEDULER: Daily reward processing completed successfully!")
            logger.info(f"📊 SCHEDULER: Summary for {today}:")
            logger.info(f"   ✅ Rewards processed: {rewards_processed}")
            logger.info(f"   ❌ Rewards skipped: {rewards_skipped}")
            logger.info(f"   💰 Total amount credited: €{total_amount_credited:.2f}")
            
        except Exception as e:
            logger.error(f"💥 SCHEDULER: Error during daily reward processing: {e}", exc_info=True)
            await session.rollback()
            raise