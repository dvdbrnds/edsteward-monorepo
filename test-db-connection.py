#!/usr/bin/env python3

import psycopg2
import sys

def test_database_connection():
    """Test direct connection to RDS database"""
    
    # Database connection details
    DB_HOST = "edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
    DB_USER = "postgres"
    DB_PASSWORD = "EdSteward2024!Secure"
    DB_NAME = "edsteward"
    DB_PORT = 5432
    
    print("🔍 Testing RDS Database Connection")
    print("=" * 40)
    print(f"Host: {DB_HOST}")
    print(f"Port: {DB_PORT}")
    print(f"Database: {DB_NAME}")
    print(f"User: {DB_USER}")
    print()
    
    try:
        print("🔄 Attempting to connect...")
        
        # Create connection
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10
        )
        
        print("✅ Connection successful!")
        
        # Test basic query
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"📊 PostgreSQL Version: {version}")
        
        # Check if regulations table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'regulations'
            );
        """)
        table_exists = cursor.fetchone()[0]
        print(f"📋 Regulations table exists: {table_exists}")
        
        if table_exists:
            # Count regulations
            cursor.execute("SELECT COUNT(*) FROM regulations;")
            count = cursor.fetchone()[0]
            print(f"📊 Current regulation count: {count}")
            
            if count > 0:
                # Show sample regulation
                cursor.execute("SELECT id, name, category FROM regulations LIMIT 1;")
                sample = cursor.fetchone()
                print(f"📋 Sample regulation: ID={sample[0]}, Name='{sample[1]}', Category='{sample[2]}'")
            else:
                print("⚠️  Regulations table is empty!")
        
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.OperationalError as e:
        print(f"❌ Connection failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_database_connection()
    if not success:
        print("\n💡 Possible issues:")
        print("- RDS instance is in private subnets (not publicly accessible)")
        print("- Security groups blocking connection")
        print("- Wrong credentials")
        print("- RDS instance is stopped/unavailable")
        sys.exit(1)
    else:
        print("\n✅ Database connection test passed!") 