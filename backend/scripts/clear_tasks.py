import asyncio
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete
from app.core.database import AsyncSessionLocal
from app.models.task import Task, task_assignments

async def clear_tasks():
    """Clear all tasks and task assignments from the database."""
    async with AsyncSessionLocal() as session:
        # First delete all task assignments (due to foreign key constraints)
        await session.execute(delete(task_assignments))
        
        # Then delete all tasks
        await session.execute(delete(Task))
        
        # Commit the changes
        await session.commit()
        
        print("All tasks and task assignments have been deleted from the database.")

if __name__ == "__main__":
    asyncio.run(clear_tasks())