#!/usr/bin/env python3
"""
Fix wallet_transactions.date_only to match wallet_transactions.date::date.

This is safe to run multiple times.
"""

import asyncio
import logging

from sqlalchemy import text

from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


SQL = [
    # Backfill incorrect values (including rows inserted while a DEFAULT CURRENT_DATE existed)
    """
    UPDATE wallet_transactions
    SET date_only = date::date
    WHERE date_only IS DISTINCT FROM date::date
    """,
    # Remove dangerous default (application code now always sets date_only explicitly)
    """
    ALTER TABLE wallet_transactions
    ALTER COLUMN date_only DROP DEFAULT
    """,
]


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("Applying wallet_transactions.date_only fix...")

    async with AsyncSessionLocal() as session:
        for stmt in SQL:
            await session.execute(text(stmt))
        await session.commit()

    logger.info("✅ wallet_transactions.date_only fix applied.")


if __name__ == "__main__":
    asyncio.run(main())

