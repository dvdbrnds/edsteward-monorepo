#!/usr/bin/env python3
"""
Migrate Local Database to AWS RDS
=================================

This script migrates the working local PostgreSQL database to AWS RDS,
preserving all regulations data and schema.
"""

import os
import subprocess
import boto3
import psycopg2
import sys
from datetime import datetime

# AWS RDS Configuration
RDS_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'edsteward',
    'username': 'postgres',
    'password': 'password123'
}

# Local Database Configuration
LOCAL_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'devdb',
    'username': 'devuser',
    'password': 'devpass'
}

def run_command(cmd, description):
    """Run a shell command and return the result"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        print(f"✅ {description} completed successfully")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Command: {cmd}")
        print(f"   Error: {e.stderr}")
        return None

def test_database_connection(config, db_type):
    """Test database connection"""
    try:
        print(f"🔄 Testing {db_type} database connection...")
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['username'],
            password=config['password']
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM regulations;")
        count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        print(f"✅ {db_type} connection successful: {count} regulations found")
        return True, count
    except Exception as e:
        print(f"❌ {db_type} connection failed: {e}")
        return False, 0

def create_backup():
    """Create a backup of the local database"""
    backup_file = f"local_to_aws_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    
    cmd = f"""docker exec regulatorytrackr-postgres-dev-1 pg_dump \\
        -U {LOCAL_CONFIG['username']} \\
        -d {LOCAL_CONFIG['database']} \\
        --clean --no-owner --no-privileges \\
        > {backup_file}"""
    
    result = run_command(cmd, f"Creating local database backup: {backup_file}")
    if result is not None:
        # Check backup size
        try:
            size = os.path.getsize(backup_file)
            print(f"📁 Backup file size: {size:,} bytes")
            return backup_file
        except:
            print("❌ Backup file not created properly")
            return None
    return None

def prepare_backup_for_aws(backup_file):
    """Prepare the backup file for AWS restoration"""
    print("🔄 Preparing backup for AWS restoration...")
    
    # Read the backup file
    try:
        with open(backup_file, 'r') as f:
            content = f.read()
        
        # Remove problematic elements for AWS
        # Remove role/user references that don't exist in AWS
        content = content.replace('SET row_security = off;', '')
        content = content.replace('devuser', 'edsteward')
        content = content.replace('devdb', 'edsteward')
        
        # Create AWS-compatible backup
        aws_backup_file = backup_file.replace('.sql', '_aws_ready.sql')
        with open(aws_backup_file, 'w') as f:
            f.write(content)
        
        print(f"✅ AWS-ready backup created: {aws_backup_file}")
        return aws_backup_file
        
    except Exception as e:
        print(f"❌ Failed to prepare backup: {e}")
        return None

def clear_aws_database():
    """Clear the AWS database before restoration"""
    print("🔄 Clearing AWS database...")
    
    try:
        conn = psycopg2.connect(
            host=RDS_CONFIG['host'],
            port=RDS_CONFIG['port'],
            database=RDS_CONFIG['database'],
            user=RDS_CONFIG['username'],
            password=RDS_CONFIG['password']
        )
        
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Drop existing tables in correct order
        tables_to_drop = [
            'regulation_updates',
            'user_sessions', 
            'users',
            'regulations'
        ]
        
        for table in tables_to_drop:
            try:
                cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
                print(f"   Dropped table: {table}")
            except Exception as e:
                print(f"   Warning: Could not drop {table}: {e}")
        
        cursor.close()
        conn.close()
        
        print("✅ AWS database cleared successfully")
        return True
        
    except Exception as e:
        print(f"❌ Failed to clear AWS database: {e}")
        return False

def restore_to_aws(backup_file):
    """Restore the backup to AWS RDS"""
    print("🔄 Restoring backup to AWS RDS...")
    
    # Use psql to restore the backup
    cmd = f"""PGPASSWORD={RDS_CONFIG['password']} psql \\
        -h {RDS_CONFIG['host']} \\
        -p {RDS_CONFIG['port']} \\
        -U {RDS_CONFIG['username']} \\
        -d {RDS_CONFIG['database']} \\
        -f {backup_file}"""
    
    result = run_command(cmd, "Restoring database to AWS")
    return result is not None

def verify_migration():
    """Verify the migration was successful"""
    print("🔄 Verifying migration...")
    
    # Test local count
    local_success, local_count = test_database_connection(LOCAL_CONFIG, "Local")
    if not local_success:
        return False
    
    # Test AWS count
    aws_success, aws_count = test_database_connection(RDS_CONFIG, "AWS")
    if not aws_success:
        return False
    
    if local_count == aws_count:
        print(f"✅ Migration verified! Both databases have {local_count} regulations")
        return True
    else:
        print(f"⚠️  Count mismatch: Local={local_count}, AWS={aws_count}")
        return False

def update_aws_deployment():
    """Update the AWS deployment to use the restored database"""
    print("🔄 Triggering AWS deployment restart...")
    
    try:
        ecs = boto3.client('ecs', region_name='us-east-1')
        
        # Force a new deployment to pick up the database changes
        response = ecs.update_service(
            cluster='edsteward-cluster',
            service='edsteward-service',
            forceNewDeployment=True
        )
        
        print("✅ AWS deployment restart triggered")
        print("   New deployment will pick up the restored database")
        return True
        
    except Exception as e:
        print(f"❌ Failed to trigger deployment: {e}")
        return False

def main():
    """Main migration process"""
    print("🚀 Starting Local Database to AWS Migration")
    print("=" * 50)
    
    # Step 1: Test local database connection
    print("\n📋 Step 1: Testing Local Database")
    local_success, local_count = test_database_connection(LOCAL_CONFIG, "Local")
    if not local_success or local_count == 0:
        print("❌ Local database not accessible or empty. Ensure Docker is running.")
        return False
    
    # Step 2: Test AWS database connection  
    print("\n📋 Step 2: Testing AWS Database Connection")
    aws_success, aws_count = test_database_connection(RDS_CONFIG, "AWS")
    if not aws_success:
        print("❌ Cannot connect to AWS database. Check credentials and network.")
        return False
    
    print(f"📊 Current status: Local={local_count} regulations, AWS={aws_count} regulations")
    
    # Confirm migration
    if aws_count > 0:
        confirm = input(f"\n⚠️  AWS database has {aws_count} regulations. Continue? (y/N): ")
        if confirm.lower() != 'y':
            print("❌ Migration cancelled by user")
            return False
    
    # Step 3: Create backup
    print("\n📋 Step 3: Creating Local Database Backup")
    backup_file = create_backup()
    if not backup_file:
        print("❌ Failed to create backup")
        return False
    
    # Step 4: Prepare backup for AWS
    print("\n📋 Step 4: Preparing Backup for AWS")
    aws_backup_file = prepare_backup_for_aws(backup_file)
    if not aws_backup_file:
        print("❌ Failed to prepare backup for AWS")
        return False
    
    # Step 5: Clear AWS database
    print("\n📋 Step 5: Clearing AWS Database")
    if not clear_aws_database():
        print("❌ Failed to clear AWS database")
        return False
    
    # Step 6: Restore to AWS
    print("\n📋 Step 6: Restoring to AWS RDS")
    if not restore_to_aws(aws_backup_file):
        print("❌ Failed to restore to AWS")
        return False
    
    # Step 7: Verify migration
    print("\n📋 Step 7: Verifying Migration")
    if not verify_migration():
        print("❌ Migration verification failed")
        return False
    
    # Step 8: Update AWS deployment
    print("\n📋 Step 8: Updating AWS Deployment")
    if not update_aws_deployment():
        print("⚠️  Database migrated but deployment restart failed")
        print("   You may need to restart the ECS service manually")
    
    print("\n🎉 Migration completed successfully!")
    print("✅ Local database has been migrated to AWS RDS")
    print("✅ AWS application should now have access to all regulations")
    print(f"✅ Total regulations migrated: {local_count}")
    
    # Cleanup
    print(f"\n🧹 Cleaning up backup files...")
    for file in [backup_file, aws_backup_file]:
        try:
            os.remove(file)
            print(f"   Removed: {file}")
        except:
            pass
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 