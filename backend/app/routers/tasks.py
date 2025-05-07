from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.task import Task, task_assignments
from app.models.user import User
from app.schemas import TaskCreate, TaskUpdate
from datetime import date
from uuid import UUID

router = APIRouter()

def serialize_task(task: Task):
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "assignedTo": [str(u.id) for u in task.assigned_to],
        "dueDate": task.due_date.isoformat(),
        "completed": task.completed,
        "createdBy": str(task.created_by),
        "createdAt": task.created_at.isoformat(),
        "isRecurring": task.is_recurring,
        "weekdays": task.weekdays if task.weekdays else None,
        "parentTaskId": str(task.parent_task_id) if task.parent_task_id else None,
    }

@router.get("/tasks")
async def get_tasks(parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task))
    tasks = result.scalars().all()
    return [serialize_task(t) for t in tasks]

@router.get("/tasks/user/{user_id}")
async def get_user_tasks(user_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not (current_user.is_parent or current_user.id == user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    stmt = select(Task).join(task_assignments).where(task_assignments.c.user_id == user_id)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [serialize_task(t) for t in tasks]

@router.get("/tasks/date/{due_date}")
async def get_tasks_by_date(due_date: date, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.due_date == due_date)
    if not current_user.is_parent:
        stmt = stmt.join(task_assignments).where(task_assignments.c.user_id == current_user.id)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [serialize_task(t) for t in tasks]

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
    # Créer la tâche principale
    task = Task(
        title=task_in.title,
        description=task_in.description,
        due_date=task_in.dueDate,
        created_by=parent.id,
        is_recurring=task_in.isRecurring,
        weekdays=task_in.weekdays if task_in.isRecurring else None,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)

    # Assigner les utilisateurs
    for uid in task_in.assignedTo:
        user = await db.get(User, uid)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
        # Insert directly into the association table
        await db.execute(
            task_assignments.insert().values(
                task_id=task.id,
                user_id=user.id
            )
        )

    # Si c'est une tâche récurrente, créer toutes les instances
    if task.is_recurring and task.weekdays:
        # Définir la date de fin (1 an par défaut si non spécifiée)
        end_date = task_in.endDate or (task_in.dueDate + relativedelta(years=1))
        
        # Pour chaque jour de la semaine configuré
        for weekday in task.weekdays:
            # Commencer à la première occurrence après la date de début
            next_date = get_next_weekday(task_in.dueDate, weekday)
            
            # Créer une instance pour chaque semaine jusqu'à end_date
            while next_date <= end_date:
                instance = Task(
                    title=task.title,
                    description=task.description,
                    due_date=next_date,
                    created_by=parent.id,
                    parent_task_id=task.id,
                    is_recurring=False  # Les instances ne sont pas récurrentes
                )
                db.add(instance)
                await db.flush()  # Ensure instance has an ID
                # Copier les assignations
                for user_id in task_in.assignedTo:
                    await db.execute(
                        task_assignments.insert().values(
                            task_id=instance.id,
                            user_id=user_id
                        )
                    )
                next_date += timedelta(days=7)

    await db.commit()
    await db.refresh(task)
    return serialize_task(task)

@router.put("/tasks/{task_id}")
async def update_task(task_id: UUID, updates: TaskUpdate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.created_by != parent.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")

    data = updates.dict(exclude_unset=True)

    # Si c'est une instance d'une tâche récurrente, on ne peut modifier que completed
    if task.parent_task_id and len(data) > 1 or (len(data) == 1 and "completed" not in data):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the completion status can be updated for recurring task instances"
        )

    # Si c'est une tâche récurrente parente, on met à jour toutes les instances futures
    is_recurring_parent = task.is_recurring and not task.parent_task_id
    update_future_instances = is_recurring_parent and any(
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
    if "assignedTo" in data:
        # Delete existing assignments
        await db.execute(
            task_assignments.delete().where(task_assignments.c.task_id == task.id)
        )
        # Add new assignments
        for uid in data["assignedTo"]:
            user = await db.get(User, uid)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
            await db.execute(
                task_assignments.insert().values(
                    task_id=task.id,
                    user_id=user.id
                )
            )

    # Si nécessaire, mettre à jour les instances futures de la tâche récurrente
    if update_future_instances:
        today = date.today()
        # Récupérer toutes les instances futures
        result = await db.execute(
            select(Task).where(
                Task.parent_task_id == task_id,
                Task.due_date >= today
            )
        )
        future_instances = result.scalars().all()

        # Mettre à jour chaque instance
        for instance in future_instances:
            if "title" in data:
                instance.title = data["title"]
            if "description" in data:
                instance.description = data["description"]
            if "assignedTo" in data:
                # Delete existing assignments
                await db.execute(
                    task_assignments.delete().where(task_assignments.c.task_id == instance.id)
                )
                # Add new assignments
                for uid in data["assignedTo"]:
                    await db.execute(
                        task_assignments.insert().values(
                            task_id=instance.id,
                            user_id=uid
                        )
                    )

    await db.commit()
    await db.refresh(task)
    return serialize_task(task)

@router.put("/tasks/{task_id}/complete")
async def complete_task(task_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not (current_user.is_parent or current_user.id in [u.id for u in task.assigned_to]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    task.completed = True
    await db.commit()
    await db.refresh(task)
    return serialize_task(task)

@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: UUID,
    delete_future: bool = False,  # Si True, supprime aussi les instances futures pour une tâche récurrente
    parent: User = Depends(require_parent),
    db: AsyncSession = Depends(get_db)
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.created_by != parent.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")

    # Si c'est une instance d'une tâche récurrente
    if task.parent_task_id:
        await db.delete(task)
    # Si c'est une tâche récurrente parente
    elif task.is_recurring:
        if delete_future:
            # Supprimer toutes les instances futures
            today = date.today()
            result = await db.execute(
                select(Task).where(
                    Task.parent_task_id == task_id,
                    Task.due_date >= today
                )
            )
            future_instances = result.scalars().all()
            for instance in future_instances:
                await db.delete(instance)
        await db.delete(task)
    # Si c'est une tâche normale
    else:
        await db.delete(task)

    await db.commit()
    return {"success": True}
