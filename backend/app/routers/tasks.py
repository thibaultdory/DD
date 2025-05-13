from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete, update as sql_update # Renamed to avoid conflict
from sqlalchemy.dialects.postgresql import insert as pg_insert # For on_conflict
from sqlalchemy.orm import selectinload # Added for eager loading
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.task import Task, task_assignments
from app.models.user import User
from app.models.task_series import TaskSeries, TaskOccurrence # Added
from app.schemas import TaskCreate, TaskUpdate, TaskRead # Added TaskRead
from datetime import date
from uuid import UUID
import logging # Import logging
logger = logging.getLogger(__name__)

router = APIRouter()

async def serialize_occurrence_to_task_read(occurrence: TaskOccurrence, db: AsyncSession) -> TaskRead:
    # Ensure series and its assignees are loaded. This should ideally be done 
    # in the calling query using selectinload for efficiency.
    # If not preloaded, this will trigger lazy loads.
    series = occurrence.series
    if not series: # Should not happen if relationships are set up correctly and occurrence is valid
        # Attempt to load it if it wasn't preloaded (less efficient)
        series_stmt = select(TaskSeries).where(TaskSeries.id == occurrence.series_id).options(selectinload(TaskSeries.assignees))
        series_result = await db.execute(series_stmt)
        series = series_result.scalar_one_or_none()
        if not series:
            logger.error(f"Series {occurrence.series_id} not found for occurrence {occurrence.id}")
            # Fallback or raise error
            return TaskRead(
                id=occurrence.id,
                title="Error: Series not found",
                description=None,
                assignedTo=[],
                dueDate=occurrence.due_date,
                completed=occurrence.completed,
                createdBy=None, 
                createdAt=occurrence.created_at.isoformat(),
                isRecurring=True,
                seriesId=occurrence.series_id,
                cancelled=occurrence.cancelled
            )

    assignee_ids = []
    if series.assignees: # Check if assignees were loaded
        assignee_ids = [user.id for user in series.assignees]
    else: # Attempt to load them if not preloaded (less efficient)
        # This path indicates an N+1 query potential if not handled by prior selectinload
        series_assignees_stmt = select(User).join(task_series_assignees).where(task_series_assignees.c.series_id == series.id)
        assignees_result = await db.execute(series_assignees_stmt)
        assignees = assignees_result.scalars().all()
        assignee_ids = [user.id for user in assignees]

    return TaskRead(
        id=occurrence.id, # This is the occurrence ID
        title=series.title,
        description=series.description,
        assignedTo=assignee_ids,
        dueDate=occurrence.due_date,
        completed=occurrence.completed,
        createdBy=series.creator_id, # Creator of the series
        createdAt=occurrence.created_at.isoformat(), # Occurrence creation time
        isRecurring=True,
        seriesId=occurrence.series_id,
        parentTaskId=None, # Legacy
        weekdays=None, # Legacy
        cancelled=occurrence.cancelled
    )

async def serialize_task(task: Task, db: AsyncSession) -> TaskRead:
    # This is for one-off tasks (original Task model)
    # Ensure assigned_to are loaded if needed, or handle N+1.
    # For one-off tasks, assigned_to is directly on the task model via task_assignments table.
    
    # Eager load assigned_to if not already loaded (less efficient than query time)
    # This check is a bit of a guess, ideally relationships are handled by the caller query.
    assignee_ids = []
    if task.assigned_to: # Check if relationship is populated
        assignee_ids = [user.id for user in task.assigned_to]
    else:
        # Manually fetch if not populated (N+1 potential)
        result = await db.execute(
            select(User).join(task_assignments).where(task_assignments.c.task_id == task.id)
        )
        assigned_users = result.scalars().all()
        assignee_ids = [user.id for user in assigned_users]

    return TaskRead(
        id=task.id,
        title=task.title,
        description=task.description,
        assignedTo=assignee_ids,
        dueDate=task.due_date,
        completed=task.completed,
        createdBy=task.created_by,
        createdAt=task.created_at.isoformat(),
        isRecurring=False, # One-off tasks are not recurring in the new system
        seriesId=None,     # No series for one-off tasks
        parentTaskId=None, # Legacy, will be removed from Task model
        weekdays=None,     # Legacy, will be removed from Task model
        cancelled=None     # Not applicable to one-off tasks in this way
    )

from app.scheduler import materialise_occurrences # Import the generator
from typing import List, Optional # For type hinting

@router.get("/tasks", response_model=List[TaskRead])
async def get_tasks_and_occurrences(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    user_id_filter: Optional[UUID] = None, # For filtering by specific user (e.g. for /tasks/user/{user_id})
    current_user: User = Depends(get_current_user), # Changed from require_parent to get_current_user for flexibility
    db: AsyncSession = Depends(get_db)
):
    # Ensure occurrences are generated for the relevant window.
    # This is a simplification; a more advanced version might adjust GEN_WINDOW 
    # or pass from_date/to_date to materialise_occurrences if it supported it.
    await materialise_occurrences(db)

    all_results: List[TaskRead] = []

    # 1. Fetch one-off tasks (Task model)
    # These are tasks that are not recurring instances (will be purely non-recurring after migration)
    # For now, assume Task model still has is_recurring and parent_task_id for filtering legacy data.
    # Post-migration, Task table will only contain one-off tasks.
    stmt_one_off = select(Task).options(selectinload(Task.assigned_to))
    
    # Apply date filters
    if from_date:
        stmt_one_off = stmt_one_off.where(Task.due_date >= from_date)
    if to_date:
        stmt_one_off = stmt_one_off.where(Task.due_date <= to_date)

    # Permission: Non-parents see only their assigned one-off tasks or if user_id_filter is applied
    if not current_user.is_parent:
        effective_user_id = user_id_filter if user_id_filter else current_user.id
        # Filter by tasks assigned to the effective_user_id
        stmt_one_off = stmt_one_off.join(task_assignments).where(task_assignments.c.user_id == effective_user_id)
    elif user_id_filter: # Parent is viewing for a specific user
        stmt_one_off = stmt_one_off.join(task_assignments).where(task_assignments.c.user_id == user_id_filter)
    
    # Filter out tasks that are children of old recurring tasks, these are handled by occurrences
    # This condition will be removed after data migration and Task model cleanup.
    stmt_one_off = stmt_one_off.where(Task.parent_task_id.is_(None))
    # Also, ensure we only get tasks that are not marked as recurring parents in the old system
    # This condition will also be removed after data migration.
    stmt_one_off = stmt_one_off.where(Task.is_recurring == False)

    one_off_tasks_result = await db.execute(stmt_one_off)
    one_off_tasks = one_off_tasks_result.scalars().all()
    for task_obj in one_off_tasks:
        all_results.append(await serialize_task(task_obj, db))

    # 2. Fetch TaskOccurrences
    stmt_occurrences = select(TaskOccurrence).options(
        selectinload(TaskOccurrence.series).selectinload(TaskSeries.assignees),
        selectinload(TaskOccurrence.series).selectinload(TaskSeries.creator) # Load creator too
    )
    if from_date:
        stmt_occurrences = stmt_occurrences.where(TaskOccurrence.due_date >= from_date)
    if to_date:
        stmt_occurrences = stmt_occurrences.where(TaskOccurrence.due_date <= to_date)

    # Permission for occurrences: Non-parents see only occurrences of series they are assigned to
    # or if user_id_filter is applied for a specific user they are allowed to see.
    if not current_user.is_parent:
        effective_user_id = user_id_filter if user_id_filter else current_user.id
        stmt_occurrences = stmt_occurrences.join(TaskOccurrence.series).join(TaskSeries.assignees).where(User.id == effective_user_id)
    elif user_id_filter: # Parent is viewing for a specific user
        stmt_occurrences = stmt_occurrences.join(TaskOccurrence.series).join(TaskSeries.assignees).where(User.id == user_id_filter)

    occurrences_result = await db.execute(stmt_occurrences)
    task_occurrences = occurrences_result.scalars().unique().all() # .unique() because of joins
    for occ_obj in task_occurrences:
        all_results.append(await serialize_occurrence_to_task_read(occ_obj, db))
    
    # Sort by due_date (optional, but good for UI)
    all_results.sort(key=lambda x: x.dueDate)
    
    return all_results


@router.get("/tasks/user/{user_id}", response_model=List[TaskRead])
async def get_user_tasks(
    user_id: UUID, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    # Permission check: Parent can see any user's tasks.
    # Non-parent can only see their own tasks.
    if not current_user.is_parent and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view these tasks")
    
    # Call the main getter function with the user_id_filter
    return await get_tasks_and_occurrences(user_id_filter=user_id, current_user=current_user, db=db)

@router.get("/tasks/date/{due_date}", response_model=List[TaskRead])
async def get_tasks_by_date(
    due_date: date, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    # Call the main getter function with from_date and to_date set to the specific due_date
    # Permission will be handled by get_tasks_and_occurrences based on current_user
    return await get_tasks_and_occurrences(from_date=due_date, to_date=due_date, current_user=current_user, db=db)

from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

def get_next_weekday(start_date: date, target_weekday: int) -> date:
    """Retourne la prochaine date correspondant au jour de la semaine spécifié."""
    days_ahead = target_weekday - start_date.isoweekday()
    if days_ahead <= 0:  # Si le jour cible est déjà passé cette semaine
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)

@router.post("/tasks")
async def create_task(task_in: TaskCreate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    try:
        # This endpoint is now only for one-off tasks
        if task_in.isRecurring or task_in.weekdays or task_in.endDate:
            logger.warning(f"Attempt to create recurring task via /tasks endpoint: {task_in.title}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This endpoint is for one-off tasks. Use /tasks/series for recurring tasks."
            )

        logger.info(f"Creating one-off task '{task_in.title}' due {task_in.dueDate}")
        
        task = Task(
            title=task_in.title,
            description=task_in.description,
            due_date=task_in.dueDate,
            created_by=parent.id,
            is_recurring=False, # Always False for this endpoint
            weekdays=None,      # Always None
            parent_task_id=None # One-off tasks don't have parents
        )
        db.add(task)
        await db.flush() # to get task.id
        # Note: await db.refresh(task) was here, moved after assignments and commit in full version
        logger.debug(f"Created base task object with ID: {task.id} (pending commit)")

        # Assigner les utilisateurs
        for uid in task_in.assignedTo:
            user = await db.get(User, uid)
            if not user:
                logger.warning(f"User {uid} not found during task creation, rolling back.")
                await db.rollback()
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
            # Insert directly into the association table
            await db.execute(
                task_assignments.insert().values(
                    task_id=task.id,
                    user_id=user.id
                )
            )
            logger.debug(f"Assigned user {uid} to task {task.id}")

        await db.commit()
        await db.refresh(task) # Refresh to get potentially updated relationships
        logger.info(f"Successfully created one-off task {task.id}.")
        return await serialize_task(task, db)
    except Exception as e:
        logger.error(f"Failed to create task: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create task")

@router.put("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID, 
    updates: TaskUpdate, 
    parent: User = Depends(require_parent), 
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(Task, task_id)
    if not task:
        logger.warning(f"Update attempt on non-existent one-off task: {task_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One-off task not found")
    
    # Ensure this is a one-off task (no parent_id and not a recurring master in old system)
    if task.parent_task_id is not None:
        logger.warning(f"Attempt to update a recurring instance {task_id} via one-off task endpoint.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This task is an instance of a recurring series. Use series or occurrence endpoints.")
    # The `is_recurring` field on Task model is legacy. True one-off tasks should have it False or it will be removed.
    if hasattr(task, 'is_recurring') and task.is_recurring:
        logger.warning(f"Attempt to update a legacy recurring master task {task_id} via one-off task endpoint.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This task is a legacy recurring master. Use series endpoints.")

    if task.created_by != parent.id:
        logger.warning(f"Unauthorized update attempt on one-off task {task_id} by user {parent.id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")

    try:
        data = updates.dict(exclude_unset=True)
        logger.info(f"Updating one-off task {task_id} with data: {data}")

        if "isRecurring" in data and data["isRecurring"] is not False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot make a one-off task recurring.")
        if "weekdays" in data and data["weekdays"] is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot set weekdays for a one-off task.")

        updated_fields_count = 0
        if "title" in data:
            task.title = data["title"]
            updated_fields_count +=1
        if "description" in data:
            task.description = data["description"]
            updated_fields_count +=1
        if "dueDate" in data:
            task.due_date = data["dueDate"]
            updated_fields_count +=1
        if "completed" in data:
            task.completed = data["completed"]
            updated_fields_count +=1
        
        if "assignedTo" in data:
            updated_fields_count +=1 # Mark as updated even if list is same, due to complexity of deep compare
            logger.debug(f"Updating assignments for one-off task {task_id}")
            await db.execute(task_assignments.delete().where(task_assignments.c.task_id == task.id))
            new_assignees_ids = data.get("assignedTo", [])
            if new_assignees_ids:
                for uid in new_assignees_ids:
                    user = await db.get(User, uid)
                    if not user:
                        await db.rollback()
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
                    await db.execute(task_assignments.insert().values(task_id=task.id, user_id=user.id))
        
        if updated_fields_count == 0:
            # No actual changes, return current state or 304 (simplified here)
            return await serialize_task(task, db)

        await db.commit()
        await db.refresh(task)
        # If assignedTo was changed, serialize_task needs to see the new state.
        # Current serialize_task re-fetches assignees.
        
        logger.info(f"Successfully updated one-off task {task_id}")
        return await serialize_task(task, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update one-off task {task_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update one-off task: {str(e)}")


@router.put("/tasks/occurrences/{occurrence_id}", response_model=TaskRead)
async def update_task_occurrence(
    occurrence_id: UUID,
    updates: TaskOccurrenceUpdate,
    current_user: User = Depends(get_current_user), # Permissions might be complex here
    db: AsyncSession = Depends(get_db)
):
    occurrence = await db.get(TaskOccurrence, occurrence_id)
    if not occurrence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task occurrence not found")

    # Permissions: Who can update an occurrence? 
    # - Parent who created the series?
    # - User assigned to the series?
    # For now, let's allow if current_user is parent OR assigned to the series.
    series = await db.get(TaskSeries, occurrence.series_id) # Fetch series for creator and assignees
    if not series:
        # Should not happen if DB is consistent
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Task series not found for occurrence")

    is_creator = series.creator_id == current_user.id
    
    # Check if current_user is an assignee of the series
    is_assignee = False
    assignees_result = await db.execute(
        select(task_series_assignees.c.user_id).where(task_series_assignees.c.series_id == series.id)
    )
    series_assignee_ids = [row[0] for row in assignees_result.all()]
    if current_user.id in series_assignee_ids:
        is_assignee = True

    # Simplified Permission: Parent can update. Assigned child can update.
    if not current_user.is_parent and not is_assignee:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task occurrence")
    # If current_user.is_parent is True, they are allowed.
    # If current_user is not a parent but is_assignee is True, they are allowed.

    data = updates.dict(exclude_unset=True)
    updated = False
    if "completed" in data:
        occurrence.completed = data["completed"]
        # If marking as complete, ensure not cancelled. If un-completing, leave cancelled as is.
        if occurrence.completed:
            occurrence.cancelled = False 
        updated = True
    if "cancelled" in data:
        occurrence.cancelled = data["cancelled"]
        # If cancelling, ensure not completed.
        if occurrence.cancelled:
            occurrence.completed = False
        updated = True

    if not updated:
        # No relevant fields in payload, or values are the same
        # Return current state or 304. For now, just return current.
        loaded_occurrence = await db.execute(
            select(TaskOccurrence).options(selectinload(TaskOccurrence.series).selectinload(TaskSeries.assignees))
            .where(TaskOccurrence.id == occurrence_id)
        )
        return await serialize_occurrence_to_task_read(loaded_occurrence.scalar_one(), db)

    try:
        await db.commit()
        await db.refresh(occurrence)
        # Eager load for serialization
        refreshed_occurrence = await db.execute(
            select(TaskOccurrence).options(selectinload(TaskOccurrence.series).selectinload(TaskSeries.assignees))
            .where(TaskOccurrence.id == occurrence.id)
        )
        return await serialize_occurrence_to_task_read(refreshed_occurrence.scalar_one(), db)
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update task occurrence {occurrence_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update task occurrence")

@router.put("/tasks/occurrences/{occurrence_id}/toggle-complete", response_model=TaskRead)
async def toggle_complete_occurrence(
    occurrence_id: UUID, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    # First, get the occurrence to find its series_id and due_date
    # Also to check permissions before attempting the upsert
    occurrence = await db.get(TaskOccurrence, occurrence_id)
    if not occurrence:
        # If occurrence doesn't exist, the UPSERT logic below would INSERT it.
        # This might be desired if we want to mark a future, non-materialized task as done.
        # However, the path has occurrence_id, implying it should exist.
        # For now, let's assume it must exist to be toggled via this specific ID path.
        # The plan: "mark one occurrence as done write 1 row in a task_occurrence table (if it is not there already)"
        # This suggests the UPSERT is the primary mechanism. So, we might not need to fetch first if the goal is pure UPSERT.
        # Let's stick to the plan's SQL: it implies we know series_id and due_date.
        # If we only have occurrence_id, we must fetch it first to get series_id and due_date for the UPSERT.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task occurrence not found")

    # Permissions (same as update_task_occurrence)
    series = await db.get(TaskSeries, occurrence.series_id)
    if not series:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Task series not found for occurrence")

    is_assignee = False
    assignees_result = await db.execute(
        select(task_series_assignees.c.user_id).where(task_series_assignees.c.series_id == series.id)
    )
    series_assignee_ids = [row[0] for row in assignees_result.all()]
    if current_user.id in series_assignee_ids:
        is_assignee = True

    if not current_user.is_parent and not is_assignee:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task occurrence")

    try:
        # Using SQLAlchemy's ON CONFLICT DO UPDATE
        # The plan's SQL: VALUES ($series, $date, TRUE) ... DO UPDATE SET completed = NOT task_occurrences.completed;
        # This means the initial insert value for completed is TRUE if it's a new row.
        # If it exists, it toggles. This is slightly different from just setting a value.

        stmt = pg_insert(TaskOccurrence.__table__).values(
            series_id=occurrence.series_id, 
            due_date=occurrence.due_date,
            completed=True # Default to True if inserting, will be toggled if conflict
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[TaskOccurrence.series_id, TaskOccurrence.due_date], # Conflict target
            set_=dict(completed=~TaskOccurrence.__table__.c.completed) # Toggle `completed`
        ).returning(TaskOccurrence.id, TaskOccurrence.completed, TaskOccurrence.cancelled, TaskOccurrence.created_at, TaskOccurrence.due_date, TaskOccurrence.series_id)
        
        # Execute and get the result
        result_proxy = await db.execute(stmt)
        await db.commit()
        
        updated_values = result_proxy.fetchone()
        if not updated_values:
            # Should not happen with returning()
            raise HTTPException(status_code=500, detail="Failed to get updated occurrence details.")

        # Create a TaskOccurrence object from the returned values for serialization
        # This is a bit manual; ideally, refresh an object or construct carefully.
        updated_occurrence = TaskOccurrence(
            id=updated_values.id, # This might be different if a new row was inserted by pg_insert
            series_id=updated_values.series_id,
            due_date=updated_values.due_date,
            completed=updated_values.completed,
            cancelled=updated_values.cancelled,
            created_at=updated_values.created_at
        )
        # The ID for serialization should be the one from the path if it existed, or new one if inserted.
        # The `returning` clause gives us the ID of the affected row.
        # We need to pass this potentially new/updated occurrence to the serializer.
        
        # For serialization, we need the full series details. We have `series` object from permission check.
        # We need to attach it to updated_occurrence for the serializer if it expects occurrence.series
        updated_occurrence.series = series # Attach the already fetched series object

        logger.info(f"Toggled completion for occurrence {updated_occurrence.id} (series {series.id}, date {occurrence.due_date}) by user {current_user.id}")
        return await serialize_occurrence_to_task_read(updated_occurrence, db)

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to toggle completion for occurrence via series {occurrence.series_id}, date {occurrence.due_date}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to toggle task completion")


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one_off_task(
    task_id: UUID,
    parent: User = Depends(require_parent),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One-off task not found")

    # Ensure this is a one-off task
    if task.parent_task_id is not None:
        logger.warning(f"Attempt to delete a recurring instance {task_id} via one-off task delete endpoint.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This is an instance of a recurring series. Use occurrence or series delete endpoints.")
    if hasattr(task, 'is_recurring') and task.is_recurring:
        logger.warning(f"Attempt to delete a legacy recurring master {task_id} via one-off task delete endpoint.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This is a legacy recurring master. Use series delete endpoints.")

    if task.created_by != parent.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")

    try:
        logger.info(f"Deleting one-off task {task_id}")
        # Also delete associated assignments from task_assignments
        await db.execute(task_assignments.delete().where(task_assignments.c.task_id == task.id))
        await db.delete(task)
        await db.commit()
        logger.info(f"Successfully deleted one-off task {task_id}")
        return # Return 204 No Content implicitly by FastAPI if no content is returned
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete one-off task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete task")


@router.delete("/tasks/occurrences/{occurrence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_occurrence(
    occurrence_id: UUID,
    current_user: User = Depends(get_current_user), # Using get_current_user for flexible permissions
    db: AsyncSession = Depends(get_db)
):
    occurrence = await db.get(TaskOccurrence, occurrence_id)
    if not occurrence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task occurrence not found")

    # Permissions: Parent who created series, or any parent? Or assigned user?
    # For consistency with update/toggle-complete, let's use similar logic:
    # Parent can delete. Assigned child can delete their own occurrence.
    series = await db.get(TaskSeries, occurrence.series_id)
    if not series: # Should not happen
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Task series not found for occurrence")

    is_assignee = False
    assignees_result = await db.execute(
        select(task_series_assignees.c.user_id).where(task_series_assignees.c.series_id == series.id)
    )
    series_assignee_ids = [row[0] for row in assignees_result.all()]
    if current_user.id in series_assignee_ids:
        is_assignee = True

    # Allow if: current user is a parent AND creator of the series OR current user is an assignee.
    # Simpler: current_user is parent OR current_user is assignee.
    if not current_user.is_parent and not is_assignee:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task occurrence")
    
    # If it's a parent, but not the creator, should they be allowed to delete?
    # For now, any parent or an assigned user can delete.
    # If only creator parent: if not (current_user.is_parent and series.creator_id == current_user.id) and not is_assignee:

    try:
        logger.info(f"Hard deleting task occurrence {occurrence_id} by user {current_user.id}")
        await db.delete(occurrence)
        await db.commit()
        logger.info(f"Successfully deleted task occurrence {occurrence_id}")
        return
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete task occurrence {occurrence_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete task occurrence")

