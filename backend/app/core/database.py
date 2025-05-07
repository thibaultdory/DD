from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models import Base
import asyncio
from sqlalchemy.exc import OperationalError

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

async def init_db():
    max_retries = 10
    retry_delay = 2  # secondes

    for attempt in range(max_retries):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print(f"Database initialized successfully on attempt {attempt + 1}")
            return
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Database connection failed (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
            else:
                print("Failed to connect to database after all retries")
                raise

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session