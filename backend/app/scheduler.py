from datetime import date, timedelta
from sqlalchemy import select, or_
from sqlalchemy.dialects.postgresql import insert # For on_conflict_do_nothing
from sqlalchemy.ext.asyncio import AsyncSession
from dateutil.rrule import rrulestr # Make sure this is installed

from app.models.task_series import TaskSeries, TaskOccurrence
# from app.core.database import get_db # Assuming db session is passed directly

GEN_WINDOW = 30  # days ahead

async def materialise_occurrences(db: AsyncSession):
    today = date.today()
    horizon = today + timedelta(days=GEN_WINDOW)

    # fetch active series
    result = await db.execute(
        select(TaskSeries).where(
            or_(TaskSeries.until_date.is_(None),
                TaskSeries.until_date >= today)
        )
    )
    series_list = result.scalars().all()

    for s in series_list:
        # Ensure dtstart is correctly handled by rrulestr
        # If s.start_date is already a date object, it should be fine.
        # If rrule string already contains DTSTART, rrulestr might use that.
        # It's safer if the rrule string itself defines DTSTART if it's critical.
        # For this implementation, we assume s.start_date is the authoritative start.
        rule = rrulestr(s.rrule, dtstart=s.start_date)
        
        # Filter occurrences within the [today, horizon] window
        # The plan uses rule.between(today, horizon, inc=True)
        # Ensure that 'today' considers the task's start_date.
        # If a task starts in the future but within the horizon, it should be generated.
        # If a task started in the past, generate from 'today' onwards.
        
        effective_start_date_for_generation = max(today, s.start_date)

        for due_datetime_obj in rule.between(effective_start_date_for_generation, horizon, inc=True):
            due_date_obj = due_datetime_obj.date() # Convert datetime to date
            # upsert keeps generator idempotent
            stmt = insert(TaskOccurrence).values(
                series_id=s.id,
                due_date=due_date_obj
            ).on_conflict_do_nothing(
                index_elements=['series_id', 'due_date'] # Specify conflict target
            )
            await db.execute(stmt)

    await db.commit()

# Example of how this might be called by a scheduler (e.g., APScheduler)
# This part would be in main.py or where the scheduler is configured.
# from apscheduler.schedulers.asyncio import AsyncIOScheduler
# from app.core.database import SessionLocal # Assuming SessionLocal for creating sessions

# async def scheduled_materialise_occurrences():
#     async with SessionLocal() as db:
#         await materialise_occurrences(db)

# def setup_scheduler():
#     scheduler = AsyncIOScheduler()
#     # Run nightly at midnight
#     scheduler.add_job(scheduled_materialise_occurrences, 'cron', hour=0, minute=0)
#     # Run also at startup (optional, or if you want immediate generation)
#     # scheduler.add_job(scheduled_materialise_occurrences) 
#     scheduler.start()
#     return scheduler

# The plan also mentions: "Run it right after any change to a series (create/update)."
# This means materialise_occurrences(db) will need to be callable from the CRUD operations for TaskSeries.
