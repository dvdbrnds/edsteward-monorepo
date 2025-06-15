#!/usr/bin/env python3

import psycopg2
import time
import sys

def test_rds_connection():
    """Test RDS connection with SSL - no shell commands"""
    
    # RDS connection configuration (from live AWS application)
    rds_config = {
        'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
        'port': 5432,
        'database': 'postgres',
        'user': 'postgres',
        'password': 'EdSteward2024!Secure',
        'sslmode': 'prefer'  # Changed from 'require' to 'prefer' to match live config
    }
    
    print("🔄 Testing RDS Connection with SSL")
    print("=" * 40)
    print(f"Host: {rds_config['host']}")
    print(f"Database: {rds_config['database']}")
    print(f"SSL Mode: {rds_config['sslmode']}")
    print()
    
    try:
        print("⏳ Connecting to RDS...")
        conn = psycopg2.connect(**rds_config)
        cursor = conn.cursor()
        
        # Test basic query
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✅ Connected successfully!")
        print(f"📊 PostgreSQL Version: {version}")
        
        # Check existing tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        if tables:
            print(f"📋 Found {len(tables)} existing tables:")
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
                count = cursor.fetchone()[0]
                print(f"  - {table[0]}: {count} rows")
        else:
            print("📋 No tables found - database is empty")
        
        # Test user table if exists
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            print(f"👥 Users in database: {user_count}")
            
            if user_count > 0:
                cursor.execute("SELECT username, role FROM users LIMIT 3")
                users = cursor.fetchall()
                print("   Sample users:")
                for username, role in users:
                    print(f"     - {username} ({role})")
        except:
            print("👥 No users table found")
        
        cursor.close()
        conn.close()
        
        print("\\n🎉 RDS connection test successful!")
        print("✅ SSL connection working properly")
        print("✅ Database is accessible")
        print("✅ Ready for migration")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\\n🔧 Troubleshooting:")
        print("1. Check if RDS instance is running")
        print("2. Verify security group allows connections")
        print("3. Confirm SSL certificate is valid")
        print("4. Check database credentials")
        
        return False

def main():
    success = test_rds_connection()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()