#!/usr/bin/env python3

import psycopg2
import sys

# AWS RDS connection details
aws_config = {
    'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure'
}

print('Testing AWS RDS connection...')
try:
    conn = psycopg2.connect(**aws_config)
    cursor = conn.cursor()
    
    # Test basic query
    cursor.execute('SELECT version();')
    version = cursor.fetchone()[0]
    print(f'✅ Connection successful!')
    print(f'PostgreSQL version: {version}')
    
    # Check existing databases
    cursor.execute('SELECT datname FROM pg_database WHERE datistemplate = false;')
    databases = cursor.fetchall()
    print(f'Existing databases: {[db[0] for db in databases]}')
    
    # Check if we can create tables (basic write test)
    cursor.execute('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, test_time TIMESTAMP DEFAULT NOW());')
    cursor.execute('INSERT INTO connection_test DEFAULT VALUES;')
    cursor.execute('SELECT COUNT(*) FROM connection_test;')
    count = cursor.fetchone()[0]
    print(f'✅ Write test successful! Test table has {count} rows')
    
    # Clean up test table
    cursor.execute('DROP TABLE connection_test;')
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print('🎉 AWS RDS is ready for database restoration!')
    
except Exception as e:
    print(f'❌ Connection failed: {e}')
    print('\nIf you see a timeout or connection refused error, you may need to:')
    print('1. Update the security group to allow inbound traffic on port 5432')
    print('2. Make sure the RDS instance is in a public subnet')
    print('3. Check that the VPC has an internet gateway')
    sys.exit(1) 