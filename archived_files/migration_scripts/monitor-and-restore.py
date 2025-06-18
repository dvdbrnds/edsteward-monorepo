#!/usr/bin/env python3

import boto3
import time
import subprocess
import psycopg2
import os

def wait_for_rds_ready():
    """Wait for RDS to be available"""
    print("⏳ Waiting for RDS to become available...")
    
    rds = boto3.client('rds', region_name='us-east-1')
    
    while True:
        try:
            response = rds.describe_db_instances(DBInstanceIdentifier='edsteward-public-db')
            db = response['DBInstances'][0]
            status = db['DBInstanceStatus']
            
            print(f"🔍 Current status: {status}")
            
            if status == 'available':
                endpoint = db['Endpoint']['Address']
                port = db['Endpoint']['Port']
                print(f"✅ RDS is ready!")
                print(f"🌐 Endpoint: {endpoint}")
                print(f"🔌 Port: {port}")
                
                return {
                    'endpoint': endpoint,
                    'port': port,
                    'database': 'edsteward',
                    'username': 'postgres',
                    'password': 'EdSteward2024!Secure'
                }
            elif status in ['failed', 'stopped']:
                print(f"❌ RDS creation failed with status: {status}")
                return None
            else:
                print("⏳ Still creating... waiting 30 seconds")
                time.sleep(30)
                
        except Exception as e:
            print(f"❌ Error checking RDS status: {e}")
            time.sleep(30)

def restore_data(db_config):
    """Restore data to the new database"""
    print("\n📊 Restoring Data to New Database")
    print("=" * 40)
    
    try:
        # Test connection first
        print("🔄 Testing database connection...")
        conn = psycopg2.connect(
            host=db_config['endpoint'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['username'],
            password=db_config['password'],
            connect_timeout=30
        )
        print("✅ Connection successful!")
        conn.close()
        
        # Set password environment variable
        os.environ['PGPASSWORD'] = db_config['password']
        
        # Restore data using psql
        print("📥 Restoring data from backup file...")
        cmd = [
            'psql',
            '-h', db_config['endpoint'],
            '-p', str(db_config['port']),
            '-U', db_config['username'],
            '-d', db_config['database'],
            '-f', 'nosync_backup.sql',
            '-q'  # Quiet mode
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Data restoration completed!")
            
            # Verify restoration
            print("🔍 Verifying restoration...")
            conn = psycopg2.connect(
                host=db_config['endpoint'],
                port=db_config['port'],
                database=db_config['database'],
                user=db_config['username'],
                password=db_config['password']
            )
            
            cursor = conn.cursor()
            
            # Count users
            cursor.execute("SELECT COUNT(*) FROM users;")
            user_count = cursor.fetchone()[0]
            print(f"📊 Users restored: {user_count}")
            
            # Count regulations
            cursor.execute("SELECT COUNT(*) FROM regulations;")
            reg_count = cursor.fetchone()[0]
            print(f"📊 Regulations restored: {reg_count}")
            
            # Show sample regulation
            if reg_count > 0:
                cursor.execute("SELECT name, category FROM regulations LIMIT 1;")
                sample = cursor.fetchone()
                print(f"📋 Sample regulation: {sample[0]} ({sample[1]})")
            
            cursor.close()
            conn.close()
            
            return True
            
        else:
            print(f"❌ Restoration failed:")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error during restoration: {e}")
        return False

def show_connection_info(db_config):
    """Show connection information"""
    print("\n🎉 SUCCESS! New Public RDS Database Ready")
    print("=" * 50)
    print(f"🌐 Endpoint: {db_config['endpoint']}")
    print(f"🔌 Port: {db_config['port']}")
    print(f"📊 Database: {db_config['database']}")
    print(f"👤 Username: {db_config['username']}")
    print(f"🔑 Password: {db_config['password']}")
    print()
    print("🧪 Test connection:")
    print(f"psql -h {db_config['endpoint']} -p {db_config['port']} -U {db_config['username']} -d {db_config['database']}")
    print()
    print("🔧 Update your application environment variables:")
    print(f"DATABASE_URL=postgresql://{db_config['username']}:{db_config['password']}@{db_config['endpoint']}:{db_config['port']}/{db_config['database']}")

if __name__ == "__main__":
    print("🎯 EdSteward RDS Monitor & Restore")
    print("=" * 40)
    
    # Wait for RDS to be ready
    db_config = wait_for_rds_ready()
    
    if db_config:
        # Restore data
        if restore_data(db_config):
            show_connection_info(db_config)
        else:
            print("❌ Data restoration failed")
    else:
        print("❌ RDS creation failed") 