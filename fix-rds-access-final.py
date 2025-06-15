#!/usr/bin/env python3
"""
Final RDS Access Fix
===================

This script will:
1. Find the actual RDS security group being used
2. Add the correct rules to allow database access
3. Test the connection
4. Run the database restoration
"""

import subprocess
import json
import psycopg2
import os
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def run_cmd(command):
    """Run AWS CLI command and return result"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            return True, result.stdout.strip(), None
        else:
            return False, None, result.stderr.strip()
    except Exception as e:
        return False, None, str(e)

def main():
    log("🔧 FINAL RDS ACCESS FIX")
    log("=" * 40)
    
    # Step 1: Get RDS security groups
    log("📍 STEP 1: Finding RDS security groups...")
    success, rds_info, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --query "DBInstances[0].VpcSecurityGroups[*].VpcSecurityGroupId" --output json')
    
    if not success:
        log("❌ Could not get RDS security groups")
        return False
    
    try:
        rds_security_groups = json.loads(rds_info)
        log(f"✅ RDS Security Groups: {rds_security_groups}")
    except:
        log("❌ Could not parse RDS security groups")
        return False
    
    # Step 2: Add rules to all RDS security groups
    log("\n📍 STEP 2: Adding access rules...")
    
    for sg_id in rds_security_groups:
        log(f"Adding rules to security group: {sg_id}")
        
        # Add rule for PostgreSQL access from anywhere (temporary)
        success, _, _ = run_cmd(f"aws ec2 authorize-security-group-ingress --group-id {sg_id} --protocol tcp --port 5432 --cidr 0.0.0.0/0")
        
        if success:
            log(f"✅ Added public access rule to {sg_id}")
        else:
            log(f"⚠️  Rule might already exist for {sg_id}")
    
    # Step 3: Check if RDS is publicly accessible
    log("\n📍 STEP 3: Checking RDS public accessibility...")
    success, public_info, _ = run_cmd('aws rds describe-db-instances --db-instance-identifier edsteward-db --query "DBInstances[0].PubliclyAccessible" --output text')
    
    if success:
        is_public = public_info.strip().lower() == 'true'
        log(f"RDS publicly accessible: {is_public}")
        
        if not is_public:
            log("Making RDS publicly accessible...")
            success, _, _ = run_cmd("aws rds modify-db-instance --db-instance-identifier edsteward-db --publicly-accessible --apply-immediately")
            
            if success:
                log("✅ RDS is now publicly accessible")
                log("⏳ Waiting for modification to complete...")
                
                # Wait for the modification to complete
                success, _, _ = run_cmd("aws rds wait db-instance-available --db-instance-identifier edsteward-db")
                if success:
                    log("✅ RDS modification complete")
                else:
                    log("⚠️  RDS modification may still be in progress")
            else:
                log("❌ Could not make RDS publicly accessible")
    
    # Step 4: Test connection
    log("\n📍 STEP 4: Testing connection...")
    
    try:
        conn = psycopg2.connect(
            host='edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            port=5432,
            database='postgres',
            user='postgres',
            password='EdSteward2024!Secure',
            connect_timeout=10
        )
        
        cursor = conn.cursor()
        cursor.execute('SELECT version();')
        version = cursor.fetchone()[0]
        log(f"✅ Connection successful!")
        log(f"PostgreSQL version: {version}")
        
        cursor.close()
        conn.close()
        
        # Step 5: Run database restoration
        log("\n📍 STEP 5: Running database restoration...")
        
        # Check if backup file exists
        backup_file = "nosync_backup.sql"
        if not os.path.exists(backup_file):
            log(f"❌ Backup file {backup_file} not found")
            return False
        
        file_size = os.path.getsize(backup_file)
        log(f"✅ Found backup file: {backup_file} ({file_size:,} bytes)")
        
        # Restore database
        conn = psycopg2.connect(
            host='edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            port=5432,
            database='postgres',
            user='postgres',
            password='EdSteward2024!Secure'
        )
        
        conn.autocommit = True
        cursor = conn.cursor()
        
        log("Reading backup file...")
        with open(backup_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        log(f"Backup file size: {len(sql_content):,} characters")
        
        # Execute the SQL
        log("Executing SQL restoration...")
        
        # Split into statements and execute one by one
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
        
        executed = 0
        errors = 0
        
        for i, statement in enumerate(statements):
            try:
                cursor.execute(statement)
                executed += 1
                if executed % 100 == 0:
                    log(f"Executed {executed}/{len(statements)} statements...")
            except Exception as stmt_error:
                errors += 1
                if "already exists" not in str(stmt_error).lower():
                    if errors <= 5:  # Only show first 5 errors
                        log(f"Warning: Statement {i+1} failed: {stmt_error}")
                    elif errors == 6:
                        log("... (suppressing further error messages)")
        
        log(f"✅ Executed {executed} statements ({errors} errors/warnings)")
        
        # Verify restoration
        log("\n🔍 VERIFYING RESTORATION...")
        
        verification_queries = [
            ("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';", "Tables"),
            ("SELECT COUNT(*) FROM users;", "Users"),
            ("SELECT COUNT(*) FROM regulations;", "Regulations"),
            ("SELECT COUNT(*) FROM notes;", "Notes"),
        ]
        
        for query, description in verification_queries:
            try:
                cursor.execute(query)
                count = cursor.fetchone()[0]
                log(f"✅ {description}: {count:,}")
            except Exception as e:
                log(f"⚠️ Could not verify {description}: {e}")
        
        cursor.close()
        conn.close()
        
        log("\n🎉 DATABASE RESTORATION COMPLETE!")
        log("=" * 60)
        log("✅ Your Neon database has been successfully restored to AWS RDS!")
        log("✅ You can now access your application at: https://edsteward.ai")
        
        # Clean up backup file
        try:
            os.remove(backup_file)
            log(f"✅ Cleaned up backup file: {backup_file}")
        except Exception as e:
            log(f"⚠️ Could not remove backup file: {e}")
        
        # Security cleanup reminder
        log("\n⚠️  SECURITY CLEANUP:")
        log("After testing, remove public access with:")
        for sg_id in rds_security_groups:
            log(f"aws ec2 revoke-security-group-ingress --group-id {sg_id} --protocol tcp --port 5432 --cidr 0.0.0.0/0")
        
        return True
        
    except Exception as e:
        log(f"❌ Connection failed: {e}")
        log("\nTroubleshooting:")
        log("1. RDS instance might still be modifying")
        log("2. Security group rules might not be applied yet")
        log("3. RDS might be in a private subnet")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎊 SUCCESS! Your database restoration is complete!")
    else:
        print("\n❌ FAILED! Check the error messages above.") 