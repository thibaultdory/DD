from datetime import date, datetime, timedelta
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
import logging # Import logging
from app.models import Contract, Task, task_assignments, RuleViolation, Wallet, WalletTransaction
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__) # Add logger instance

async def process_daily_rewards_for_date(target_date: date = None):
    """Process daily rewards for a specific date or today if no date provided."""
    if target_date is None:
        target_date = date.today()
    
    logger.info(f"🎯 SCHEDULER: Starting daily rewards processing for {target_date}")
    
    async with AsyncSessionLocal() as session:
        try:
            # Get active contracts for the target date
            result = await session.execute(
                select(Contract).where(
                    Contract.active == True,
                    Contract.start_date <= target_date,
                    Contract.end_date >= target_date
                )
            )
            contracts = result.scalars().all()
            logger.info(f"📋 SCHEDULER: Found {len(contracts)} active contracts to process on {target_date}")
            
            if not contracts:
                logger.info(f"✅ SCHEDULER: No active contracts found for {target_date} - processing complete")
                return {
                    "date": target_date.isoformat(),
                    "rewards_processed": 0,
                    "rewards_skipped": 0,
                    "total_amount_credited": 0.0
                }

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
                        Task.due_date == target_date
                    )
                )
                tasks = task_res.scalars().all()
                
                incomplete_tasks = [t for t in tasks if not t.completed]
                if incomplete_tasks:
                    logger.warning(f"❌ SCHEDULER: Child {child_id} has {len(incomplete_tasks)} incomplete tasks for {target_date} - no reward for contract {contract_id}")
                    for task in incomplete_tasks:
                        logger.debug(f"   📝 Incomplete task: '{task.title}' (ID: {task.id})")
                    rewards_skipped += 1
                    continue
                
                if tasks:
                    logger.info(f"✅ SCHEDULER: Child {child_id} completed all {len(tasks)} tasks for {target_date}")
                else:
                    logger.info(f"ℹ️  SCHEDULER: Child {child_id} has no tasks assigned for {target_date}")
                
                # Check rule violations
                violation_res = await session.execute(
                    select(RuleViolation).where(
                        RuleViolation.child_id == child_id,
                        RuleViolation.date == target_date
                    )
                )
                violations = violation_res.scalars().all()
                if violations:
                    logger.warning(f"❌ SCHEDULER: Child {child_id} had {len(violations)} rule violations on {target_date} - no reward for contract {contract_id}")
                    for violation in violations:
                        logger.debug(f"   ⚠️  Rule violation: {violation.description}")
                    rewards_skipped += 1
                    continue
                
                logger.info(f"✅ SCHEDULER: Child {child_id} has no rule violations for {target_date}")
                
                # Use atomic upsert to prevent duplicates
                try:
                    # Ensure wallet exists
                    wallet = await session.get(Wallet, child_id)
                    if not wallet:
                        logger.info(f"💰 SCHEDULER: Creating new wallet for child {child_id}")
                        wallet = Wallet(child_id=child_id, balance=0.0)
                        session.add(wallet)
                        await session.flush()  # Get the wallet ID
                    
                    # Use atomic upsert with ON CONFLICT DO NOTHING to prevent duplicates
                    upsert_query = text("""
                        INSERT INTO wallet_transactions (id, child_id, amount, reason, contract_id, date, date_only)
                        VALUES (gen_random_uuid(), :child_id, :amount, :reason, :contract_id, :date, :date_only)
                        ON CONFLICT ON CONSTRAINT uq_daily_reward_per_child_contract_date 
                        DO NOTHING
                        RETURNING id, amount
                    """)
                    
                    result = await session.execute(upsert_query, {
                        'child_id': child_id,
                        'amount': daily_reward,
                        'reason': 'Récompense journalière',
                        'contract_id': contract_id,
                        'date': datetime.now(),
                        'date_only': target_date
                    })
                    
                    inserted_row = result.fetchone()
                    
                    if inserted_row:
                        # Transaction was inserted (not a duplicate)
                        old_balance = wallet.balance
                        wallet.balance += daily_reward
                        new_balance = wallet.balance
                        
                        logger.info(f"💰 SCHEDULER: Credited €{daily_reward} to child {child_id} for contract {contract_id} (balance: €{old_balance:.2f} → €{new_balance:.2f})")
                        
                        rewards_processed += 1
                        total_amount_credited += daily_reward
                    else:
                        # Transaction already exists (duplicate prevented)
                        logger.info(f"⏭️  SCHEDULER: Reward already exists for child {child_id} on {target_date} for contract {contract_id} - skipping (prevented duplicate)")
                        rewards_skipped += 1
                        
                except IntegrityError as e:
                    # Fallback in case the constraint doesn't exist yet
                    logger.warning(f"⚠️  SCHEDULER: Integrity error (likely duplicate) for child {child_id} on {target_date} - skipping: {e}")
                    rewards_skipped += 1
                    await session.rollback()
                    continue

            await session.commit()
            
            # Final summary
            logger.info(f"🎉 SCHEDULER: Daily reward processing completed successfully!")
            logger.info(f"📊 SCHEDULER: Summary for {target_date}:")
            logger.info(f"   ✅ Rewards processed: {rewards_processed}")
            logger.info(f"   ❌ Rewards skipped: {rewards_skipped}")
            logger.info(f"   💰 Total amount credited: €{total_amount_credited:.2f}")
            
            return {
                "date": target_date.isoformat(),
                "rewards_processed": rewards_processed,
                "rewards_skipped": rewards_skipped,
                "total_amount_credited": total_amount_credited
            }
            
        except Exception as e:
            logger.error(f"💥 SCHEDULER: Error during daily reward processing: {e}", exc_info=True)
            await session.rollback()
            raise

async def process_daily_rewards():
    """Process daily rewards for yesterday (used by scheduler running at midnight)."""
    # When running at midnight, we want to process rewards for the day that just ended
    yesterday = date.today() - timedelta(days=1)
    logger.info(f"🌙 SCHEDULER: Running at midnight - processing rewards for yesterday ({yesterday})")
    return await process_daily_rewards_for_date(yesterday)