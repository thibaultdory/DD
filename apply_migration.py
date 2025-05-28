#!/usr/bin/env python3
"""
Apply database migration to add unique constraint for wallet transactions
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import AsyncSessionLocal

async def apply_migration():
    """Apply the wallet transaction unique constraint migration"""
    print("🔧 Applying wallet transaction unique constraint migration...")
    
    # Read the migration SQL
    migration_file = Path("backend/migrations/add_wallet_transaction_unique_constraint.sql")
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    migration_sql = migration_file.read_text()
    
    async with AsyncSessionLocal() as session:
        try:
            # Split the migration into individual statements
            statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
            
            for i, statement in enumerate(statements, 1):
                if statement.startswith('--') or not statement:
                    continue
                    
                print(f"📝 Executing statement {i}/{len(statements)}...")
                await session.execute(statement)
            
            await session.commit()
            print("✅ Migration applied successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            await session.rollback()
            return False

if __name__ == "__main__":
    success = asyncio.run(apply_migration())
    sys.exit(0 if success else 1) 