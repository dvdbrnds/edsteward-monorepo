#!/usr/bin/env python3
import psycopg2
import hashlib
import sys

def main():
    print("🔧 FIXING DATABASE TABLES")
    print("Creating tables and admin user directly...")
    print("=" * 50)
    
    # Database connection details
    db_config = {
        'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
        'port': 5432,
        'database': 'edsteward',
        'user': 'edsteward',
        'password': 'edsteward123',
        'sslmode': 'disable'
    }
    
    try:
        # Connect to database
        print("📡 Connecting to database...")
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()
        
        print("✅ Connected successfully!")
        
        # Create users table
        create_users_table(cursor)
        
        # Create system_logs table
        create_system_logs_table(cursor)
        
        # Create admin user
        create_admin_user(cursor)
        
        # Commit changes
        conn.commit()
        print("\n✅ All changes committed successfully!")
        
        # Verify tables exist
        verify_tables(cursor)
        
        # Verify admin user exists
        verify_admin_user(cursor)
        
        cursor.close()
        conn.close()
        
        print("\n🎉 DATABASE SETUP COMPLETE!")
        print("You should now be able to login with:")
        print("   Username: admin")
        print("   Password: admin123")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def create_users_table(cursor):
    print("\n📝 Creating users table...")
    
    sql = """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        role VARCHAR(100) DEFAULT 'user',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    cursor.execute(sql)
    print("   ✅ Users table created/verified")

def create_system_logs_table(cursor):
    print("\n📝 Creating system_logs table...")
    
    sql = """
    CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        level INTEGER NOT NULL,
        message TEXT NOT NULL,
        user_id INTEGER,
        username VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    cursor.execute(sql)
    print("   ✅ System_logs table created/verified")

def create_admin_user(cursor):
    print("\n👤 Creating admin user...")
    
    # Password: admin123
    # SHA-256 hash: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
    password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
    
    sql = """
    INSERT INTO users (username, password_hash, role, email)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (username) 
    DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        updated_at = CURRENT_TIMESTAMP;
    """
    
    cursor.execute(sql, ('admin', password_hash, 'admin', 'admin@edsteward.ai'))
    print("   ✅ Admin user created/updated")

def verify_tables(cursor):
    print("\n🔍 Verifying tables exist...")
    
    # Check if tables exist
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'system_logs')
        ORDER BY table_name;
    """)
    
    tables = cursor.fetchall()
    
    if len(tables) == 2:
        print("   ✅ Both tables exist:")
        for table in tables:
            print(f"      - {table[0]}")
    else:
        print(f"   ⚠️ Only {len(tables)} tables found: {[t[0] for t in tables]}")

def verify_admin_user(cursor):
    print("\n🔍 Verifying admin user exists...")
    
    cursor.execute("SELECT username, role, active FROM users WHERE username = %s", ('admin',))
    user = cursor.fetchone()
    
    if user:
        username, role, active = user
        print(f"   ✅ Admin user found:")
        print(f"      Username: {username}")
        print(f"      Role: {role}")
        print(f"      Active: {active}")
    else:
        print("   ❌ Admin user not found!")

if __name__ == "__main__":
    main() 