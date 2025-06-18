#!/usr/bin/env python3

import psycopg2
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

try:
    log("Testing AWS RDS connection...")
    
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
    
    # Check existing tables
    cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    table_count = cursor.fetchone()[0]
    log(f"Current tables in public schema: {table_count}")
    
    cursor.close()
    conn.close()
    
    log("🎉 AWS RDS is ready for database restoration!")
    
except Exception as e:
    log(f"❌ Connection failed: {e}")
    print("\nIf connection failed, please check:")
    print("1. RDS instance is publicly accessible")
    print("2. Security group allows inbound traffic on port 5432")
    print("3. RDS instance is in a public subnet")