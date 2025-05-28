#!/usr/bin/env python3
"""
Clean up duplicate wallet transactions before applying unique constraint
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def cleanup_duplicates():
    """Remove duplicate daily reward transactions, keeping the earliest one"""
    print("🧹 Cleaning up duplicate wallet transactions...")
    
    async with AsyncSessionLocal() as session:
        try:
            # First, let's see what duplicates exist
            check_duplicates_query = text("""
                SELECT 
                    child_id, 
                    contract_id, 
                    date::date as date_only, 
                    reason,
                    COUNT(*) as duplicate_count
                FROM wallet_transactions 
                WHERE reason = 'Récompense journalière'
                GROUP BY child_id, contract_id, date::date, reason
                HAVING COUNT(*) > 1
                ORDER BY duplicate_count DESC
            """)
            
            result = await session.execute(check_duplicates_query)
            duplicates = result.fetchall()
            
            if not duplicates:
                print("✅ No duplicate transactions found!")
                return True
            
            print(f"🔍 Found {len(duplicates)} sets of duplicate transactions:")
            total_duplicates = 0
            for dup in duplicates:
                print(f"   - Child {dup.child_id}, Contract {dup.contract_id}, Date {dup.date_only}: {dup.duplicate_count} duplicates")
                total_duplicates += dup.duplicate_count - 1  # -1 because we keep one
            
            print(f"📊 Total duplicate transactions to remove: {total_duplicates}")
            
            # Remove duplicates, keeping the earliest transaction for each group
            cleanup_query = text("""
                DELETE FROM wallet_transactions 
                WHERE id IN (
                    SELECT id FROM (
                        SELECT 
                            id,
                            ROW_NUMBER() OVER (
                                PARTITION BY child_id, contract_id, date::date, reason 
                                ORDER BY date ASC
                            ) as rn
                        FROM wallet_transactions 
                        WHERE reason = 'Récompense journalière'
                    ) ranked
                    WHERE rn > 1
                )
            """)
            
            result = await session.execute(cleanup_query)
            removed_count = result.rowcount
            
            await session.commit()
            
            print(f"✅ Successfully removed {removed_count} duplicate transactions!")
            print("💡 Kept the earliest transaction for each child/contract/date combination")
            
            return True
            
        except Exception as e:
            print(f"❌ Cleanup failed: {e}")
            await session.rollback()
            return False

if __name__ == "__main__":
    success = asyncio.run(cleanup_duplicates())
    sys.exit(0 if success else 1) 