#!/usr/bin/env python3
"""Copy deadlines from production database to local Neon database"""

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
        print('🔄 Copying deadlines from production to local database...')
        
        # Connect to production database
        print('🔍 Connecting to production database...')
        prod_conn = psycopg2.connect(**PROD_DB_CONFIG)
        prod_cursor = prod_conn.cursor()
        
        # Get all deadlines from production
        print('📅 Fetching deadlines from production...')
        prod_cursor.execute('SELECT id, regulation_id, due_date, status, assigned_to FROM deadlines ORDER BY id')
        deadlines = prod_cursor.fetchall()
        
        print(f'✅ Found {len(deadlines)} deadlines in production')
        
        prod_cursor.close()
        prod_conn.close()
        
        # Connect to local database
        print('🔍 Connecting to local Neon database...')
        local_conn = psycopg2.connect(**LOCAL_DB_CONFIG)
        local_cursor = local_conn.cursor()
        
        # Clear existing deadlines (if any)
        print('🧹 Clearing existing deadlines in local database...')
        local_cursor.execute('DELETE FROM deadlines')
        cleared_count = local_cursor.rowcount
        print(f'   Cleared {cleared_count} existing deadlines')
        
        # Insert deadlines into local database
        print('💾 Inserting deadlines into local database...')
        
        insert_query = """
            INSERT INTO deadlines (id, regulation_id, due_date, status, assigned_to)
            VALUES (%s, %s, %s, %s, %s)
        """
        
        inserted_count = 0
        failed_count = 0
        
        for deadline in deadlines:
            try:
                local_cursor.execute(insert_query, deadline)
                inserted_count += 1
                
                if inserted_count % 100 == 0:
                    print(f'   Inserted {inserted_count}/{len(deadlines)} deadlines...')
                    
            except Exception as e:
                failed_count += 1
                print(f'   ❌ Failed to insert deadline {deadline[0]}: {e}')
        
        # Commit the transaction
        local_conn.commit()
        
        print(f'\n📊 Copy Results:')
        print(f'   ✅ Successfully inserted: {inserted_count} deadlines')
        print(f'   ❌ Failed insertions: {failed_count} deadlines')
        
        # Verify the copy
        print('\n🔍 Verifying local database...')
        local_cursor.execute('SELECT COUNT(*) FROM deadlines')
        local_deadline_count = local_cursor.fetchone()[0]
        print(f'📅 Total deadlines in local DB: {local_deadline_count}')
        
        # Show some sample deadlines
        local_cursor.execute('SELECT regulation_id, due_date, status FROM deadlines ORDER BY id LIMIT 5')
        sample_deadlines = local_cursor.fetchall()
        print(f'\n📋 Sample deadlines in local database:')
        for deadline in sample_deadlines:
            print(f'   Regulation {deadline[0]}: {deadline[1]} ({deadline[2]})')
        
        # Reset the sequence to avoid conflicts
        print('\n🔧 Resetting deadline ID sequence...')
        local_cursor.execute('SELECT MAX(id) FROM deadlines')
        max_id = local_cursor.fetchone()[0]
        if max_id:
            local_cursor.execute(f'ALTER SEQUENCE deadlines_id_seq RESTART WITH {max_id + 1}')
            print(f'   ✅ Reset sequence to start at {max_id + 1}')
        
        local_cursor.close()
        local_conn.close()
        
        print(f'\n🎉 Successfully copied {inserted_count} deadlines to local database!')
        print(f'💡 Local deadlines endpoint should now work with authentication')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 