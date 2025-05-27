from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import logging
from app.models.task import Task
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def create_recurring_task_instances():
    """
    Crée les instances des tâches récurrentes pour la semaine suivante.
    Cette fonction doit être exécutée une fois par jour.
    """
    today = date.today()
    logger.info(f"🔄 SCHEDULER: Starting recurring task instance creation for {today}")
    
    async with AsyncSessionLocal() as db:
        try:
            # Sélectionne toutes les tâches récurrentes avec eager loading des relations
            stmt = select(Task).options(selectinload(Task.assigned_to)).where(Task.is_recurring == True)
            result = await db.execute(stmt)
            recurring_tasks = result.scalars().all()
            
            logger.info(f"📋 SCHEDULER: Found {len(recurring_tasks)} recurring tasks to process")
            
            if not recurring_tasks:
                logger.info(f"✅ SCHEDULER: No recurring tasks found - processing complete")
                return

            total_instances_created = 0
            total_instances_skipped = 0

            # Pour chaque tâche récurrente
            for task in recurring_tasks:
                logger.info(f"🔍 SCHEDULER: Processing recurring task '{task.title}' (ID: {task.id})")
                
                if not task.weekdays:
                    logger.warning(f"⚠️  SCHEDULER: Recurring task '{task.title}' has no weekdays configured - skipping")
                    continue
                
                # Calcule les dates pour la semaine suivante
                start_of_next_week = today + timedelta(days=(7 - today.weekday()))
                logger.debug(f"   📅 Next week starts: {start_of_next_week}")
                logger.debug(f"   📅 Configured weekdays: {task.weekdays}")
                
                instances_created_for_task = 0
                instances_skipped_for_task = 0
                
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
                        
                        # Add the new instance to the session first
                        db.add(new_instance)
                        await db.flush()  # Flush to get the ID
                        
                        # Now copy the assignments using the association table
                        for assigned_user in task.assigned_to:
                            # Add the assignment relationship
                            new_instance.assigned_to.append(assigned_user)
                        
                        logger.info(f"   ✅ Created task instance for {task_date} (weekday {weekday})")
                        instances_created_for_task += 1
                        total_instances_created += 1
                    else:
                        logger.debug(f"   ⏭️  Task instance already exists for {task_date} (ID: {existing_instance.id})")
                        instances_skipped_for_task += 1
                        total_instances_skipped += 1
                
                logger.info(f"📝 SCHEDULER: Task '{task.title}' - created {instances_created_for_task} instances, skipped {instances_skipped_for_task}")
            
            await db.commit()
            
            # Final summary
            logger.info(f"🎉 SCHEDULER: Recurring task instance creation completed successfully!")
            logger.info(f"📊 SCHEDULER: Summary for {today}:")
            logger.info(f"   ✅ Total instances created: {total_instances_created}")
            logger.info(f"   ⏭️  Total instances skipped (already exist): {total_instances_skipped}")
            
        except Exception as e:
            logger.error(f"💥 SCHEDULER: Error during recurring task instance creation: {e}", exc_info=True)
            await db.rollback()
            raise