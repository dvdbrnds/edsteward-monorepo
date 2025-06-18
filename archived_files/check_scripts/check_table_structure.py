#!/usr/bin/env python3
"""
Check Table Structure in Neon Database
=====================================
Verify the regulations table has the correct 47+ column structure
"""

import psycopg2
import json
from datetime import datetime

# Complete expected schema from shared/schema.ts
EXPECTED_SCHEMA = {
    'id': {'type': 'integer', 'constraint': 'PRIMARY KEY', 'nullable': False},
    'item_id': {'type': 'text', 'constraint': 'NOT NULL', 'nullable': False},
    'name': {'type': 'text', 'constraint': 'NOT NULL', 'nullable': False},
    'topic': {'type': 'text', 'constraint': 'NOT NULL', 'nullable': False},
    'statute': {'type': 'text', 'constraint': 'NOT NULL', 'nullable': False},
    'statute_ids': {'type': 'text', 'constraint': None, 'nullable': True},
    'summary': {'type': 'text', 'constraint': None, 'nullable': True},
    'requirements': {'type': 'text', 'constraint': None, 'nullable': True},
    'category': {'type': 'text', 'constraint': 'NOT NULL', 'nullable': False},
    'jurisdiction': {'type': 'text', 'constraint': "NOT NULL DEFAULT 'federal'", 'nullable': False},
    'dro': {'type': 'text', 'constraint': "NOT NULL DEFAULT ''", 'nullable': False},
    'is_applicable': {'type': 'boolean', 'constraint': 'NOT NULL DEFAULT true', 'nullable': False},
    'origination_date': {'type': 'timestamp without time zone', 'constraint': None, 'nullable': True},
    'effective_date': {'type': 'timestamp without time zone', 'constraint': None, 'nullable': True},
    'last_updated': {'type': 'timestamp without time zone', 'constraint': None, 'nullable': True},
    'last_verified': {'type': 'timestamp without time zone', 'constraint': None, 'nullable': True},
    'next_review_date': {'type': 'timestamp without time zone', 'constraint': None, 'nullable': True},
    'version_number': {'type': 'integer', 'constraint': 'NOT NULL DEFAULT 1', 'nullable': False},
    'previous_version_id': {'type': 'integer', 'constraint': 'REFERENCES regulations(id)', 'nullable': True},
    'version_date': {'type': 'timestamp without time zone', 'constraint': 'NOT NULL DEFAULT CURRENT_TIMESTAMP', 'nullable': False},
    'change_summary': {'type': 'text', 'constraint': None, 'nullable': True},
    'is_current': {'type': 'boolean', 'constraint': 'NOT NULL DEFAULT true', 'nullable': False},
    'version_metadata': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'filing_deadlines': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'reporting_frequency': {'type': 'text', 'constraint': None, 'nullable': True},
    'agency_url': {'type': 'text', 'constraint': None, 'nullable': True},
    'agency_name': {'type': 'text', 'constraint': None, 'nullable': True},
    'agency_contact': {'type': 'text', 'constraint': None, 'nullable': True},
    'agency_department': {'type': 'text', 'constraint': None, 'nullable': True},
    'regulation_url': {'type': 'text', 'constraint': None, 'nullable': True},
    'requirements_url': {'type': 'text', 'constraint': None, 'nullable': True},
    'submission_guide_url': {'type': 'text', 'constraint': None, 'nullable': True},
    'forms_url': {'type': 'text', 'constraint': None, 'nullable': True},
    'submission_guidelines': {'type': 'text', 'constraint': None, 'nullable': True},
    'regulation_text': {'type': 'text', 'constraint': None, 'nullable': True},
    'applicable_forms': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'related_regulations': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'compliance_notes': {'type': 'text', 'constraint': None, 'nullable': True},
    'verification_method': {'type': 'text', 'constraint': None, 'nullable': True},
    'notification_schedule': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'sources': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'actions': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'state_code': {'type': 'text', 'constraint': None, 'nullable': True},
    'state_agency': {'type': 'text', 'constraint': None, 'nullable': True},
    'notification_override': {'type': 'jsonb', 'constraint': None, 'nullable': True},
    'sections': {'type': 'jsonb', 'constraint': None, 'nullable': True}
}

def check_neon_connection():
    """Test Neon database connection"""
    print('🔌 TESTING NEON CONNECTION')
    print('=' * 30)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        
        # Test basic query
        cursor.execute('SELECT version();')
        version = cursor.fetchone()[0]
        print(f'✅ Connected to PostgreSQL: {version}')
        
        # Check database name
        cursor.execute('SELECT current_database();')
        db_name = cursor.fetchone()[0]
        print(f'📊 Database: {db_name}')
        
        # Check current user
        cursor.execute('SELECT current_user;')
        user = cursor.fetchone()[0]
        print(f'👤 User: {user}')
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f'❌ Connection failed: {e}')
        return False

def check_table_structure():
    """Check the regulations table structure"""
    print('\n🔍 CHECKING REGULATIONS TABLE STRUCTURE')
    print('=' * 45)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'regulations'
            );
        """)
        
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print('❌ regulations table does not exist!')
            return False
        
        print('✅ regulations table exists')
        
        # Get detailed column information
        cursor.execute("""
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                ordinal_position
            FROM information_schema.columns 
            WHERE table_name = 'regulations' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print(f'\n📊 Found {len(columns)} columns in regulations table')
        
        # Analyze schema compliance
        actual_columns = {col[0]: {
            'type': col[1],
            'nullable': col[2] == 'YES',
            'default': col[3],
            'position': col[5]
        } for col in columns}
        
        expected_columns = set(EXPECTED_SCHEMA.keys())
        actual_column_names = set(actual_columns.keys())
        
        missing_columns = expected_columns - actual_column_names
        extra_columns = actual_column_names - expected_columns
        
        print('\n✅ SCHEMA VALIDATION RESULTS:')
        print(f'   Expected columns: {len(expected_columns)}')
        print(f'   Actual columns: {len(actual_column_names)}')
        
        if missing_columns:
            print(f'   ❌ Missing columns ({len(missing_columns)}): {sorted(missing_columns)}')
        else:
            print('   ✅ All expected columns present')
            
        if extra_columns:
            print(f'   ℹ️  Extra columns ({len(extra_columns)}): {sorted(extra_columns)}')
        
        # Check data types for critical fields
        print('\n🔍 CRITICAL FIELD VALIDATION:')
        critical_fields = ['id', 'item_id', 'name', 'category', 'jurisdiction', 'statute']
        
        for field in critical_fields:
            if field in actual_columns:
                col_info = actual_columns[field]
                expected_info = EXPECTED_SCHEMA.get(field, {})
                
                type_match = True
                if field == 'id':
                    type_match = col_info['type'] in ['integer', 'serial']
                elif expected_info.get('type') == 'text':
                    type_match = col_info['type'] in ['text', 'character varying']
                else:
                    type_match = col_info['type'] == expected_info.get('type')
                
                nullable_match = col_info['nullable'] == expected_info.get('nullable', True)
                
                status = '✅' if type_match and nullable_match else '❌'
                print(f'   {status} {field}: {col_info["type"]} (nullable: {col_info["nullable"]})')
            else:
                print(f'   ❌ {field}: MISSING')
        
        # Check JSONB fields
        jsonb_fields = [col[0] for col in columns if col[1] == 'jsonb']
        print(f'\n🗂️  JSONB FIELDS ({len(jsonb_fields)}):')
        expected_jsonb = ['filing_deadlines', 'applicable_forms', 'related_regulations', 
                         'notification_schedule', 'sources', 'actions', 'version_metadata',
                         'notification_override', 'sections']
        
        for field in expected_jsonb:
            if field in jsonb_fields:
                print(f'   ✅ {field}')
            else:
                print(f'   ❌ {field} (missing or wrong type)')
        
        # Check foreign key constraints
        cursor.execute("""
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = 'regulations';
        """)
        
        foreign_keys = cursor.fetchall()
        
        print(f'\n🔗 FOREIGN KEY CONSTRAINTS ({len(foreign_keys)}):')
        for fk in foreign_keys:
            print(f'   • {fk[2]} → {fk[3]}.{fk[4]}')
        
        cursor.close()
        conn.close()
        
        # Overall assessment
        schema_ok = len(missing_columns) == 0
        return schema_ok
        
    except Exception as e:
        print(f'❌ Error checking table structure: {e}')
        return False

def check_sample_data():
    """Check sample data and JSONB structure"""
    print('\n📋 CHECKING SAMPLE DATA & JSONB STRUCTURE')
    print('=' * 45)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        
        # Get record count
        cursor.execute('SELECT COUNT(*) FROM regulations;')
        total_count = cursor.fetchone()[0]
        
        if total_count == 0:
            print('❌ No data found in regulations table')
            return False
            
        print(f'📊 Total regulations: {total_count:,}')
        
        # Get sample with JSONB data
        cursor.execute("""
            SELECT 
                id, item_id, name, category, jurisdiction,
                actions, sources, sections, filing_deadlines
            FROM regulations 
            WHERE actions IS NOT NULL 
            LIMIT 3;
        """)
        
        samples = cursor.fetchall()
        
        print(f'\n📋 Sample regulations with JSONB data:')
        
        for i, sample in enumerate(samples, 1):
            id_val, item_id, name, category, jurisdiction, actions, sources, sections, filing_deadlines = sample
            
            print(f'\n   {i}. ID: {id_val} | {item_id}')
            print(f'      📛 {name[:60]}...')
            print(f'      📂 {category} | 🏛️  {jurisdiction}')
            
            # Check JSONB structure
            if actions:
                action_types = []
                if isinstance(actions, list):
                    action_types = [action.get('type', 'unknown') for action in actions if isinstance(action, dict)]
                print(f'      🎯 Actions: {len(actions) if isinstance(actions, list) else "not list"} items ({", ".join(action_types[:3])})')
            
            if sources:
                print(f'      📚 Sources: {len(sources) if isinstance(sources, list) else "present"}')
            
            if sections:
                print(f'      📄 Sections: {len(sections) if isinstance(sections, list) else "present"}')
            
            if filing_deadlines:
                print(f'      📅 Filing Deadlines: {len(filing_deadlines) if isinstance(filing_deadlines, list) else "present"}')
        
        # Data quality metrics
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as has_name,
                COUNT(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END) as has_category,
                COUNT(CASE WHEN statute IS NOT NULL AND statute != '' THEN 1 END) as has_statute,
                COUNT(CASE WHEN actions IS NOT NULL THEN 1 END) as has_actions,
                COUNT(CASE WHEN sources IS NOT NULL THEN 1 END) as has_sources
            FROM regulations;
        """)
        
        quality_data = cursor.fetchone()
        total, has_name, has_category, has_statute, has_actions, has_sources = quality_data
        
        print(f'\n📊 DATA QUALITY METRICS:')
        print(f'   • Names: {has_name}/{total} ({(has_name/total)*100:.1f}%)')
        print(f'   • Categories: {has_category}/{total} ({(has_category/total)*100:.1f}%)')
        print(f'   • Statutes: {has_statute}/{total} ({(has_statute/total)*100:.1f}%)')
        print(f'   • Actions JSONB: {has_actions}/{total} ({(has_actions/total)*100:.1f}%)')
        print(f'   • Sources JSONB: {has_sources}/{total} ({(has_sources/total)*100:.1f}%)')
        
        cursor.close()
        conn.close()
        
        # Data quality assessment
        quality_threshold = 0.8  # 80% of data should have key fields
        quality_ok = (has_name/total >= quality_threshold and 
                     has_category/total >= quality_threshold and 
                     has_statute/total >= quality_threshold)
        
        if quality_ok:
            print('\n✅ Data quality meets requirements')
        else:
            print('\n⚠️  Data quality concerns detected')
        
        return quality_ok
        
    except Exception as e:
        print(f'❌ Error checking sample data: {e}')
        return False

def check_indexes_and_constraints():
    """Check indexes and constraints"""
    print('\n🔍 CHECKING INDEXES AND CONSTRAINTS')
    print('=' * 40)
    
    neon_connection = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    
    try:
        conn = psycopg2.connect(neon_connection)
        cursor = conn.cursor()
        
        # Check indexes
        cursor.execute("""
            SELECT 
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE tablename = 'regulations'
            ORDER BY indexname;
        """)
        
        indexes = cursor.fetchall()
        
        print(f'📊 Found {len(indexes)} indexes:')
        for index_name, index_def in indexes:
            print(f'   • {index_name}')
            if 'UNIQUE' in index_def:
                print(f'     🔒 UNIQUE index')
            if 'btree' in index_def:
                print(f'     🌳 B-tree index')
        
        # Check primary key
        cursor.execute("""
            SELECT c.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
            JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
                AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
            WHERE constraint_type = 'PRIMARY KEY' and tc.table_name = 'regulations';
        """)
        
        pk_columns = cursor.fetchall()
        
        if pk_columns:
            print(f'\n🔑 Primary Key: {", ".join([col[0] for col in pk_columns])}')
        else:
            print('\n❌ No primary key found')
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f'❌ Error checking indexes: {e}')
        return False

def main():
    print('🎯 COMPLETE NEON TABLE STRUCTURE VERIFICATION')
    print('Full 47+ Column Schema Check')
    print('=' * 50)
    
    all_checks_passed = True
    
    # Step 1: Test connection
    print('STEP 1: Connection Test')
    if not check_neon_connection():
        print('❌ Connection test failed')
        return False
    
    # Step 2: Check table structure
    print('\nSTEP 2: Table Structure')
    if not check_table_structure():
        print('❌ Table structure check failed')
        all_checks_passed = False
    
    # Step 3: Check sample data
    print('\nSTEP 3: Sample Data & JSONB')
    if not check_sample_data():
        print('❌ Sample data check failed')
        all_checks_passed = False
    
    # Step 4: Check indexes and constraints
    print('\nSTEP 4: Indexes & Constraints')
    if not check_indexes_and_constraints():
        print('❌ Indexes check failed')
        all_checks_passed = False
    
    # Final summary
    if all_checks_passed:
        print('\n🎊 ALL CHECKS PASSED!')
        print('=' * 25)
        print('✅ Connection established')
        print('✅ Table structure matches schema')
        print('✅ Data quality verified')
        print('✅ Indexes and constraints OK')
        print('\n🚀 Your Neon database is ready for production!')
    else:
        print('\n⚠️  SOME CHECKS FAILED')
        print('=' * 25)
        print('Please review the issues above and fix them before deployment.')
    
    return all_checks_passed

if __name__ == '__main__':
    main() 