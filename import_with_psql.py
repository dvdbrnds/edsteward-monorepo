#!/usr/bin/env python3
"""
Import Full Regulations using psql
=================================
Import the complete SQL dump to Neon using psql
"""

import subprocess
import psycopg2

def main():
    print('📥 IMPORTING FULL REGULATIONS TO NEON')
    print('=' * 42)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        # Test connection
        print('🔗 Testing Neon connection...')
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        cursor.execute('SELECT version();')
        version = cursor.fetchone()[0]
        print(f'✅ Connected to: {version[:50]}...')
        
        # Clean existing data
        print('🧹 Cleaning existing schema...')
        cursor.execute('DROP SCHEMA IF EXISTS public CASCADE;')
        cursor.execute('CREATE SCHEMA public;')
        conn.commit()
        cursor.close()
        conn.close()
        print('✅ Schema reset complete')
        
        # Import using psql
        print('📥 Importing SQL dump using psql...')
        
        result = subprocess.run([
            'psql', 
            neon_connection,
            '-f', 'working_local_backup.sql',
            '-q'  # Quiet mode
        ], capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            print('✅ SQL import completed successfully!')
        else:
            print(f'❌ psql failed with return code {result.returncode}')
            if result.stderr:
                print('Error:', result.stderr[-500:])
            return False
        
        # Verify import
        print('🔍 Verifying import...')
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM regulations;')
        reg_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT name, category FROM regulations ORDER BY id LIMIT 3;')
        sample_regs = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        print(f'\n🎉 SUCCESS! {reg_count:,} REGULATIONS IMPORTED!')
        print('=' * 45)
        print('📋 Sample regulations:')
        for i, (name, category) in enumerate(sample_regs, 1):
            print(f'   {i}. {name[:60]}... ({category or "No category"})')
        
        if reg_count >= 300:
            print('\n🚀 READY FOR AWS DEPLOYMENT!')
            return True
        else:
            print(f'\n⚠️  Warning: Only {reg_count} regulations (expected 300+)')
            return False
            
    except FileNotFoundError:
        print('❌ psql command not found. Installing PostgreSQL client...')
        subprocess.run(['brew', 'install', 'postgresql@15'])
        print('✅ PostgreSQL installed. Please run the script again.')
        return False
    except Exception as e:
        print(f'❌ Error: {e}')
        return False

if __name__ == '__main__':
    main() 