#!/usr/bin/env python3
"""
Apply database migrations in backend/migrations
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import AsyncSessionLocal

async def apply_migration():
    """Apply SQL migrations from backend/migrations (sorted by filename)."""
    print("🔧 Applying database migrations from backend/migrations ...")
    
    migrations_dir = Path("backend/migrations")
    if not migrations_dir.exists():
        print(f"❌ Migrations directory not found: {migrations_dir}")
        return False

    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        print(f"ℹ️  No migration files found in {migrations_dir}")
        return True
    
    async with AsyncSessionLocal() as session:
        try:
            for migration_file in migration_files:
                print(f"📄 Applying {migration_file} ...")
                migration_sql = migration_file.read_text()

                # NOTE: these migrations must not contain PL/pgSQL blocks with internal semicolons.
                statements = [stmt.strip() for stmt in migration_sql.split(";") if stmt.strip()]

                for i, statement in enumerate(statements, 1):
                    if statement.startswith("--") or not statement:
                        continue
                    print(f"📝 Executing statement {i}/{len(statements)} from {migration_file.name}...")
                    await session.execute(statement)

            await session.commit()
            print("✅ Migrations applied successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            await session.rollback()
            return False

if __name__ == "__main__":
    success = asyncio.run(apply_migration())
    sys.exit(0 if success else 1) 