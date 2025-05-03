from datetime import date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Contract, Task, task_assignments, RuleViolation, Wallet, WalletTransaction
from app.core.database import AsyncSessionLocal

async def process_daily_rewards():
    today = date.today()
    async with AsyncSessionLocal() as session:
        # Get active contracts for today
        result = await session.execute(
            select(Contract).where(
                Contract.active == True,
                Contract.start_date <= today,
                Contract.end_date >= today
            )
        )
        contracts = result.scalars().all()
        for contract in contracts:
            child_id = contract.child_id
            # Check tasks
            task_res = await session.execute(
                select(Task).join(task_assignments).where(
                    task_assignments.c.user_id == child_id,
                    Task.due_date == today
                )
            )
            tasks = task_res.scalars().all()
            if any(not t.completed for t in tasks):
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
                continue
            # Credit wallet
            wallet = await session.get(Wallet, child_id)
            if not wallet:
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
        await session.commit()