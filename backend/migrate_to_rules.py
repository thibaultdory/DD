#!/usr/bin/env python3
"""
Migration script to convert from embedded contract rules to global rules system.
This script will:
1. Create the new rules table
2. Create the new contract_rules association table
3. Migrate existing contract rules to global rules
4. Update contracts to reference the new rules
5. Drop the old contract_rules table
"""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select
from app.core.config import settings
from app.models.base import Base
from app.models.rule import Rule
from app.models.contract import Contract
from app.models.contract_rule import contract_rules

# Create async engine
engine = create_async_engine(settings.database_url)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def migrate_to_rules():
    """Main migration function"""
    print("Starting migration to rules system...")
    
    async with engine.begin() as conn:
        # Step 1: Create new tables
        print("Creating new tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        # Step 2: Check if old contract_rules table exists and has data
        try:
            result = await conn.execute(text("SELECT COUNT(*) FROM contract_rules WHERE description IS NOT NULL"))
            old_rules_count = result.scalar()
            print(f"Found {old_rules_count} old contract rules to migrate")
            
            if old_rules_count > 0:
                # Step 3: Migrate existing contract rules to global rules
                print("Migrating existing contract rules to global rules...")
                
                # Get all unique rules from old contract_rules
                old_rules_result = await conn.execute(text("""
                    SELECT DISTINCT description, is_task 
                    FROM contract_rules 
                    WHERE description IS NOT NULL
                """))
                old_rules = old_rules_result.fetchall()
                
                # Create global rules
                rule_mapping = {}  # description -> rule_id
                for description, is_task in old_rules:
                    rule_id = str(uuid.uuid4())
                    rule_mapping[description] = rule_id
                    
                    await conn.execute(text("""
                        INSERT INTO rules (id, description, is_task, active)
                        VALUES (:id, :description, :is_task, :active)
                    """), {
                        'id': rule_id,
                        'description': description,
                        'is_task': is_task,
                        'active': True
                    })
                
                print(f"Created {len(rule_mapping)} global rules")
                
                # Step 4: Create contract-rule associations
                print("Creating contract-rule associations...")
                
                # Get all contract-rule relationships from old table
                contract_rules_result = await conn.execute(text("""
                    SELECT contract_id, description 
                    FROM contract_rules 
                    WHERE description IS NOT NULL
                """))
                contract_rule_relationships = contract_rules_result.fetchall()
                
                # Create associations in new table
                for contract_id, description in contract_rule_relationships:
                    rule_id = rule_mapping[description]
                    await conn.execute(text("""
                        INSERT INTO contract_rules (contract_id, rule_id)
                        VALUES (:contract_id, :rule_id)
                        ON CONFLICT DO NOTHING
                    """), {
                        'contract_id': contract_id,
                        'rule_id': rule_id
                    })
                
                print(f"Created {len(contract_rule_relationships)} contract-rule associations")
                
                # Step 5: Drop old contract_rules table
                print("Dropping old contract_rules table...")
                await conn.execute(text("DROP TABLE IF EXISTS contract_rules_old"))
                await conn.execute(text("ALTER TABLE contract_rules RENAME TO contract_rules_old"))
                
                # Recreate the association table
                await conn.execute(text("""
                    CREATE TABLE contract_rules (
                        contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
                        rule_id UUID REFERENCES rules(id) ON DELETE CASCADE,
                        PRIMARY KEY (contract_id, rule_id)
                    )
                """))
                
                # Re-insert the associations
                for contract_id, description in contract_rule_relationships:
                    rule_id = rule_mapping[description]
                    await conn.execute(text("""
                        INSERT INTO contract_rules (contract_id, rule_id)
                        VALUES (:contract_id, :rule_id)
                        ON CONFLICT DO NOTHING
                    """), {
                        'contract_id': contract_id,
                        'rule_id': rule_id
                    })
                
                # Drop the old table
                await conn.execute(text("DROP TABLE contract_rules_old"))
                
            else:
                print("No old contract rules found, creating initial rules...")
                # Create some initial rules from the static list
                initial_rules = [
                    {"description": "Pas péter près des autres", "is_task": False},
                    {"description": "Pas de doigt dans le nez ni la bouche", "is_task": False},
                    {"description": "Pas de crise", "is_task": False},
                    {"description": "Pas roter", "is_task": False},
                    {"description": "Pas sortir de son lit le soir", "is_task": False},
                    {"description": "Faire toutes les tâches du tableau", "is_task": True},
                    {"description": "Pas de violence", "is_task": False},
                ]
                
                for rule_data in initial_rules:
                    rule_id = str(uuid.uuid4())
                    await conn.execute(text("""
                        INSERT INTO rules (id, description, is_task, active)
                        VALUES (:id, :description, :is_task, :active)
                    """), {
                        'id': rule_id,
                        'description': rule_data['description'],
                        'is_task': rule_data['is_task'],
                        'active': True
                    })
                
                print(f"Created {len(initial_rules)} initial rules")
                
        except Exception as e:
            print(f"Error during migration: {e}")
            # If old table doesn't exist, just create initial rules
            print("Creating initial rules...")
            initial_rules = [
                {"description": "Pas péter près des autres", "is_task": False},
                {"description": "Pas de doigt dans le nez ni la bouche", "is_task": False},
                {"description": "Pas de crise", "is_task": False},
                {"description": "Pas roter", "is_task": False},
                {"description": "Pas sortir de son lit le soir", "is_task": False},
                {"description": "Faire toutes les tâches du tableau", "is_task": True},
                {"description": "Pas de violence", "is_task": False},
            ]
            
            for rule_data in initial_rules:
                rule_id = str(uuid.uuid4())
                await conn.execute(text("""
                    INSERT INTO rules (id, description, is_task, active)
                    VALUES (:id, :description, :is_task, :active)
                    ON CONFLICT DO NOTHING
                """), {
                    'id': rule_id,
                    'description': rule_data['description'],
                    'is_task': rule_data['is_task'],
                    'active': True
                })
            
            print(f"Created {len(initial_rules)} initial rules")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate_to_rules()) 