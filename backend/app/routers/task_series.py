from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete, update as sql_update # Aliased
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.user import User
from app.models.task_series import TaskSeries, TaskOccurrence, task_series_assignees
from app.models.task import Task # For one-off tasks
from app.schemas import TaskSeriesCreate, TaskSeriesUpdate, TaskRead, TaskOccurrenceUpdate # Assuming TaskRead is a generic schema for output
from app.scheduler import materialise_occurrences # The generator function
from datetime import date, datetime, timedelta
from uuid import UUID
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Helper to build RRULE
def build_rrule(start_date: date, weekdays: list[int], end_date: Optional[date]) -> str:
    # weekdays: 1=Mon, ..., 7=Sun
    # BYDAY: MO,TU,WE,TH,FR,SA,SU
    weekday_map = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
    byday_str = ",".join([weekday_map[d-1] for d in sorted(list(set(weekdays)))]) # Sort and unique
    
    # DTSTART is not part of the RRULE string itself usually, but passed to rrulestr.
    # However, the plan's example includes it. For consistency with the plan:
    # rrule = f"FREQ=WEEKLY;BYDAY={byday_str};DTSTART={start_date.strftime('%Y%m%dT%H%M%S')}"
    # Let's stick to the plan's simpler version, assuming dateutil handles dtstart from model.
    rrule = f"FREQ=WEEKLY;BYDAY={byday_str}"
    if end_date:
        rrule += f";UNTIL={end_date.strftime('%Y%m%d')}" # Format YYYYMMDD for UNTIL
    return rrule

async def serialize_series_to_task_read(series: TaskSeries, db: AsyncSession) -> dict:
    # This is a placeholder, actual serialization might need more details or be different
    # For now, let's assume we want to represent the series itself, not its occurrences
    assignee_ids = [user.id for user in series.assignees]
    return {
        "id": series.id, # This is series_id
        "title": series.title,
        "description": series.description,
        "assignedTo": assignee_ids,
        "dueDate": series.start_date, # Represents start of series
        "completed": False, # Series itself is not completable
        "createdBy": series.creator_id,
        "createdAt": series.created_at.isoformat(),
        "isRecurring": True,
        "seriesId": series.id,
        "rrule": series.rrule, # Add rrule for clarity
        "timezone": series.timezone,
        "untilDate": series.until_date.isoformat() if series.until_date else None,
    }


@router.post("/tasks/series", response_model=TaskRead) # Adjust response_model if needed
async def create_task_series(
    series_in: TaskSeriesCreate, 
    current_user: User = Depends(require_parent), 
    db: AsyncSession = Depends(get_db)
):
    try:
        logger.info(f"User {current_user.id} creating task series: {series_in.title}")
        
        if not series_in.weekdays:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Weekdays must be provided for recurring tasks.")

        rrule_str = build_rrule(series_in.startDate, series_in.weekdays, series_in.endDate)

        new_series = TaskSeries(
            title=series_in.title,
            description=series_in.description,
            creator_id=current_user.id,
            start_date=series_in.startDate,
            until_date=series_in.endDate,
            rrule=rrule_str,
            timezone=series_in.timezone
        )
        db.add(new_series)
        await db.flush() # To get new_series.id

        # Assign users
        for user_id in series_in.assignedTo:
            user = await db.get(User, user_id)
            if not user:
                await db.rollback()
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found.")
            # Add to association table
            stmt = task_series_assignees.insert().values(series_id=new_series.id, user_id=user.id)
            await db.execute(stmt)
        
        await db.commit() # Commit series and assignments first
        await db.refresh(new_series)
        # Eager load assignees for serialization
        await db.refresh(new_series, attribute_names=['assignees'])


        # Immediately materialize occurrences for the next N days
        logger.info(f"Materializing initial occurrences for series {new_series.id}")
        await materialise_occurrences(db) # db session is passed here

@router.put("/tasks/series/{series_id}", response_model=TaskRead) # Assuming TaskRead for series output too
async def update_task_series(
    series_id: UUID,
    updates: TaskSeriesUpdate,
    current_user: User = Depends(require_parent), # Only parents can edit series
    db: AsyncSession = Depends(get_db)
):
    series = await db.get(TaskSeries, series_id)
    if not series:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task series not found")

    if series.creator_id != current_user.id:
        # Or, allow any parent to edit? For now, only creator parent.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task series")

    try:
        data = updates.dict(exclude_unset=True)
        logger.info(f"User {current_user.id} updating task series {series_id} with data: {data}")
        
        needs_rrule_rebuild = False
        if "startDate" in data or "weekdays" in data or "endDate" in data:
            needs_rrule_rebuild = True

        if "title" in data: series.title = data["title"]
        if "description" in data: series.description = data["description"]
        if "timezone" in data: series.timezone = data["timezone"]
        
        # Handle rrule related fields carefully
        current_start_date = data.get("startDate", series.start_date)
        current_weekdays = data.get("weekdays", None) # If None, need to parse from existing rrule or error
        current_end_date = data.get("endDate", series.until_date) # endDate can be None to remove until
        
        if needs_rrule_rebuild:
            # If weekdays are not provided in update, we need to get them from old rrule or error out.
            # This simplified version assumes if any rrule part changes, weekdays must be provided.
            if not current_weekdays:
                 # Attempt to parse from existing s.rrule if only start/end date changed
                 # For simplicity, require weekdays if any part of recurrence changes.
                 # A more robust solution would parse s.rrule to get existing BYDAY.
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Weekdays must be provided if changing recurrence rules (startDate, endDate, weekdays).")
            
            series.start_date = current_start_date
            series.until_date = current_end_date # This can be None
            series.rrule = build_rrule(current_start_date, current_weekdays, current_end_date)

        if "assignedTo" in data and data["assignedTo"] is not None:
            # Delete existing assignees
            await db.execute(task_series_assignees.delete().where(task_series_assignees.c.series_id == series.id))
            # Add new assignees
            for user_id in data["assignedTo"]:
                user = await db.get(User, user_id)
                if not user:
                    await db.rollback()
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found.")
                await db.execute(task_series_assignees.insert().values(series_id=series.id, user_id=user.id))
        
        series.updated_at = datetime.utcnow() # Manually update timestamp
        await db.flush() # Persist changes to series before deleting occurrences

        # Delete future occurrences
        today = date.today()
        delete_stmt = sql_delete(TaskOccurrence).where(
            TaskOccurrence.series_id == series_id,
            TaskOccurrence.due_date >= today
        )
        await db.execute(delete_stmt)
        logger.info(f"Deleted future occurrences for series {series_id} from {today}")

        await db.commit() # Commit series update and occurrence deletion
        
        # Regenerate occurrences
        logger.info(f"Regenerating occurrences for series {series_id}")
        await materialise_occurrences(db)
        
        # Re-fetch for response with potentially updated relationships
        updated_series = await db.execute(
            select(TaskSeries).where(TaskSeries.id == series_id)
            .options(selectinload(TaskSeries.assignees))
        )
        series_for_response = updated_series.scalar_one()
        return await serialize_series_to_task_read(series_for_response, db)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update task series {series_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update task series: {str(e)}")


@router.delete("/tasks/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_series_future(
    series_id: UUID,
    # future: bool = True, # Parameter from plan, implies only future. Defaulting to this behavior.
    current_user: User = Depends(require_parent), # Only parents can delete series
    db: AsyncSession = Depends(get_db)
):
    series = await db.get(TaskSeries, series_id)
    if not series:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task series not found")

    if series.creator_id != current_user.id:
        # Or, allow any parent to delete? For now, only creator parent.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task series")

    try:
        today = date.today()
        yesterday = today - timedelta(days=1)
        logger.info(f"User {current_user.id} deleting future for task series {series_id}. Occurrences from {today} will be deleted. Series until_date set to {yesterday}.")

        # 1. Delete future occurrences from task_occurrences
        delete_occurrences_stmt = sql_delete(TaskOccurrence).where(
            TaskOccurrence.series_id == series_id,
            TaskOccurrence.due_date >= today
        )
        await db.execute(delete_occurrences_stmt)

        # 2. Update task_series.until_date to yesterday
        update_series_stmt = sql_update(TaskSeries).where(TaskSeries.id == series_id).values(until_date=yesterday, updated_at=datetime.utcnow())
        await db.execute(update_series_stmt)
        
        await db.commit()
        logger.info(f"Successfully processed future deletion for task series {series_id}.")
        return # HTTP 204

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete future for task series {series_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete future for task series: {str(e)}")



        # For now, let's assume the relationship is populated or serialize_series_to_task_read handles it.
        
        # Re-fetch with assignees for response
        series_for_response = await db.execute(
            select(TaskSeries).where(TaskSeries.id == new_series.id)
            .options(selectinload(TaskSeries.assignees))
        )
        created_series = series_for_response.scalar_one_or_none()
        
        if not created_series: # Should not happen
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve created series.")

        return await serialize_series_to_task_read(created_series, db)

    except HTTPException: # Re-raise HTTPExceptions
        raise
    except Exception as e:
        logger.error(f"Failed to create task series: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create task series: {str(e)}")

# Placeholder for other series endpoints
# GET /tasks/series/{series_id}
# PUT /tasks/series/{series_id}
# DELETE /tasks/series/{series_id}
