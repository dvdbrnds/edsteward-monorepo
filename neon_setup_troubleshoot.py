#!/usr/bin/env python3
"""
Neon Database Setup with Authentication Troubleshooting
======================================================
Comprehensive guide for setting up Neon PostgreSQL with login troubleshooting
"""

import requests
import psycopg2
import json
import os
import time

def main():
    print('🔥 NEON DATABASE SETUP - AUTHENTICATION TROUBLESHOOTING')
    print('=' * 60)
    
    print('\n📋 STEP 1: CREATE NEON ACCOUNT')
    print('-' * 40)
    print('1. Go to: https://console.neon.tech/')
    print('2. Click "Sign Up" (NOT "Sign In")')
    print('3. Choose sign-up method:')
    print('   ✅ GitHub (RECOMMENDED - fastest)')
    print('   ✅ Google')
    print('   ✅ Email + Password')
    print()
    
    # Wait for account creation
    input('📝 Press ENTER after you\'ve created your Neon account...')
    
    print('\n📋 STEP 2: CREATE NEW PROJECT')
    print('-' * 40)
    print('1. Click "Create Project" or "New Project"')
    print('2. Project settings:')
    print('   📦 Name: "EdSteward"')
    print('   🐘 PostgreSQL Version: 17 (latest)')
    print('   🌍 Region: US East (Virginia) - closest to AWS')
    print('   💰 Plan: Free tier is fine for testing')
    print('3. Click "Create Project"')
    print()
    
    input('📝 Press ENTER after your project is created...')
    
    print('\n📋 STEP 3: GET CONNECTION STRING')
    print('-' * 40)
    print('🔍 MULTIPLE WAYS TO FIND YOUR CONNECTION STRING:')
    print()
    print('METHOD 1 - Dashboard:')
    print('  1. On your project dashboard')
    print('  2. Look for "Connection Details" section')
    print('  3. Copy the "Connection string"')
    print()
    print('METHOD 2 - Connect Button:')
    print('  1. Click the "Connect" button')
    print('  2. Select "Pooled connection" (recommended)')
    print('  3. Copy the connection string')
    print()
    print('METHOD 3 - Settings:')
    print('  1. Go to project Settings')
    print('  2. Go to "Connection" tab')
    print('  3. Copy connection string')
    print()
    print('⚠️  IMPORTANT NOTES:')
    print('   - Use the POOLED connection (has "-pooler" in hostname)')
    print('   - Connection string format: postgresql://user:password@host/database')
    print('   - Password is only shown ONCE when project is created')
    print()
    
    # Get connection string with validation
    while True:
        conn_string = input('📝 Paste your Neon connection string here: ').strip()
        
        if not conn_string:
            print('❌ Empty connection string. Please try again.')
            continue
            
        if not conn_string.startswith('postgresql://'):
            print('❌ Invalid format. Should start with "postgresql://"')
            print('   Example: postgresql://user:pass@host.neon.tech/database')
            continue
            
        if 'neon.tech' not in conn_string:
            print('❌ This doesn\'t look like a Neon connection string.')
            print('   Should contain "neon.tech" in the hostname.')
            continue
            
        break
    
    print('\n🧪 STEP 4: TEST CONNECTION')
    print('-' * 40)
    
    # Test the connection
    try:
        print('⏳ Testing connection to Neon...')
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Test basic query
        cursor.execute('SELECT version();')
        version = cursor.fetchone()[0]
        print(f'✅ Connected successfully!')
        print(f'📊 PostgreSQL Version: {version.split()[0]} {version.split()[1]}')
        
        # Get database info
        cursor.execute('SELECT current_database(), current_user, inet_server_addr(), inet_server_port();')
        db_info = cursor.fetchone()
        print(f'🗄️  Database: {db_info[0]}')
        print(f'👤 User: {db_info[1]}')
        print(f'🌐 Host: {db_info[2]}:{db_info[3]}')
        
        cursor.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f'❌ Connection failed: {e}')
        print('\n🔧 TROUBLESHOOTING GUIDE:')
        print('-' * 30)
        
        error_msg = str(e).lower()
        
        if 'password authentication failed' in error_msg:
            print('🔑 PASSWORD ISSUE:')
            print('   - Password might be incorrect')
            print('   - Go to Neon Console → Settings → Reset Password')
            print('   - Get a new connection string with the new password')
            
        elif 'could not translate host name' in error_msg:
            print('🌐 HOSTNAME ISSUE:')
            print('   - Check if hostname is correct')
            print('   - Should end with ".neon.tech"')
            print('   - Try the pooled connection string')
            
        elif 'connection refused' in error_msg:
            print('🚫 CONNECTION REFUSED:')
            print('   - Database might be sleeping (free tier)')
            print('   - Try again in a few seconds')
            print('   - Check if you\'re using the correct port (5432)')
            
        elif 'database' in error_msg and 'does not exist' in error_msg:
            print('🗄️  DATABASE ISSUE:')
            print('   - Database name might be wrong')
            print('   - Check the connection string format')
            print('   - Default database is usually "neondb"')
            
        else:
            print(f'❓ UNKNOWN ERROR: {e}')
            print('   - Double-check the entire connection string')
            print('   - Make sure you copied it completely')
            print('   - Try creating a new connection string')
        
        print('\n🔄 QUICK FIXES TO TRY:')
        print('1. Go to Neon Console')
        print('2. Click "Connect" → get fresh connection string')
        print('3. Make sure to use "Pooled connection"')
        print('4. Try again with the new string')
        
        return False
    
    except Exception as e:
        print(f'❌ Unexpected error: {e}')
        return False
    
    print('\n📋 STEP 5: CREATE REGULATIONS TABLE')
    print('-' * 40)
    
    try:
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Create regulations table
        create_table_sql = '''
        CREATE TABLE IF NOT EXISTS regulations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(100),
            effective_date DATE,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        '''
        
        cursor.execute(create_table_sql)
        
        # Insert sample data
        sample_data = [
            ('GDPR Compliance', 'General Data Protection Regulation compliance requirements', 'Privacy', '2018-05-25', 'active'),
            ('SOX Section 404', 'Sarbanes-Oxley Act Section 404 internal controls', 'Financial', '2004-11-15', 'active'),
            ('HIPAA Security Rule', 'Health Insurance Portability and Accountability Act security standards', 'Healthcare', '2003-04-21', 'active'),
            ('ISO 27001', 'Information security management system requirements', 'Security', '2013-10-01', 'active'),
            ('PCI DSS', 'Payment Card Industry Data Security Standard', 'Payment', '2004-12-15', 'active')
        ]
        
        cursor.executemany(
            'INSERT INTO regulations (name, description, category, effective_date, status) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING',
            sample_data
        )
        
        conn.commit()
        
        # Verify data
        cursor.execute('SELECT COUNT(*) FROM regulations;')
        count = cursor.fetchone()[0]
        print(f'✅ Table created successfully!')
        print(f'📊 Sample regulations inserted: {count}')
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f'❌ Error creating table: {e}')
        return False
    
    print('\n🎉 SUCCESS! NEON DATABASE IS READY')
    print('=' * 60)
    print(f'🔗 Connection String: {conn_string}')
    print('📋 Next Steps:')
    print('1. Update your application\'s database configuration')
    print('2. Replace RDS connection with this Neon connection')
    print('3. Run your application tests')
    print()
    print('💡 IMPORTANT FOR YOUR APP:')
    print('- Update environment variables with new connection string')
    print('- Neon uses connection pooling automatically')
    print('- Free tier has some limitations but great for development')
    
    return True

if __name__ == '__main__':
    main() 