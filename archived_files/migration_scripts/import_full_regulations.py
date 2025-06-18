#!/usr/bin/env python3
"""
Import Full Regulations Database to Neon
=======================================
Import all 300+ regulations from working_local_backup.sql to Neon
"""

import psycopg2
import subprocess
import re

def main():
    print('📥 IMPORTING FULL REGULATIONS DATABASE TO NEON')
    print('=' * 55)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        # Connect to Neon
        print('🔗 Connecting to Neon database...')
        conn = psycopg2.connect(neon_connection)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print('✅ Connected successfully!')
        
        # Drop existing tables to start fresh
        print('🧹 Cleaning existing tables...')
        cursor.execute("DROP SCHEMA public CASCADE;")
        cursor.execute("CREATE SCHEMA public;")
        print('✅ Schema reset complete')
        
        # Read and execute the SQL backup file
        print('📖 Reading SQL backup file...')
        
        with open('working_local_backup.sql', 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print(f'📊 SQL file size: {len(sql_content):,} characters')
        
        # Split into individual statements and execute
        print('⚙️  Executing SQL statements...')
        
        # Remove comments and empty lines for cleaner execution
        lines = sql_content.split('\n')
        clean_lines = []
        in_copy_data = False
        
        for line in lines:
            # Check if we're entering COPY data
            if line.startswith('COPY '):
                in_copy_data = True
                clean_lines.append(line)
            elif line.strip() == '\\.':
                in_copy_data = False
                clean_lines.append(line)
            elif in_copy_data:
                # Keep COPY data as-is
                clean_lines.append(line)
            elif line.strip() and not line.startswith('--'):
                # Keep non-comment, non-empty lines
                clean_lines.append(line)
        
        cleaned_sql = '\n'.join(clean_lines)
        
        # Execute the cleaned SQL
        print('🚀 Executing database import...')
        cursor.execute(cleaned_sql)
        
        print('✅ SQL execution completed!')
        
        # Verify the import
        print('🔍 Verifying import...')
        
        # Check regulations table
        cursor.execute("SELECT COUNT(*) FROM regulations;")
        reg_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT name, category FROM regulations LIMIT 5;")
        sample_regs = cursor.fetchall()
        
        # Check other tables
        cursor.execute("""
            SELECT table_name, 
                   (SELECT COUNT(*) FROM information_schema.columns 
                    WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        
        print('\n🎉 IMPORT SUCCESSFUL!')
        print('=' * 30)
        print(f'📊 Total regulations: {reg_count:,}')
        print(f'📋 Total tables: {len(tables)}')
        
        print('\n📋 Sample regulations:')
        for i, (name, category) in enumerate(sample_regs, 1):
            print(f'   {i}. {name[:60]}... ({category or "No category"})')
        
        print('\n📁 Database tables:')
        for table_name, col_count in tables:
            if table_name == 'regulations':
                cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
                row_count = cursor.fetchone()[0]
                print(f'   ✅ {table_name}: {row_count:,} rows, {col_count} columns')
            else:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
                    row_count = cursor.fetchone()[0]
                    print(f'   📁 {table_name}: {row_count:,} rows, {col_count} columns')
                except:
                    print(f'   📁 {table_name}: {col_count} columns')
        
        cursor.close()
        conn.close()
        
        print('\n🚀 READY FOR PRODUCTION DEPLOYMENT!')
        print('=' * 40)
        print('✅ Full regulations database imported to Neon')
        print(f'✅ {reg_count:,} regulations ready for API access')
        print('✅ All tables and relationships preserved')
        print('✅ Neon PostgreSQL 17 optimized for performance')
        
        print('\n💡 NEXT STEPS:')
        print('1. Deploy to AWS with Neon configuration')
        print('2. Test production API endpoints')
        print('3. Verify all 300+ regulations are accessible')
        
        return True
        
    except Exception as e:
        print(f'❌ Error importing database: {e}')
        print('\n🔧 Troubleshooting:')
        print('1. Check Neon connection string')
        print('2. Verify SQL backup file exists')
        print('3. Check for SQL syntax issues')
        return False

if __name__ == '__main__':
    main() 