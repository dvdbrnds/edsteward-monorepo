#!/usr/bin/env python3
"""Check local database configuration and users"""

import psycopg2

# Production database (where we added deadlines)
DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'database': 'edsteward',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

def main():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print('🔍 Connected to production database')
        
        # Check if deadlines were populated
        cursor.execute('SELECT COUNT(*) FROM deadlines')
        deadline_count = cursor.fetchone()[0]
        print(f'📊 Total deadlines in database: {deadline_count}')
        
        # Check users
        cursor.execute('SELECT id, username, email, role FROM users ORDER BY id LIMIT 10')
        users = cursor.fetchall()
        print(f'👥 Found {len(users)} users:')
        for user in users:
            print(f'   ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Role: {user[3]}')
        
        # Sample some deadlines
        cursor.execute('SELECT regulation_id, due_date, status FROM deadlines ORDER BY id LIMIT 5')
        deadlines = cursor.fetchall()
        print(f'\n📅 Sample deadlines:')
        for deadline in deadlines:
            print(f'   Regulation {deadline[0]}: {deadline[1]} ({deadline[2]})')
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f'❌ Error: {e}')

if __name__ == "__main__":
    main() 