#!/usr/bin/env python3
"""Check local Neon database and populate deadlines if needed"""

import psycopg2

# Local Neon database (from docker-compose.dev.yml)
LOCAL_DB_CONFIG = {
    'host': 'ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech',
    'database': 'neondb',
    'user': 'neondb_owner',
    'password': 'npg_foSr6ixkzw7W',
    'port': 5432
}

# Production database (where we have the populated deadlines)
PROD_DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'database': 'edsteward',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

def main():
    try:
        print('🔍 Checking local Neon database...')
        
        # Connect to local Neon database
        local_conn = psycopg2.connect(**LOCAL_DB_CONFIG)
        local_cursor = local_conn.cursor()
        
        print('✅ Connected to local Neon database')
        
        # Check if deadlines table exists
        local_cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'deadlines'
            );
        """)
        deadlines_table_exists = local_cursor.fetchone()[0]
        
        print(f'📊 Deadlines table exists: {deadlines_table_exists}')
        
        if deadlines_table_exists:
            # Check current deadlines count
            local_cursor.execute('SELECT COUNT(*) FROM deadlines')
            local_deadline_count = local_cursor.fetchone()[0]
            print(f'📅 Current deadlines in local DB: {local_deadline_count}')
        else:
            print('❌ Deadlines table does not exist in local database')
            local_deadline_count = 0
        
        # Check regulations count
        local_cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'regulations'
            );
        """)
        regulations_table_exists = local_cursor.fetchone()[0]
        
        if regulations_table_exists:
            local_cursor.execute('SELECT COUNT(*) FROM regulations')
            local_reg_count = local_cursor.fetchone()[0]
            print(f'📋 Regulations in local DB: {local_reg_count}')
        else:
            print('❌ Regulations table does not exist in local database')
            local_reg_count = 0
        
        # Check users count
        local_cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        """)
        users_table_exists = local_cursor.fetchone()[0]
        
        if users_table_exists:
            local_cursor.execute('SELECT COUNT(*) FROM users')
            local_user_count = local_cursor.fetchone()[0]
            print(f'👥 Users in local DB: {local_user_count}')
            
            # Show some users
            local_cursor.execute('SELECT id, username, email, role FROM users ORDER BY id LIMIT 5')
            users = local_cursor.fetchall()
            print('👥 Sample users:')
            for user in users:
                print(f'   ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Role: {user[3]}')
        else:
            print('❌ Users table does not exist in local database')
            local_user_count = 0
        
        local_cursor.close()
        local_conn.close()
        
        # Now check production database for comparison
        print('\n🔍 Checking production database for comparison...')
        
        prod_conn = psycopg2.connect(**PROD_DB_CONFIG)
        prod_cursor = prod_conn.cursor()
        
        print('✅ Connected to production database')
        
        # Check production deadlines
        prod_cursor.execute('SELECT COUNT(*) FROM deadlines')
        prod_deadline_count = prod_cursor.fetchone()[0]
        print(f'📅 Deadlines in production DB: {prod_deadline_count}')
        
        # Check production regulations
        prod_cursor.execute('SELECT COUNT(*) FROM regulations')
        prod_reg_count = prod_cursor.fetchone()[0]
        print(f'📋 Regulations in production DB: {prod_reg_count}')
        
        prod_cursor.close()
        prod_conn.close()
        
        print(f'\n📊 Database Comparison:')
        print(f'   Local (Neon):      {local_deadline_count} deadlines, {local_reg_count} regulations, {local_user_count} users')
        print(f'   Production (RDS):  {prod_deadline_count} deadlines, {prod_reg_count} regulations')
        
        # Recommendation
        if local_deadline_count == 0 and prod_deadline_count > 0:
            print(f'\n💡 Recommendation: Copy deadlines from production to local database')
            print(f'   This will populate the local environment with the {prod_deadline_count} deadlines we extracted')
        elif local_reg_count == 0:
            print(f'\n💡 Recommendation: Local database needs to be initialized with regulations and deadlines')
        else:
            print(f'\n✅ Local database appears to have data')
        
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == "__main__":
    main() 