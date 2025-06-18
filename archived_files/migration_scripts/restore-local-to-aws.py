#!/usr/bin/env python3
"""
Restore Local Database to AWS RDS
=================================

This script will:
1. Create a backup of your local database
2. Restore it to the AWS RDS instance
3. Verify the restoration was successful
"""

import subprocess
import os
import sys
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_command(command, description):
    """Run a shell command and return the result"""
    log(f"Running: {description}")
    log(f"Command: {command}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            log(f"✅ Success: {description}")
            if result.stdout:
                log(f"Output: {result.stdout.strip()}")
            return True
        else:
            log(f"❌ Failed: {description}")
            log(f"Error: {result.stderr}")
            return False
    except Exception as e:
        log(f"❌ Exception during {description}: {e}")
        return False

def main():
    log("🚀 STARTING LOCAL TO AWS DATABASE RESTORATION")
    log("=" * 60)
    
    # Database connection details
    LOCAL_DB = "postgresql://neondb_owner:npg_fuL3z9rnkmwg@ep-tiny-cell-a6vwfmeh.us-west-2.aws.neon.tech/neondb?sslmode=require"
    AWS_DB = "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require"
    
    # Create backup filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"local_backup_{timestamp}.sql"
    
    log("Step 1: Creating backup of local database...")
    pg_dump_cmd = f'pg_dump "{LOCAL_DB}" > {backup_file}'
    
    if not run_command(pg_dump_cmd, "Create local database backup"):
        log("❌ Failed to create backup. Exiting.")
        return
    
    # Check if backup file was created and has content
    if os.path.exists(backup_file) and os.path.getsize(backup_file) > 0:
        log(f"✅ Backup created: {backup_file} ({os.path.getsize(backup_file)} bytes)")
    else:
        log("❌ Backup file is empty or doesn't exist. Exiting.")
        return
    
    log("Step 2: Restoring backup to AWS RDS...")
    
    # First, let's test the connection to AWS
    test_cmd = f'psql "{AWS_DB}" -c "SELECT version();"'
    if not run_command(test_cmd, "Test AWS RDS connection"):
        log("❌ Cannot connect to AWS RDS. Check your connection string.")
        return
    
    # Restore the backup to AWS
    restore_cmd = f'psql "{AWS_DB}" < {backup_file}'
    
    if not run_command(restore_cmd, "Restore backup to AWS RDS"):
        log("❌ Failed to restore backup to AWS RDS.")
        return
    
    log("Step 3: Verifying restoration...")
    
    # Check table counts
    verify_commands = [
        ('psql "{}" -c "SELECT COUNT(*) FROM users;"'.format(AWS_DB), "Count users table"),
        ('psql "{}" -c "SELECT COUNT(*) FROM regulations;"'.format(AWS_DB), "Count regulations table"),
        ('psql "{}" -c "SELECT COUNT(*) FROM notes;"'.format(AWS_DB), "Count notes table"),
    ]
    
    for cmd, desc in verify_commands:
        run_command(cmd, desc)
    
    log("Step 4: Cleanup...")
    try:
        os.remove(backup_file)
        log(f"✅ Cleaned up backup file: {backup_file}")
    except:
        log(f"⚠️ Could not remove backup file: {backup_file}")
    
    log("🎉 DATABASE RESTORATION COMPLETE!")
    log("=" * 60)
    log("Your local database has been restored to AWS RDS.")
    log("You can now access it through the admin interface at:")
    log("https://edsteward.ai/admin")

if __name__ == "__main__":
    # Check if required tools are available
    tools = ['pg_dump', 'psql']
    missing_tools = []
    
    for tool in tools:
        if subprocess.run(['which', tool], capture_output=True).returncode != 0:
            missing_tools.append(tool)
    
    if missing_tools:
        print(f"❌ Missing required tools: {', '.join(missing_tools)}")
        print("Please install PostgreSQL client tools:")
        print("  macOS: brew install postgresql")
        print("  Ubuntu: sudo apt-get install postgresql-client")
        sys.exit(1)
    
    main() 