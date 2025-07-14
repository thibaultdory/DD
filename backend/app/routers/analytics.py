from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import logging
from typing import Dict

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.task import Task, task_assignments
from app.models.rule_violation import RuleViolation
from app.models.privilege import Privilege
from app.models.wallet import WalletTransaction
from app.models.user import User
from app.schemas import AnalyticsResponse, Comparison

logger = logging.getLogger(__name__)
router = APIRouter()


async def _calculate_stats(child_id: UUID, start: date, end: date, db: AsyncSession) -> Dict[str, float]:
    """Return dict with stats for given period [start, end]."""
    # ---------------------------------------------------------------------
    # Tasks completion
    # ---------------------------------------------------------------------
    task_stmt = (
        select(Task.completed, Task.due_date)
        .join(task_assignments)
        .where(
            task_assignments.c.user_id == child_id,
            Task.due_date >= start,
            Task.due_date <= end,
        )
    )
    result = await db.execute(task_stmt)
    rows = result.all()
    total_tasks = len(rows)
    completed_tasks = sum(1 for r in rows if r.completed)

    # Tasks grouped by day for perfect day & streak calculation
    tasks_by_day: Dict[date, list] = {}
    for completed, due_date in rows:
        tasks_by_day.setdefault(due_date, []).append(completed)

    # ---------------------------------------------------------------------
    # Rule violations
    # ---------------------------------------------------------------------
    viol_stmt = select(RuleViolation.date).where(
        RuleViolation.child_id == child_id,
        RuleViolation.date >= start,
        RuleViolation.date <= end,
    )
    viol_res = await db.execute(viol_stmt)
    violation_dates = {row[0] for row in viol_res.all()}
    infractions = len(violation_dates)

    # ---------------------------------------------------------------------
    # Privileges earned
    # ---------------------------------------------------------------------
    priv_stmt = select(func.count()).select_from(Privilege).where(
        Privilege.assigned_to == child_id,
        Privilege.earned == True,  # noqa: E712
        Privilege.date >= start,
        Privilege.date <= end,
    )
    priv_res = await db.execute(priv_stmt)
    privileges_earned = priv_res.scalar_one()

    # ---------------------------------------------------------------------
    # Rewards earned (wallet transactions >0)
    # ---------------------------------------------------------------------
    reward_stmt = select(func.coalesce(func.sum(WalletTransaction.amount), 0.0)).where(
        WalletTransaction.child_id == child_id,
        WalletTransaction.amount > 0,
        func.date(WalletTransaction.date) >= start,
        func.date(WalletTransaction.date) <= end,
    )
    reward_res = await db.execute(reward_stmt)
    rewards_earned = reward_res.scalar_one() or 0.0

    # ---------------------------------------------------------------------
    # Perfect days & longest streak
    # ---------------------------------------------------------------------
    perfect_days = 0
    longest_streak = 0
    current_streak = 0

    current_day = start
    one_day = timedelta(days=1)
    while current_day <= end:
        # Determine if day is perfect
        day_tasks = tasks_by_day.get(current_day, [])
        if day_tasks and all(day_tasks) and current_day not in violation_dates:
            perfect_days += 1
            current_streak += 1
            longest_streak = max(longest_streak, current_streak)
        else:
            current_streak = 0
        current_day += one_day

    # Completion rate
    task_completion_rate = (completed_tasks / total_tasks * 100) if total_tasks else 0.0

    return {
        "perfect_days": perfect_days,
        "longest_streak": longest_streak,
        "task_completion_rate": task_completion_rate,
        "infractions": infractions,
        "privileges_earned": privileges_earned,
        "rewards_earned": rewards_earned,
    }


@router.get("/analytics/monthly", response_model=AnalyticsResponse)
async def get_monthly_analytics(
    month: str = Query(None, description="Month in YYYY-MM format. Defaults to current month."),
    child_id: UUID | None = Query(None, description="Child ID to fetch stats for. Defaults to current user."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated monthly analytics for a child with comparison to previous month."""
    # ------------------------------------------------------------------
    # Parse month parameter
    # ------------------------------------------------------------------
    today = date.today()
    if month:
        try:
            year, mon = map(int, month.split("-"))
            start = date(year, mon, 1)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month format. Use YYYY-MM")
    else:
        start = date(today.year, today.month, 1)

    # Determine child target
    if child_id:
        # Only parents can query other children
        if not (current_user.is_parent or current_user.id == child_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    else:
        child_id = current_user.id

    end = start + relativedelta(months=1) - timedelta(days=1)
    # If requesting current month, limit the end date to today to avoid future days skewing stats
    if start.year == today.year and start.month == today.month:
        if today < end:
            end = today
    prev_start = start - relativedelta(months=1)
    prev_end = start - timedelta(days=1)

    # ------------------------------------------------------------------
    # Calculate stats for current and previous months
    # ------------------------------------------------------------------
    stats_current = await _calculate_stats(child_id, start, end, db)
    stats_prev = await _calculate_stats(child_id, prev_start, prev_end, db)

    # Build response
    return AnalyticsResponse(
        perfectDays=Comparison(current=stats_current["perfect_days"], previous=stats_prev["perfect_days"]),
        longestStreak=Comparison(current=stats_current["longest_streak"], previous=stats_prev["longest_streak"]),
        taskCompletionRate=Comparison(current=stats_current["task_completion_rate"], previous=stats_prev["task_completion_rate"]),
        infractions=Comparison(current=stats_current["infractions"], previous=stats_prev["infractions"]),
        privilegesEarned=Comparison(current=stats_current["privileges_earned"], previous=stats_prev["privileges_earned"]),
        rewardsEarned=Comparison(current=float(stats_current["rewards_earned"]), previous=float(stats_prev["rewards_earned"])),
    ) 