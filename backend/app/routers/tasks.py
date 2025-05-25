from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.task import Task, task_assignments
from app.models.user import User
from app.schemas import TaskCreate, TaskUpdate
from datetime import date
from uuid import UUID
import logging # Import logging

router = APIRouter()
logger = logging.getLogger(__name__) # Add logger instance

async def serialize_task(task: Task, db: AsyncSession):
    # Get assigned users directly from the association table
    result = await db.execute(
        select(User).join(task_assignments).where(task_assignments.c.task_id == task.id)
    )
    assigned_users = result.scalars().all()
    
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "assignedTo": [str(u.id) for u in assigned_users],
        "dueDate": task.due_date.isoformat(),
        "completed": task.completed,
        "createdBy": str(task.created_by),
        "createdAt": task.created_at.isoformat(),
        "isRecurring": task.is_recurring,
        "weekdays": task.weekdays if task.weekdays else None,
        "endDate": task.end_date.isoformat() if task.end_date else None,
        "parentTaskId": str(task.parent_task_id) if task.parent_task_id else None,
    }

@router.get("/tasks")
async def get_tasks(
    parent: User = Depends(require_parent),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100)
):
    # Get total count efficiently
    total_result = await db.execute(select(func.count()).select_from(Task))
    total = total_result.scalar_one()
    # Get paginated tasks
    stmt = select(Task).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return {
        "tasks": [await serialize_task(t, db) for t in tasks],
        "total": total
    }

@router.get("/tasks/user/{user_id}")
async def get_user_tasks(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100)
):
    logger.info(f"get_user_tasks called for user_id={user_id}, current_user.id={current_user.id}, is_parent={current_user.is_parent}")
    if not (current_user.is_parent or current_user.id == user_id):
        logger.warning(f"User {current_user.id} not authorized to access tasks for user {user_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    # Get total count efficiently
    total_stmt = select(func.count()).select_from(Task).join(task_assignments).where(task_assignments.c.user_id == user_id)
    total_result = await db.execute(total_stmt)
    total = total_result.scalar_one()
    # Get paginated tasks
    stmt = select(Task).join(task_assignments).where(task_assignments.c.user_id == user_id).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    logger.info(f"Returning {len(tasks)} tasks for user {user_id} (total: {total})")
    return {
        "tasks": [await serialize_task(t, db) for t in tasks],
        "total": total
    }

@router.get("/tasks/date/{due_date}")
async def get_tasks_by_date(due_date: date, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.due_date == due_date)
    if not current_user.is_parent:
        stmt = stmt.join(task_assignments).where(task_assignments.c.user_id == current_user.id)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [await serialize_task(t, db) for t in tasks]

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
        logger.info(f"Creating task '{task_in.title}' due {task_in.dueDate}, recurring: {task_in.isRecurring}")
        
        created_tasks = []
        
        # Create a separate task for each assigned child
        for child_id in task_in.assignedTo:
            # Verify the child exists
            child = await db.get(User, child_id)
            if not child:
                await db.rollback()
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {child_id} not found")
            
            # Create the main task for this child
            task = Task(
                title=task_in.title,
                description=task_in.description,
                due_date=task_in.dueDate,
                created_by=parent.id,
                is_recurring=task_in.isRecurring,
                weekdays=task_in.weekdays if task_in.isRecurring else None,
                end_date=task_in.endDate if task_in.isRecurring else None,
            )
            db.add(task)
            await db.flush()
            await db.refresh(task)
            
            # Assign the task to this specific child
            await db.execute(
                task_assignments.insert().values(
                    task_id=task.id,
                    user_id=child_id
                )
            )
            
            created_tasks.append(task)
            
            # Generate recurring instances for this child's task
            if task.is_recurring and task.weekdays:
                end_date = task_in.endDate or (task_in.dueDate + relativedelta(years=1))
                current = task_in.dueDate
                one_day = timedelta(days=1)

                while current <= end_date:
                    if current != task_in.dueDate and current.isoweekday() in task.weekdays:
                        instance = Task(
                            title=task.title,
                            description=task.description,
                            due_date=current,
                            created_by=parent.id,
                            parent_task_id=task.id,
                            is_recurring=False
                        )
                        db.add(instance)
                        await db.flush()

                        # Assign the recurring instance to the same child
                        await db.execute(
                            task_assignments.insert().values(
                                task_id=instance.id,
                                user_id=child_id
                            )
                        )
                    current += one_day

        await db.commit()
        
        # Return the first created task (for API consistency)
        if created_tasks:
            await db.refresh(created_tasks[0])
            return await serialize_task(created_tasks[0], db)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tasks created")
            
    except Exception as e:
        logger.error(f"Failed to create task: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create task")

@router.put("/tasks/{task_id}")
async def update_task(task_id: UUID, updates: TaskUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        logger.warning(f"Update attempt on non-existent task: {task_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    try:
        data = updates.dict(exclude_unset=True)
        logger.info(f"Updating task {task_id} with data: {data}")

        # Check permissions based on user type and update content
        if current_user.is_parent:
            # Parents can always change completion status of any task
            # For other modifications, they can only update tasks they created
            if "completed" in data and len(data) == 1:
                # Only updating completion status - allow for any parent
                logger.debug(f"Parent {current_user.id} updating completion status for task {task_id}")
            elif task.created_by != current_user.id:
                # Trying to update other fields on a task they didn't create
                logger.warning(f"Unauthorized update attempt on task {task_id} by parent {current_user.id} - can only modify tasks they created")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")
        else:
            # Children can only uncomplete tasks they're assigned to
            # Check if user is assigned to task
            result = await db.execute(
                select(task_assignments).where(
                    task_assignments.c.task_id == task.id,
                    task_assignments.c.user_id == current_user.id
                )
            )
            is_assigned = result.first() is not None
            
            if not is_assigned:
                logger.warning(f"Child {current_user.id} not assigned to task {task_id}")
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")
            
            # Children can only update the completed field, and only to set it to False (uncomplete)
            if len(data) != 1 or "completed" not in data or data["completed"] is not False:
                logger.warning(f"Child {current_user.id} attempted unauthorized update on task {task_id}: {data}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail="Children can only uncomplete tasks (set completed to false)"
                )

        # Si c'est une instance d'une tâche récurrente, on ne peut modifier que completed
        if task.parent_task_id and len(data) > 1 or (len(data) == 1 and "completed" not in data):
            logger.warning(f"Attempt to update restricted fields on recurring task instance {task_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only the completion status can be updated for recurring task instances"
            )

        # Si c'est une tâche récurrente parente, on met à jour toutes les instances futures
        # Only parents can do this (children can't update recurring parent tasks)
        is_recurring_parent = task.is_recurring and not task.parent_task_id
        update_future_instances = current_user.is_parent and is_recurring_parent and any(
            field in data for field in ["title", "description", "assignedTo"]
        )

        # Mettre à jour la tâche principale
        if "title" in data:
            task.title = data["title"]
        if "description" in data:
            task.description = data["description"]
        if "dueDate" in data:
            task.due_date = data["dueDate"]
        if "completed" in data:
            task.completed = data["completed"]
        if "isRecurring" in data:
            task.is_recurring = data["isRecurring"]
        if "weekdays" in data:
            task.weekdays = data["weekdays"]
        if "endDate" in data:
            task.end_date = data["endDate"]
        if "assignedTo" in data:
            logger.debug(f"Updating assignments for task {task_id}")
            # Delete existing assignments
            await db.execute(
                task_assignments.delete().where(task_assignments.c.task_id == task.id)
            )
            # Add new assignments
            for uid in data["assignedTo"]:
                user = await db.get(User, uid)
                if not user:
                    logger.warning(f"User {uid} not found during task update, rolling back.")
                    await db.rollback()
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
                await db.execute(
                    task_assignments.insert().values(
                        task_id=task.id,
                        user_id=user.id
                    )
                )
                logger.debug(f"Assigned user {uid} to task {task.id}")

        # Si nécessaire, mettre à jour les instances futures de la tâche récurrente
        if update_future_instances:
            today = date.today()
            logger.info(f"Updating future instances of recurring task {task_id}")
            # Récupérer toutes les instances futures
            result = await db.execute(
                select(Task).where(
                    Task.parent_task_id == task_id,
                    Task.due_date >= today
                )
            )
            future_instances = result.scalars().all()
            logger.debug(f"Found {len(future_instances)} future instances to update.")

            # Mettre à jour chaque instance
            for instance in future_instances:
                if "title" in data:
                    instance.title = data["title"]
                if "description" in data:
                    instance.description = data["description"]
                if "assignedTo" in data:
                    logger.debug(f"Updating assignments for instance {instance.id}")
                    # Delete existing assignments
                    await db.execute(
                        task_assignments.delete().where(task_assignments.c.task_id == instance.id)
                    )
                    # Add new assignments
                    for uid in data["assignedTo"]:
                        # User existence already checked for parent task
                        await db.execute(
                            task_assignments.insert().values(
                                task_id=instance.id,
                                user_id=uid
                            )
                        )
                        logger.debug(f"Assigned user {uid} to instance {instance.id}")

        await db.commit()
        await db.refresh(task)
        logger.info(f"Successfully updated task {task_id}")
        # Need to pass db to serialize_task
        return await serialize_task(task, db)
    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update task")

@router.put("/tasks/{task_id}/complete")
async def complete_task(task_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        logger.warning(f"Complete attempt on non-existent task: {task_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    try:
        # Check if user is assigned to task
        result = await db.execute(
            select(task_assignments).where(
                task_assignments.c.task_id == task.id,
                task_assignments.c.user_id == current_user.id
            )
        )
        is_assigned = result.first() is not None
        if not (current_user.is_parent or is_assigned):
            logger.warning(f"Unauthorized complete attempt on task {task_id} by user {current_user.id}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        task.completed = True
        await db.commit()
        await db.refresh(task)
        logger.info(f"Task {task_id} marked as completed by user {current_user.id}")
        return await serialize_task(task, db)
    except Exception as e:
        logger.error(f"Failed to mark task {task_id} as complete: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to complete task")

@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: UUID,
    delete_future: bool = False,  # Si True, supprime aussi les instances futures pour une tâche récurrente
    parent: User = Depends(require_parent),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(Task, task_id)
    if not task:
        logger.warning(f"Delete attempt on non-existent task: {task_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.created_by != parent.id:
        logger.warning(f"Unauthorized delete attempt on task {task_id} by user {parent.id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")

    try:
        logger.info(f"Deleting task {task_id} (delete_future={delete_future})")
        
        # Si c'est une instance d'une tâche récurrente
        if task.parent_task_id:
            if delete_future:
                # L'utilisateur veut supprimer toute la série
                logger.info(f"Deleting entire series for recurring task instance {task_id}")
                parent_task_id = task.parent_task_id
                
                # Supprimer toutes les instances de la tâche récurrente (y compris celle-ci)
                result = await db.execute(
                    select(Task).where(Task.parent_task_id == parent_task_id)
                )
                all_instances = result.scalars().all()
                logger.debug(f"Found {len(all_instances)} instances to delete.")
                for instance in all_instances:
                    logger.debug(f"Deleting instance {instance.id}")
                    await db.delete(instance)
                
                # Supprimer aussi la tâche parente
                parent_task = await db.get(Task, parent_task_id)
                if parent_task:
                    logger.debug(f"Deleting parent task {parent_task_id}")
                    await db.delete(parent_task)
            else:
                # Supprimer uniquement cette instance
                logger.debug(f"Deleting single recurring task instance {task_id}")
                await db.delete(task)
        # Si c'est une tâche récurrente parente
        elif task.is_recurring:
            if delete_future:
                logger.info(f"Deleting future instances of recurring task {task_id}")
                # Supprimer toutes les instances futures
                today = date.today()
                result = await db.execute(
                    select(Task).where(
                        Task.parent_task_id == task_id,
                        Task.due_date >= today
                    )
                )
                future_instances = result.scalars().all()
                logger.debug(f"Found {len(future_instances)} future instances to delete.")
                for instance in future_instances:
                    logger.debug(f"Deleting instance {instance.id}")
                    await db.delete(instance)
            logger.debug(f"Deleting recurring task parent {task_id}")
            await db.delete(task)
        # Si c'est une tâche normale
        else:
            logger.debug(f"Deleting non-recurring task {task_id}")
            await db.delete(task)

        await db.commit()
        logger.info(f"Successfully deleted task {task_id} and relevant instances.")
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to delete task {task_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete task")

@router.get("/tasks/calendar")
async def get_tasks_for_calendar(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Get all tasks for calendar view. 
    Parents can see and modify all tasks.
    Children can see all tasks but can only modify their assigned tasks (enforced in frontend).
    """
    # Get all tasks for calendar view
    result = await db.execute(select(Task))
    tasks = result.scalars().all()
    
    serialized_tasks = []
    for task in tasks:
        task_data = await serialize_task(task, db)
        # Add permission flag for frontend
        if current_user.is_parent:
            task_data["canModify"] = True
        else:
            # Check if current user is assigned to this task
            is_assigned = str(current_user.id) in task_data["assignedTo"]
            task_data["canModify"] = is_assigned
        
        serialized_tasks.append(task_data)
    
    return serialized_tasks

@router.get("/tasks/calendar/range")
async def get_tasks_for_calendar_range(
    start_date: date = Query(..., description="Start date for the range (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date for the range (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Get tasks for calendar view within a specific date range.
    More efficient than fetching all tasks when only viewing a specific period.
    """
    # Validate date range
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    # Get tasks within the date range
    stmt = select(Task).where(
        Task.due_date >= start_date,
        Task.due_date <= end_date
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    serialized_tasks = []
    for task in tasks:
        task_data = await serialize_task(task, db)
        # Add permission flag for frontend
        if current_user.is_parent:
            task_data["canModify"] = True
        else:
            # Check if current user is assigned to this task
            is_assigned = str(current_user.id) in task_data["assignedTo"]
            task_data["canModify"] = is_assigned
        
        serialized_tasks.append(task_data)
    
    return serialized_tasks
