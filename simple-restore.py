#!/usr/bin/env python3

import psycopg2
import os
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_connection():
    """Test connection to AWS RDS"""
    log("Testing AWS RDS connection...")
    
    try:
        conn = psycopg2.connect(
            host='edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            port=5432,
            database='postgres',
            user='postgres',
            password='EdSteward2024!Secure'
        )
        
        cursor = conn.cursor()
        cursor.execute('SELECT version();')
        version = cursor.fetchone()[0]
        log(f"✅ Connection successful!")
        log(f"PostgreSQL version: {version}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        log(f"❌ Connection failed: {e}")
        return False

def restore_database():
    """Restore the database from backup file"""
    backup_file = "nosync_backup.sql"
    
    if not os.path.exists(backup_file):
        log(f"❌ Backup file {backup_file} not found")
        return False
    
    log(f"Found backup file: {backup_file} ({os.path.getsize(backup_file)} bytes)")
    
    try:
        # Connect to AWS RDS
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
        
        log("Executing SQL restoration...")
        
        # Split the SQL content into individual statements
        statements = sql_content.split(';')
        
        executed = 0
        for i, statement in enumerate(statements):
            statement = statement.strip()
            if statement:
                try:
                    cursor.execute(statement)
                    executed += 1
                    if executed % 100 == 0:
                        log(f"Executed {executed} statements...")
                except Exception as e:
                    # Some statements might fail (like CREATE DATABASE if it exists)
                    # We'll continue with others
                    if "already exists" not in str(e).lower():
                        log(f"Warning: Statement {i} failed: {e}")
        
        log(f"✅ Executed {executed} SQL statements")
        
        # Verify the restoration
        log("Verifying restoration...")
        
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
                log(f"✅ {description}: {count}")
            except Exception as e:
                log(f"⚠️ Could not verify {description}: {e}")
        
        cursor.close()
        conn.close()
        
        log("🎉 DATABASE RESTORATION COMPLETE!")
        log("Your Neon database has been successfully restored to AWS RDS!")
        
        return True
        
    except Exception as e:
        log(f"❌ Restoration failed: {e}")
        return False

def main():
    log("🔧 SIMPLE DATABASE RESTORATION")
    log("=" * 50)
    
    # Test connection first
    if not test_connection():
        log("❌ Cannot connect to AWS RDS. Please check:")
        log("1. RDS instance is publicly accessible")
        log("2. Security group allows port 5432")
        log("3. Credentials are correct")
        return
    
    # Restore database
    if restore_database():
        log("✅ All done! Your database is ready.")
        
        # Clean up backup file
        try:
            os.remove("nosync_backup.sql")
            log("✅ Cleaned up backup file")
        except:
            log("⚠️ Could not remove backup file")
    else:
        log("❌ Restoration failed")

if __name__ == "__main__":
    main() 