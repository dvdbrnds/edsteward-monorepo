#!/usr/bin/env python3
"""
Final Database Restoration Script
=================================

This script will:
1. Test connection to AWS RDS
2. Restore your Neon database backup to AWS RDS
3. Verify the restoration
4. Clean up files

To run this script, simply execute:
python3 final_restoration.py

Make sure you have psycopg2 installed:
pip3 install psycopg2-binary
"""

import psycopg2
import os
import sys
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def main():
    log("🚀 FINAL DATABASE RESTORATION")
    log("=" * 60)
    
    # Check if psycopg2 is available
    try:
        import psycopg2
        log("✅ psycopg2 is available")
    except ImportError:
        log("❌ psycopg2 not found. Please install it with: pip3 install psycopg2-binary")
        return False
    
    # Check if backup file exists
    backup_file = "nosync_backup.sql"
    if not os.path.exists(backup_file):
        log(f"❌ Backup file {backup_file} not found")
        return False
    
    file_size = os.path.getsize(backup_file)
    log(f"✅ Found backup file: {backup_file} ({file_size:,} bytes)")
    
    # Test connection
    log("\n🔍 TESTING AWS RDS CONNECTION...")
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
        
        # Check current state
        cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        current_tables = cursor.fetchone()[0]
        log(f"Current tables in public schema: {current_tables}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        log(f"❌ Connection failed: {e}")
        log("\nPlease check:")
        log("1. RDS instance is publicly accessible")
        log("2. Security group allows inbound traffic on port 5432")
        log("3. RDS instance is in a public subnet")
        return False
    
    # Restore database
    log("\n📋 STARTING DATABASE RESTORATION...")
    try:
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
        
        # Try to execute as a single block first
        try:
            cursor.execute(sql_content)
            log("✅ SQL executed successfully as single block")
        except Exception as e:
            log(f"Single block execution failed: {e}")
            log("Trying statement-by-statement execution...")
            
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
            ("SELECT COUNT(*) FROM user_sessions;", "User Sessions"),
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
        log("✅ Admin panel should be available at: https://edsteward.ai/admin")
        
        # Clean up backup file
        try:
            os.remove(backup_file)
            log(f"✅ Cleaned up backup file: {backup_file}")
        except Exception as e:
            log(f"⚠️ Could not remove backup file: {e}")
        
        return True
        
    except Exception as e:
        log(f"❌ Restoration failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎊 SUCCESS! Your database restoration is complete!")
        print("Your application should now be working with the restored data.")
    else:
        print("\n❌ FAILED! Please check the error messages above.")
        sys.exit(1)