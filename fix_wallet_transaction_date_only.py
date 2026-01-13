#!/usr/bin/env python3
"""
One-time DB fix for wallet_transactions.date_only:
- Backfill incorrect date_only values from date::date
- Drop DEFAULT CURRENT_DATE
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.core.database import AsyncSessionLocal


async def apply_fix() -> bool:
    print("🔧 Applying wallet_transactions.date_only fix...")

    migration_file = Path("backend/migrations/fix_wallet_transaction_date_only.sql")
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False

    migration_sql = migration_file.read_text()

    async with AsyncSessionLocal() as session:
        try:
            statements = [stmt.strip() for stmt in migration_sql.split(";") if stmt.strip()]

            for i, statement in enumerate(statements, 1):
                if statement.startswith("--") or not statement:
                    continue
                print(f"📝 Executing statement {i}/{len(statements)}...")
                await session.execute(statement)

            await session.commit()
            print("✅ date_only fix applied successfully!")
            return True
        except Exception as e:
            print(f"❌ date_only fix failed: {e}")
            await session.rollback()
            return False


if __name__ == "__main__":
    success = asyncio.run(apply_fix())
    sys.exit(0 if success else 1)

