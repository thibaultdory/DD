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

@router.post("/tasks")
async def create_task(task_in: TaskCreate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
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
    # Assign users
    for uid in task_in.assignedTo:
        user = await db.get(User, uid)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
        task.assigned_to.append(user)
    await db.commit()
    await db.refresh(task)
    return serialize_task(task)

@router.put("/tasks/{task_id}")
async def update_task(task_id: UUID, updates: TaskUpdate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    data = updates.dict(exclude_unset=True)
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
        task.assigned_to.clear()
        for uid in data["assignedTo"]:
            user = await db.get(User, uid)
            if not user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {uid} not found")
            task.assigned_to.append(user)
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
async def delete_task(task_id: UUID, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await db.delete(task)
    await db.commit()
    return {"success": True}
