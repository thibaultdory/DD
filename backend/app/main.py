import uvicorn
from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from fastapi_csrf_protect import CsrfProtect
from app.core.config import settings
from app.core.database import init_db
from app.core.initial_data import seed_initial_data
from app.core.jobs import process_daily_rewards
from app.core.logging_config import setup_logging  # Import setup_logging
from app.scheduler import create_recurring_task_instances
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.executors.asyncio import AsyncIOExecutor
import os
import logging
import fcntl
import tempfile
from pathlib import Path
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.tasks import router as tasks_router
from app.routers.privileges import router as privileges_router
from app.routers.rule_violations import router as rule_violations_router
from app.routers.contracts import router as contracts_router
from app.routers.wallets import router as wallets_router
from datetime import date

logger = logging.getLogger(__name__)

app = FastAPI(title="Assistant de Vie Familiale Backend")

# Session middleware for OAuth and CSRF with proper production configuration
app.add_middleware(
    SessionMiddleware, 
    secret_key=settings.secret_key,
    max_age=86400,  # 24 hours session lifetime
    same_site="lax",  # Allow cross-site requests for OAuth
    https_only=settings.frontend_url.startswith("https://"),  # Secure cookies in production
)

# CORS - Use frontend URL from settings instead of wildcard
# When using credentials, specific origins must be listed (not wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CSRF configuration
@CsrfProtect.load_config
def get_csrf_config():
    return settings

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api", tags=["users"])
app.include_router(tasks_router, prefix="/api", tags=["tasks"])
app.include_router(privileges_router, prefix="/api", tags=["privileges"])
app.include_router(rule_violations_router, prefix="/api", tags=["rule-violations"])
app.include_router(contracts_router, prefix="/api", tags=["contracts"])
app.include_router(wallets_router, prefix="/api", tags=["wallets"])
# Rules endpoints
from app.routers.rules import router as rules_router
app.include_router(rules_router, prefix="/api", tags=["rules"])

# Global scheduler instance
scheduler = None
scheduler_lock_file = None

def acquire_scheduler_lock():
    """Acquire a file lock to ensure only one process runs the scheduler."""
    global scheduler_lock_file
    try:
        # Create lock file in temp directory
        lock_path = Path(tempfile.gettempdir()) / "family_assistant_scheduler.lock"
        logger.info(f"🔒 SCHEDULER: Attempting to acquire scheduler lock at {lock_path}")
        
        scheduler_lock_file = open(lock_path, 'w')
        
        # Try to acquire exclusive lock (non-blocking)
        fcntl.flock(scheduler_lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        
        # Write process info to lock file
        process_info = f"pid:{os.getpid()}\nworker_id:{os.getenv('WORKER_ID', 'unknown')}\nacquired_at:{date.today()}\n"
        scheduler_lock_file.write(process_info)
        scheduler_lock_file.flush()
        
        logger.info(f"✅ SCHEDULER: Successfully acquired scheduler lock")
        return True
    except (IOError, OSError) as e:
        logger.info(f"🔒 SCHEDULER: Could not acquire scheduler lock: {e}")
        if scheduler_lock_file:
            scheduler_lock_file.close()
            scheduler_lock_file = None
        return False

def release_scheduler_lock():
    """Release the scheduler lock."""
    global scheduler_lock_file
    if scheduler_lock_file:
        try:
            logger.info(f"🔓 SCHEDULER: Releasing scheduler lock")
            fcntl.flock(scheduler_lock_file.fileno(), fcntl.LOCK_UN)
            scheduler_lock_file.close()
            logger.info(f"✅ SCHEDULER: Successfully released scheduler lock")
        except Exception as e:
            logger.warning(f"⚠️  SCHEDULER: Error releasing lock: {e}")
        scheduler_lock_file = None

@app.on_event("startup")
async def startup():
    global scheduler
    setup_logging()  # Initialize logging
    
    process_id = os.getpid()
    worker_id = os.getenv('WORKER_ID', 'unknown')
    
    logger.info(f"🚀 SCHEDULER: Application startup - Process {process_id}, Worker {worker_id}")
    
    # Create tables and seed initial data
    await init_db()
    await seed_initial_data()
    
    # Try to acquire scheduler lock - only one process across all workers will succeed
    if acquire_scheduler_lock():
        logger.info(f"👑 SCHEDULER: This process will run the scheduler (Process {process_id}, Worker {worker_id})")
        
        # Configure scheduler with in-memory job store
        executors = {
            'default': AsyncIOExecutor()
        }
        job_defaults = {
            'coalesce': True,  # Combine multiple pending executions into one
            'max_instances': 1,  # Only one instance of each job can run at a time
            'misfire_grace_time': 300  # 5 minutes grace time for missed jobs
        }
        
        logger.info(f"⚙️  SCHEDULER: Configuring scheduler with job defaults: {job_defaults}")
        
        scheduler = AsyncIOScheduler(
            executors=executors,
            job_defaults=job_defaults
        )
        
        # Add jobs with unique IDs
        logger.info(f"📅 SCHEDULER: Adding daily rewards job (runs at 00:00)")
        scheduler.add_job(
            process_daily_rewards, 
            'cron', 
            hour=0, 
            minute=0,
            id='daily_rewards',
            replace_existing=True
        )
        
        logger.info(f"📅 SCHEDULER: Adding recurring tasks job (runs at 00:00)")
        scheduler.add_job(
            create_recurring_task_instances, 
            'cron', 
            hour=0, 
            minute=0,
            id='recurring_tasks',
            replace_existing=True
        )
        
        scheduler.start()
        
        # Log scheduler status
        jobs = scheduler.get_jobs()
        logger.info(f"✅ SCHEDULER: Scheduler started successfully with {len(jobs)} jobs:")
        for job in jobs:
            next_run = job.next_run_time.strftime('%Y-%m-%d %H:%M:%S') if job.next_run_time else 'Not scheduled'
            logger.info(f"   📋 Job '{job.id}': next run at {next_run}")
            
    else:
        logger.info(f"👥 SCHEDULER: Another process is running the scheduler. This worker will handle requests only (Process {process_id}, Worker {worker_id})")

@app.on_event("shutdown")
async def shutdown():
    global scheduler
    process_id = os.getpid()
    worker_id = os.getenv('WORKER_ID', 'unknown')
    
    logger.info(f"🛑 SCHEDULER: Application shutdown - Process {process_id}, Worker {worker_id}")
    
    if scheduler and scheduler.running:
        logger.info(f"⏹️  SCHEDULER: Shutting down scheduler")
        
        # Log final job status
        jobs = scheduler.get_jobs()
        logger.info(f"📊 SCHEDULER: Final scheduler status - {len(jobs)} jobs were running:")
        for job in jobs:
            logger.info(f"   📋 Job '{job.id}' - last run: {job.next_run_time}")
            
        scheduler.shutdown()
        logger.info(f"✅ SCHEDULER: Scheduler shutdown complete")
    
    # Release the lock
    release_scheduler_lock()
    logger.info(f"👋 SCHEDULER: Process {process_id} shutdown complete")

@app.get("/")
async def root():
    return {"message": "Assistant de Vie Familiale API is running"}

@app.get("/api/health")
async def health_check():
    global scheduler
    scheduler_status = "not_running"
    jobs_count = 0
    worker_id = os.getenv('WORKER_ID', 'unknown')
    process_id = os.getpid()
    has_lock = scheduler_lock_file is not None
    
    if scheduler and scheduler.running:
        scheduler_status = "running"
        jobs_count = len(scheduler.get_jobs())
    
    return {
        "status": "healthy",
        "process_id": process_id,
        "worker_id": worker_id,
        "scheduler": {
            "status": scheduler_status,
            "jobs_count": jobs_count,
            "has_lock": has_lock
        }
    }

@app.get("/api/scheduler/status")
async def scheduler_status():
    """Detailed scheduler status endpoint for monitoring."""
    global scheduler
    
    process_id = os.getpid()
    worker_id = os.getenv('WORKER_ID', 'unknown')
    has_lock = scheduler_lock_file is not None
    
    status = {
        "process_info": {
            "process_id": process_id,
            "worker_id": worker_id,
            "has_scheduler_lock": has_lock
        },
        "scheduler": {
            "running": False,
            "jobs": []
        }
    }
    
    if scheduler and scheduler.running:
        status["scheduler"]["running"] = True
        
        # Get detailed job information
        jobs = scheduler.get_jobs()
        for job in jobs:
            job_info = {
                "id": job.id,
                "name": job.name or job.func.__name__,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
                "max_instances": job.max_instances,
                "coalesce": job.coalesce
            }
            status["scheduler"]["jobs"].append(job_info)
    
    # Read lock file info if it exists
    try:
        lock_path = Path(tempfile.gettempdir()) / "family_assistant_scheduler.lock"
        if lock_path.exists():
            with open(lock_path, 'r') as f:
                lock_content = f.read().strip()
                status["lock_file"] = {
                    "exists": True,
                    "content": lock_content,
                    "path": str(lock_path)
                }
        else:
            status["lock_file"] = {"exists": False}
    except Exception as e:
        status["lock_file"] = {"error": str(e)}
    
    return status

if __name__ == "__main__":
    import os
    port = int(os.getenv("BACKEND_PORT", 56000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )