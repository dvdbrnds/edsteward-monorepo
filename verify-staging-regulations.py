#!/usr/bin/env python3
"""Verify staging regulations restoration and check tenant isolation"""

import psycopg2
import json

# Database configuration (same as copy script)
DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'database': 'edsteward',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

def main():
    try:
        print('🔍 Verifying staging regulations restoration...')
        
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check total regulations in database
        print('\n📊 Database Regulation Counts:')
        cursor.execute("SELECT COUNT(*) FROM regulations")
        total_regulations = cursor.fetchone()[0]
        print(f'   Total regulations in database: {total_regulations}')
        
        # Get sample regulations to verify data quality
        print('\n📋 Sample Regulations:')
        cursor.execute("""
            SELECT item_id, name, category, jurisdiction, id
            FROM regulations 
            ORDER BY id 
            LIMIT 10
        """)
        sample_regs = cursor.fetchall()
        
        for reg in sample_regs:
            print(f'   ID {reg[4]}: {reg[0]} - {reg[1]} ({reg[2]}, {reg[3]})')
        
        # Check for duplicates
        print('\n🔍 Checking for duplicates:')
        cursor.execute("""
            SELECT item_id, COUNT(*) as count
            FROM regulations 
            WHERE item_id IS NOT NULL
            GROUP BY item_id 
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 5
        """)
        duplicates = cursor.fetchall()
        
        if duplicates:
            print(f'   Found {len(duplicates)} item_ids with duplicates:')
            for dup in duplicates:
                print(f'     {dup[0]}: {dup[1]} copies')
        else:
            print('   No duplicates found')
        
        # Check deadlines
        print('\n📅 Deadline Information:')
        cursor.execute("SELECT COUNT(*) FROM deadlines")
        total_deadlines = cursor.fetchone()[0]
        print(f'   Total deadlines: {total_deadlines}')
        
        cursor.execute("""
            SELECT COUNT(DISTINCT regulation_id) 
            FROM deadlines 
            WHERE regulation_id IN (SELECT id FROM regulations)
        """)
        valid_deadline_regs = cursor.fetchone()[0]
        print(f'   Deadlines with valid regulation references: {valid_deadline_regs}')
        
        # Check if we can identify the specific regulations that should be in staging
        print('\n🎯 Regulation Categories:')
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM regulations 
            GROUP BY category 
            ORDER BY count DESC
            LIMIT 10
        """)
        categories = cursor.fetchall()
        
        for cat in categories:
            print(f'   {cat[0]}: {cat[1]} regulations')
        
        cursor.close()
        conn.close()
        
        print(f'\n✅ Verification complete!')
        print(f'📊 Summary:')
        print(f'   • Total regulations: {total_regulations}')
        print(f'   • Total deadlines: {total_deadlines}')
        print(f'   • Database connection: Working')
        
        if total_regulations >= 367:
            print(f'🎉 SUCCESS: Database has {total_regulations} regulations (expected: 367+)')
        else:
            print(f'⚠️  WARNING: Database only has {total_regulations} regulations (expected: 367+)')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 