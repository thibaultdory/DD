from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import text
import logging # Import logging
from app.core.config import settings
from app.models import Base
import asyncio
from pathlib import Path
from sqlalchemy.exc import DBAPIError

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

logger = logging.getLogger(__name__) # Add logger instance

def _looks_like_already_applied_error(exc: Exception) -> bool:
    """
    Best-effort detection for idempotent migration re-runs on PostgreSQL/asyncpg.
    We avoid crashing on statements like "ADD COLUMN ..." when the column already exists.
    """
    msg = str(exc).lower()
    return any(
        fragment in msg
        for fragment in [
            "already exists",
            "duplicate column",
            "duplicate_table",
            "duplicate object",
            "duplicate key value",
            "duplicate_object",
            "duplicatecolumnerror",
            "duplicateobjecterror",
        ]
    )

async def apply_sql_migrations() -> None:
    """
    Apply SQL migrations from backend/migrations once, tracked via schema_migrations table.

    This prevents runtime crashes when code expects new columns but DB hasn't been updated.
    """
    migrations_dir = Path(__file__).resolve().parents[2] / "migrations"
    if not migrations_dir.exists():
        logger.info(f"ℹ️  MIGRATIONS: No migrations dir at {migrations_dir} (skipping)")
        return

    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        logger.info(f"ℹ️  MIGRATIONS: No migration files found in {migrations_dir} (skipping)")
        return

    async with engine.begin() as conn:
        # Ensure tracking table exists
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    filename TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
        )

        applied_rows = await conn.execute(text("SELECT filename FROM schema_migrations"))
        applied = {row[0] for row in applied_rows.all()}

        for migration_file in migration_files:
            fname = migration_file.name
            if fname in applied:
                continue

            sql = migration_file.read_text()
            # NOTE: keep migrations as plain SQL (no PL/pgSQL blocks with internal semicolons).
            statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]

            logger.info(f"📄 MIGRATIONS: Applying {fname} ({len(statements)} statements)")
            for statement in statements:
                try:
                    await conn.execute(text(statement))
                except DBAPIError as e:
                    if _looks_like_already_applied_error(e):
                        logger.warning(f"⚠️  MIGRATIONS: Skipping already-applied statement in {fname}: {e}")
                        continue
                    raise

            await conn.execute(
                text("INSERT INTO schema_migrations (filename) VALUES (:fname)"),
                {"fname": fname},
            )

        logger.info("✅ MIGRATIONS: Database migrations applied")

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
    # Finally, apply SQL migrations (ALTER TABLE, indexes, backfills, etc.)
    await apply_sql_migrations()
    logger.info("Database schema created successfully")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session