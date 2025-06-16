#!/usr/bin/env python3
import psycopg2
import json

def check_regulations_schema():
    """Check the actual database schema and sample data for regulations"""
    try:
        # Connect to database
        conn = psycopg2.connect(
            host='edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            database='edsteward',
            user='postgres',
            password='EdSteward2024!Secure',
            port=5432
        )

        cur = conn.cursor()

        # Get the schema of regulations table
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'regulations' 
            ORDER BY ordinal_position;
        """)

        columns = cur.fetchall()
        print('🗃️ REGULATIONS TABLE SCHEMA:')
        print('=' * 50)
        for col in columns:
            print(f'  {col[0]}: {col[1]} (nullable: {col[2]})')

        print()

        # Get a sample regulation to see what data is actually there
        cur.execute('SELECT * FROM regulations LIMIT 1;')
        sample = cur.fetchone()
        if sample:
            cur.execute('SELECT column_name FROM information_schema.columns WHERE table_name = \'regulations\' ORDER BY ordinal_position;')
            col_names = [row[0] for row in cur.fetchall()]
            
            print('📄 SAMPLE REGULATION DATA:')
            print('=' * 50)
            for i, col_name in enumerate(col_names):
                value = sample[i] if i < len(sample) else None
                if isinstance(value, str) and len(value) > 100:
                    print(f'  {col_name}: {value[:100]}...')
                else:
                    print(f'  {col_name}: {value}')

        # Check if any regulations have the missing fields populated
        print()
        print('🔍 CHECKING FOR POPULATED FIELDS:')
        print('=' * 50)
        
        fields_to_check = ['requirements', 'regulation_text', 'regulation_url', 'submission_guidelines', 'compliance_notes']
        for field in fields_to_check:
            try:
                cur.execute(f'SELECT COUNT(*) FROM regulations WHERE {field} IS NOT NULL AND {field} != \'\';')
                count = cur.fetchone()[0]
                print(f'  {field}: {count} records have data')
            except Exception as e:
                print(f'  {field}: Column does not exist ({e})')

        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_regulations_schema() 