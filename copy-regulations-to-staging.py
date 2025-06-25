#!/usr/bin/env python3
"""Copy full regulations dataset from Moravian production database to staging database"""

import psycopg2
import json

# Staging database (staging.edsteward.ai)
STAGING_DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'database': 'edsteward',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

# Production database (moravian.edsteward.ai - same RDS instance, different tenant)
PROD_DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'database': 'edsteward',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

def main():
    try:
        print('🔄 Copying regulations from Moravian production to staging...')
        
        # Connect to production database
        print('🔍 Connecting to production database...')
        prod_conn = psycopg2.connect(**PROD_DB_CONFIG)
        prod_cursor = prod_conn.cursor()
        
        # Get all regulations from Moravian production (all regulations)
        print('📋 Fetching regulations from production database...')
        prod_cursor.execute("""
            SELECT id, item_id, name, topic, statute, statute_ids, summary, requirements,
                   category, jurisdiction, is_applicable, origination_date, effective_date,
                   last_updated, last_verified, next_review_date, filing_deadlines,
                   reporting_frequency, agency_url, agency_name, agency_contact,
                   agency_department, regulation_url, requirements_url, submission_guide_url,
                   forms_url, submission_guidelines, regulation_text, applicable_forms,
                   related_regulations, compliance_notes, verification_method,
                   notification_schedule, sources, version_number, previous_version_id,
                   version_date, change_summary, is_current, version_metadata,
                   state_code, state_agency, actions, dro, notification_override, sections
            FROM regulations 
            ORDER BY id
        """)
        regulations = prod_cursor.fetchall()
        
        print(f'✅ Found {len(regulations)} regulations in production')
        
        if len(regulations) == 0:
            print('❌ No regulations found in production database.')
            return 1
        
        # Also get deadlines for these regulations
        print('📅 Fetching deadlines for these regulations...')
        regulation_ids = [str(reg[0]) for reg in regulations]
        if regulation_ids:
            prod_cursor.execute(f"""
                SELECT id, regulation_id, due_date, status, assigned_to
                FROM deadlines 
                WHERE regulation_id IN ({','.join(regulation_ids)})
                ORDER BY id
            """)
        else:
            prod_cursor.execute("SELECT id, regulation_id, due_date, status, assigned_to FROM deadlines WHERE 1=0")
        deadlines = prod_cursor.fetchall()
        
        print(f'✅ Found {len(deadlines)} deadlines for these regulations')
        
        prod_cursor.close()
        prod_conn.close()
        
        # Connect to staging database
        print('🔍 Connecting to staging database...')
        staging_conn = psycopg2.connect(**STAGING_DB_CONFIG)
        staging_cursor = staging_conn.cursor()
        
        # Clear existing data in staging (use TRUNCATE CASCADE for efficiency)
        print('🧹 Clearing existing staging data...')
        
        # Use TRUNCATE CASCADE to handle all foreign key constraints automatically
        staging_cursor.execute("TRUNCATE TABLE regulations CASCADE")
        print('   Cleared all regulations and related data from staging')
        
        # Insert regulations into staging database
        print('💾 Inserting regulations into staging database...')
        
        regulation_insert_query = """
            INSERT INTO regulations (
                id, item_id, name, topic, statute, statute_ids, summary, requirements,
                category, jurisdiction, is_applicable, origination_date, effective_date,
                last_updated, last_verified, next_review_date, filing_deadlines,
                reporting_frequency, agency_url, agency_name, agency_contact,
                agency_department, regulation_url, requirements_url, submission_guide_url,
                forms_url, submission_guidelines, regulation_text, applicable_forms,
                related_regulations, compliance_notes, verification_method,
                notification_schedule, sources, version_number, previous_version_id,
                version_date, change_summary, is_current, version_metadata,
                state_code, state_agency, actions, dro, notification_override, sections
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        inserted_regulations = 0
        failed_regulations = 0
        
        for reg in regulations:
            try:
                staging_cursor.execute(regulation_insert_query, reg)
                inserted_regulations += 1
                
                if inserted_regulations % 50 == 0:
                    print(f'   Inserted {inserted_regulations}/{len(regulations)} regulations...')
                    
            except Exception as e:
                failed_regulations += 1
                print(f'   ❌ Failed to insert regulation {reg[0]}: {e}')
        
        # Insert deadlines into staging database
        print('📅 Inserting deadlines into staging database...')
        
        deadline_insert_query = """
            INSERT INTO deadlines (
                id, regulation_id, due_date, status, assigned_to
            ) VALUES (%s, %s, %s, %s, %s)
        """
        
        inserted_deadlines = 0
        failed_deadlines = 0
        
        for deadline in deadlines:
            try:
                staging_cursor.execute(deadline_insert_query, deadline)
                inserted_deadlines += 1
                
                if inserted_deadlines % 50 == 0:
                    print(f'   Inserted {inserted_deadlines}/{len(deadlines)} deadlines...')
                    
            except Exception as e:
                failed_deadlines += 1
                print(f'   ❌ Failed to insert deadline {deadline[0]}: {e}')
        
        # Commit the transaction
        staging_conn.commit()
        
        print(f'\n📊 Copy Results:')
        print(f'   ✅ Successfully inserted: {inserted_regulations} regulations')
        print(f'   ✅ Successfully inserted: {inserted_deadlines} deadlines')
        print(f'   ❌ Failed regulation insertions: {failed_regulations}')
        print(f'   ❌ Failed deadline insertions: {failed_deadlines}')
        
        # Verify the copy
        print('\n🔍 Verifying staging database...')
        staging_cursor.execute("SELECT COUNT(*) FROM regulations")
        staging_regulation_count = staging_cursor.fetchone()[0]
        staging_cursor.execute("SELECT COUNT(*) FROM deadlines")
        staging_deadline_count = staging_cursor.fetchone()[0]
        
        print(f'📋 Total regulations in staging: {staging_regulation_count}')
        print(f'📅 Total deadlines in staging: {staging_deadline_count}')
        
        # Show some sample regulations
        staging_cursor.execute("""
            SELECT item_id, name, category, jurisdiction 
            FROM regulations 
            ORDER BY id 
            LIMIT 5
        """)
        sample_regulations = staging_cursor.fetchall()
        print(f'\n📋 Sample regulations in staging:')
        for reg in sample_regulations:
            print(f'   {reg[0]}: {reg[1]} ({reg[2]}, {reg[3]})')
        
        staging_cursor.close()
        staging_conn.close()
        
        print(f'\n🎉 Successfully copied {inserted_regulations} regulations and {inserted_deadlines} deadlines to staging!')
        print(f'🌐 Staging should now have the full dataset at https://staging.edsteward.ai/')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 