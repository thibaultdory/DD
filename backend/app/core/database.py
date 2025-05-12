from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import text
import logging # Import logging
from app.core.config import settings
from app.models import Base
import asyncio
from sqlalchemy.exc import OperationalError

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

logger = logging.getLogger(__name__) # Add logger instance

async def wait_for_db():
    """Wait for database to be ready."""
    max_retries = 30  # Plus de tentatives
    retry_delay = 1   # Délai plus court

    for attempt in range(max_retries):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                logger.info(f"Database is ready (attempt {attempt + 1})")
                return
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database not ready (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay} seconds... Error: {e}", exc_info=True)
                await asyncio.sleep(retry_delay)
            else:
                logger.error("Failed to connect to database after all retries.", exc_info=True)
                raise

async def init_db():
    """Initialize database schema."""
    # D'abord, on attend que la base soit prête
    await wait_for_db()
    
    # Ensuite, on crée les tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema created successfully")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session