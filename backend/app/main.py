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
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.tasks import router as tasks_router
from app.routers.privileges import router as privileges_router
from app.routers.rule_violations import router as rule_violations_router
from app.routers.contracts import router as contracts_router
from app.routers.wallets import router as wallets_router

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

@app.on_event("startup")
async def startup():
    setup_logging()  # Initialize logging
    # Create tables and seed initial data
    await init_db()
    await seed_initial_data()
    # Schedule daily rewards and recurring tasks at midnight
    scheduler = AsyncIOScheduler()
    scheduler.add_job(process_daily_rewards, 'cron', hour=0, minute=0)
    scheduler.add_job(create_recurring_task_instances, 'cron', hour=0, minute=0)
    scheduler.start()

@app.get("/")
async def root():
    return {"message": "Assistant de Vie Familiale API is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import os
    port = int(os.getenv("BACKEND_PORT", 56000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )