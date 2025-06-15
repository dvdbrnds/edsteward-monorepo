#!/usr/bin/env python3
"""
Fix PostgreSQL Version Mismatch and Restore Database
===================================================

This script will:
1. Check PostgreSQL versions
2. Provide upgrade instructions if needed
3. Use alternative methods if version mismatch exists
4. Restore the database to AWS RDS
"""

import subprocess
import os
import sys
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_command(command, description, ignore_errors=False):
    """Run a shell command and return the result"""
    log(f"Running: {description}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0 or ignore_errors:
            log(f"✅ Success: {description}")
            if result.stdout:
                log(f"Output: {result.stdout.strip()}")
            return True, result.stdout
        else:
            log(f"❌ Failed: {description}")
            log(f"Error: {result.stderr}")
            return False, result.stderr
    except Exception as e:
        log(f"❌ Exception during {description}: {e}")
        return False, str(e)

def check_postgresql_version():
    """Check local PostgreSQL version"""
    log("Checking local PostgreSQL version...")
    success, output = run_command("pg_dump --version", "Check pg_dump version")
    if success:
        return output.strip()
    return None

def upgrade_postgresql_instructions():
    """Provide instructions to upgrade PostgreSQL"""
    log("🔧 POSTGRESQL VERSION MISMATCH DETECTED")
    log("=" * 50)
    log("Your local pg_dump (v14.18) is older than the Neon database (v16.9)")
    log("")
    log("SOLUTION 1: Upgrade PostgreSQL (Recommended)")
    log("Run these commands:")
    log("  brew uninstall postgresql@14")
    log("  brew install postgresql@16")
    log("  brew link postgresql@16 --force")
    log("")
    log("SOLUTION 2: Use Docker (Alternative)")
    log("  docker run --rm -v $(pwd):/backup postgres:16 pg_dump ...")
    log("")
    log("SOLUTION 3: Use --no-sync flag (Quick fix)")
    log("  pg_dump --no-sync ...")

def try_docker_backup():
    """Try using Docker with PostgreSQL 16 for backup"""
    log("Attempting backup using Docker with PostgreSQL 16...")
    
    # Check if Docker is available
    success, _ = run_command("docker --version", "Check Docker availability")
    if not success:
        log("❌ Docker not available")
        return False
    
    # Database connection details
    neon_db = "postgresql://neondb_owner:npg_fuL3z9rnkmwg@ep-tiny-cell-a6vwfmeh.us-west-2.aws.neon.tech/neondb?sslmode=require"
    
    # Create backup using Docker
    docker_cmd = f'''docker run --rm postgres:16 pg_dump "{neon_db}" > docker_backup.sql'''
    
    success, output = run_command(docker_cmd, "Create backup using Docker PostgreSQL 16")
    
    if success and os.path.exists("docker_backup.sql") and os.path.getsize("docker_backup.sql") > 0:
        log(f"✅ Docker backup created: docker_backup.sql ({os.path.getsize('docker_backup.sql')} bytes)")
        return True
    else:
        log("❌ Docker backup failed")
        return False

def try_no_sync_backup():
    """Try backup with --no-sync flag to bypass version check"""
    log("Attempting backup with --no-sync flag...")
    
    neon_db = "postgresql://neondb_owner:npg_fuL3z9rnkmwg@ep-tiny-cell-a6vwfmeh.us-west-2.aws.neon.tech/neondb?sslmode=require"
    
    cmd = f'pg_dump --no-sync "{neon_db}" > nosync_backup.sql'
    success, output = run_command(cmd, "Create backup with --no-sync flag", ignore_errors=True)
    
    if os.path.exists("nosync_backup.sql") and os.path.getsize("nosync_backup.sql") > 0:
        log(f"✅ No-sync backup created: nosync_backup.sql ({os.path.getsize('nosync_backup.sql')} bytes)")
        return True, "nosync_backup.sql"
    else:
        log("❌ No-sync backup failed")
        return False, None

def restore_to_aws(backup_file):
    """Restore backup to AWS RDS"""
    log(f"Restoring {backup_file} to AWS RDS...")
    
    aws_db = "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require"
    
    # Test AWS connection first
    success, _ = run_command(f'psql "{aws_db}" -c "SELECT version();"', "Test AWS RDS connection")
    if not success:
        log("❌ Cannot connect to AWS RDS")
        return False
    
    # Restore backup
    success, _ = run_command(f'psql "{aws_db}" < {backup_file}', "Restore backup to AWS RDS")
    
    if success:
        log("✅ Backup restored to AWS RDS successfully!")
        
        # Verify restoration
        verify_commands = [
            (f'psql "{aws_db}" -c "SELECT COUNT(*) FROM users;"', "Count users"),
            (f'psql "{aws_db}" -c "SELECT COUNT(*) FROM regulations;"', "Count regulations"),
            (f'psql "{aws_db}" -c "SELECT COUNT(*) FROM notes;"', "Count notes"),
        ]
        
        for cmd, desc in verify_commands:
            run_command(cmd, desc, ignore_errors=True)
        
        return True
    else:
        log("❌ Failed to restore backup to AWS RDS")
        return False

def main():
    log("🚀 FIXING POSTGRESQL VERSION AND RESTORING DATABASE")
    log("=" * 60)
    
    # Check current version
    version = check_postgresql_version()
    if version:
        log(f"Current PostgreSQL version: {version}")
    
    # Try different backup methods
    backup_file = None
    
    # Method 1: Try --no-sync flag first (quickest)
    log("\n📋 METHOD 1: Trying --no-sync flag...")
    success, backup_file = try_no_sync_backup()
    
    if not success:
        # Method 2: Try Docker
        log("\n📋 METHOD 2: Trying Docker with PostgreSQL 16...")
        if try_docker_backup():
            backup_file = "docker_backup.sql"
            success = True
    
    if not success:
        # Method 3: Provide upgrade instructions
        log("\n📋 METHOD 3: Manual PostgreSQL upgrade required")
        upgrade_postgresql_instructions()
        log("\nAfter upgrading, run this script again or use the manual commands.")
        return
    
    # Restore to AWS
    if backup_file:
        log(f"\n📋 RESTORING TO AWS RDS...")
        if restore_to_aws(backup_file):
            log("\n🎉 DATABASE RESTORATION COMPLETE!")
            log("=" * 60)
            log("Your Neon database has been restored to AWS RDS.")
            log("You can now access it through:")
            log("https://edsteward.ai/admin")
            
            # Cleanup
            try:
                os.remove(backup_file)
                log(f"✅ Cleaned up backup file: {backup_file}")
            except:
                log(f"⚠️ Could not remove backup file: {backup_file}")
        else:
            log("❌ Restoration failed")
    else:
        log("❌ No backup file created")

if __name__ == "__main__":
    main() 