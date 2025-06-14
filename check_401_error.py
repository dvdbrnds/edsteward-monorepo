#!/usr/bin/env python3
import boto3
from datetime import datetime, timedelta

def main():
    print("🔍 CHECKING 401 AUTHENTICATION ERROR")
    print("Analyzing login failure and database status...")
    print("=" * 50)
    
    logs = boto3.client('logs', region_name='us-east-1')
    
    # Check recent login attempts
    check_recent_login_attempts(logs)
    
    # Check if database tables were created
    check_database_table_creation(logs)
    
    # Check application startup logs
    check_application_startup(logs)

def check_recent_login_attempts(logs):
    try:
        print("📝 CHECKING RECENT LOGIN ATTEMPTS")
        
        # Check last 5 minutes
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=5)
        
        start_timestamp = int(start_time.timestamp() * 1000)
        end_timestamp = int(end_time.timestamp() * 1000)
        
        # Look for login-related events (avoid problematic characters)
        response = logs.filter_log_events(
            logGroupName='/aws/ecs/edsteward',
            startTime=start_timestamp,
            endTime=end_timestamp,
            filterPattern='login OR auth OR 401 OR getUserByUsername OR password OR Authentication'
        )
        
        events = response.get('events', [])
        
        if events:
            print(f"   Found {len(events)} login-related events:")
            for event in events:
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message'].strip()
                
                if '401' in message or 'Authentication' in message:
                    print(f"   ❌ {timestamp.strftime('%H:%M:%S')}: {message}")
                elif 'login' in message.lower() or 'auth' in message.lower():
                    print(f"   🔐 {timestamp.strftime('%H:%M:%S')}: {message}")
                else:
                    print(f"   📝 {timestamp.strftime('%H:%M:%S')}: {message}")
        else:
            print("   📝 No recent login attempts found")
    
    except Exception as e:
        print(f"   ❌ Error checking login logs: {e}")

def check_database_table_creation(logs):
    try:
        print(f"\n🗄️ CHECKING DATABASE TABLE CREATION")
        
        # Check last 10 minutes for table creation
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=10)
        
        start_timestamp = int(start_time.timestamp() * 1000)
        end_timestamp = int(end_time.timestamp() * 1000)
        
        # Look for table creation events
        response = logs.filter_log_events(
            logGroupName='/aws/ecs/edsteward',
            startTime=start_timestamp,
            endTime=end_timestamp,
            filterPattern='CREATE TABLE OR table OR schema OR users OR system_logs'
        )
        
        events = response.get('events', [])
        
        if events:
            print(f"   Found {len(events)} database-related events:")
            table_created = False
            for event in events:
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message'].strip()
                
                if 'CREATE TABLE' in message:
                    print(f"   ✅ {timestamp.strftime('%H:%M:%S')}: {message}")
                    table_created = True
                elif 'table' in message.lower():
                    print(f"   📝 {timestamp.strftime('%H:%M:%S')}: {message}")
                else:
                    print(f"   📝 {timestamp.strftime('%H:%M:%S')}: {message}")
            
            if not table_created:
                print(f"   ⚠️ No 'CREATE TABLE' statements found - tables may not have been created")
        else:
            print("   ❌ No database table creation events found")
            print("   🚨 This suggests the database tables were NOT created")
    
    except Exception as e:
        print(f"   ❌ Error checking database logs: {e}")

def check_application_startup(logs):
    try:
        print(f"\n🚀 CHECKING APPLICATION STARTUP")
        
        # Check last 10 minutes for startup
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=10)
        
        start_timestamp = int(start_time.timestamp() * 1000)
        end_timestamp = int(end_time.timestamp() * 1000)
        
        # Look for startup events
        response = logs.filter_log_events(
            logGroupName='/aws/ecs/edsteward',
            startTime=start_timestamp,
            endTime=end_timestamp,
            filterPattern='development OR production OR NODE_ENV OR database OR connection'
        )
        
        events = response.get('events', [])
        
        if events:
            print(f"   Found {len(events)} startup-related events:")
            development_mode = False
            database_connected = False
            
            for event in events[-10:]:  # Last 10 events
                timestamp = datetime.fromtimestamp(event['timestamp'] / 1000)
                message = event['message'].strip()
                
                if 'development' in message.lower():
                    print(f"   🔧 {timestamp.strftime('%H:%M:%S')}: {message}")
                    development_mode = True
                elif 'production' in message.lower():
                    print(f"   🏭 {timestamp.strftime('%H:%M:%S')}: {message}")
                elif 'database' in message.lower():
                    print(f"   🗄️ {timestamp.strftime('%H:%M:%S')}: {message}")
                    if 'connect' in message.lower():
                        database_connected = True
                else:
                    print(f"   📝 {timestamp.strftime('%H:%M:%S')}: {message}")
            
            print(f"\n   📊 Startup Analysis:")
            print(f"   Development Mode: {'✅ Yes' if development_mode else '❌ No'}")
            print(f"   Database Connected: {'✅ Yes' if database_connected else '❌ Unknown'}")
        else:
            print("   ❌ No startup events found")
    
    except Exception as e:
        print(f"   ❌ Error checking startup logs: {e}")

def suggest_manual_fix():
    print(f"\n🔧 MANUAL DATABASE FIX")
    print(f"If tables weren't created automatically, here's the SQL to run manually:")
    
    print(f"\n```sql")
    print(f"-- Create users table")
    print(f"CREATE TABLE IF NOT EXISTS users (")
    print(f"    id SERIAL PRIMARY KEY,")
    print(f"    username VARCHAR(255) UNIQUE NOT NULL,")
    print(f"    password_hash VARCHAR(255) NOT NULL,")
    print(f"    email VARCHAR(255),")
    print(f"    role VARCHAR(100) DEFAULT 'user',")
    print(f"    active BOOLEAN DEFAULT true,")
    print(f"    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,")
    print(f"    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
    print(f");")
    print(f"")
    print(f"-- Create system_logs table")
    print(f"CREATE TABLE IF NOT EXISTS system_logs (")
    print(f"    id SERIAL PRIMARY KEY,")
    print(f"    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,")
    print(f"    level INTEGER NOT NULL,")
    print(f"    message TEXT NOT NULL,")
    print(f"    user_id INTEGER,")
    print(f"    username VARCHAR(255),")
    print(f"    metadata JSONB,")
    print(f"    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,")
    print(f"    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
    print(f");")
    print(f"")
    print(f"-- Create admin user (password: admin123)")
    print(f"INSERT INTO users (username, password_hash, role)")
    print(f"VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin')")
    print(f"ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;")
    print(f"```")
    
    print(f"\n💡 OR try forcing another deployment with explicit table creation...")

if __name__ == "__main__":
    main()
    
    print(f"\n💡 LIKELY CAUSES OF 401 ERROR:")
    print(f"   1. Database tables don't exist (users table missing)")
    print(f"   2. Admin user wasn't created properly")
    print(f"   3. Password hash doesn't match")
    print(f"   4. Application still in production mode (skipping schema creation)")
    
    print(f"\n🔧 NEXT STEPS:")
    print(f"   1. Verify the application is actually running in development mode")
    print(f"   2. Check if database tables were created")
    print(f"   3. Manually create admin user if needed")
    
    # Suggest manual database fix
    suggest_manual_fix() 