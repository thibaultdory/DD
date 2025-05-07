from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.task import Task
from app.core.database import get_db

async def create_recurring_task_instances():
    """
    Crée les instances des tâches récurrentes pour la semaine suivante.
    Cette fonction doit être exécutée une fois par jour.
    """
    async for db in get_db():
        # Sélectionne toutes les tâches récurrentes
        stmt = select(Task).where(Task.is_recurring == True)
        result = await db.execute(stmt)
        recurring_tasks = result.scalars().all()

        # Pour chaque tâche récurrente
        for task in recurring_tasks:
            # Calcule les dates pour la semaine suivante
            today = date.today()
            start_of_next_week = today + timedelta(days=(7 - today.weekday()))
            
            # Pour chaque jour configuré dans la tâche
            for weekday in task.weekdays:
                # Calcule la date pour ce jour de la semaine
                task_date = start_of_next_week + timedelta(days=weekday-1)
                
                # Vérifie si une instance existe déjà pour cette date
                stmt = select(Task).where(
                    Task.parent_task_id == task.id,
                    Task.due_date == task_date
                )
                result = await db.execute(stmt)
                existing_instance = result.scalar_one_or_none()
                
                # Si aucune instance n'existe, en crée une nouvelle
                if not existing_instance:
                    new_instance = Task(
                        title=task.title,
                        description=task.description,
                        due_date=task_date,
                        created_by=task.created_by,
                        parent_task_id=task.id,
                        is_recurring=False  # L'instance n'est pas elle-même récurrente
                    )
                    # Copie les assignations
                    new_instance.assigned_to = task.assigned_to
                    db.add(new_instance)
        
        await db.commit()