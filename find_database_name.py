#!/usr/bin/env python3
import psycopg2

def find_database_name():
    """Find the correct database name on the RDS instance"""
    try:
        # Connect to the default postgres database to list all databases
        conn = psycopg2.connect(
            host='edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            database='postgres',  # Connect to default postgres database
            user='postgres',
            password='EdSteward2024!Secure',
            port=5432
        )

        cur = conn.cursor()

        # List all databases
        cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
        databases = cur.fetchall()
        
        print('🗄️ AVAILABLE DATABASES:')
        print('=' * 30)
        for db in databases:
            print(f'  {db[0]}')

        conn.close()
        
        # Try common database names
        common_names = ['edsteward', 'edsteward_db', 'postgres', 'edsteward_production']
        
        print()
        print('🔍 TESTING DATABASE CONNECTIONS:')
        print('=' * 40)
        
        for db_name in common_names:
            try:
                test_conn = psycopg2.connect(
                    host='edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
                    database=db_name,
                    user='postgres',
                    password='EdSteward2024!Secure',
                    port=5432
                )
                
                test_cur = test_conn.cursor()
                test_cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'regulations';")
                has_regulations = test_cur.fetchone()[0] > 0
                
                if has_regulations:
                    test_cur.execute("SELECT COUNT(*) FROM regulations;")
                    reg_count = test_cur.fetchone()[0]
                    print(f'  ✅ {db_name}: Has regulations table with {reg_count} records')
                else:
                    print(f'  ⚠️  {db_name}: Connected but no regulations table')
                
                test_conn.close()
                
            except Exception as e:
                print(f'  ❌ {db_name}: {e}')
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    find_database_name() 