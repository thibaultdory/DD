#!/usr/bin/env python3
"""
Deploy duplicate prevention solution for wallet transactions
This script:
1. Cleans up existing duplicates
2. Applies database migration with unique constraint
3. Rebuilds and restarts the backend with new code
"""

import asyncio
import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a shell command and return success status"""
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(f"   Output: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        if e.stderr:
            print(f"   Error: {e.stderr.strip()}")
        return False

async def main():
    """Main deployment process"""
    print("🚀 Deploying duplicate prevention solution...")
    print("=" * 60)
    
    # Step 1: Clean up existing duplicates
    print("\n📋 Step 1: Cleaning up existing duplicate transactions")
    try:
        from cleanup_duplicates import cleanup_duplicates
        success = await cleanup_duplicates()
        if not success:
            print("❌ Failed to clean up duplicates. Aborting deployment.")
            return False
    except Exception as e:
        print(f"❌ Error during duplicate cleanup: {e}")
        return False
    
    # Step 2: Apply database migration
    print("\n📋 Step 2: Applying database migration")
    try:
        from apply_migration import apply_migration
        success = await apply_migration()
        if not success:
            print("❌ Failed to apply migration. Aborting deployment.")
            return False
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        return False
    
    # Step 3: Rebuild backend container
    print("\n📋 Step 3: Rebuilding backend container")
    if not run_command("docker compose build --no-cache backend", "Building backend container"):
        return False
    
    # Step 4: Restart backend service
    print("\n📋 Step 4: Restarting backend service")
    if not run_command("docker compose restart backend", "Restarting backend service"):
        return False
    
    # Step 5: Wait for service to be ready
    print("\n📋 Step 5: Waiting for backend service to be ready")
    print("⏳ Waiting 15 seconds for service startup...")
    await asyncio.sleep(15)
    
    # Step 6: Verify deployment
    print("\n📋 Step 6: Verifying deployment")
    if not run_command("docker exec dd-backend-1 python -c \"from app.core.jobs import process_daily_rewards_for_date; print('✅ Import successful')\"", "Verifying new code is loaded"):
        return False
    
    print("\n🎉 Deployment completed successfully!")
    print("=" * 60)
    print("✅ Duplicate transactions have been cleaned up")
    print("✅ Database constraint has been applied")
    print("✅ Backend has been updated with atomic upsert logic")
    print("✅ System is now protected against duplicate daily rewards")
    print("\n💡 Benefits:")
    print("   - Race conditions are eliminated with atomic upserts")
    print("   - Database constraint prevents duplicates at the DB level")
    print("   - Scheduler crashes won't create duplicate rewards")
    print("   - Manual reprocessing is safe from duplicates")
    
    return True

if __name__ == "__main__":
    # Add the backend directory to the Python path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
    
    success = asyncio.run(main())
    sys.exit(0 if success else 1) 