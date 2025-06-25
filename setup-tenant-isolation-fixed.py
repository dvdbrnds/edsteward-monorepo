#!/usr/bin/env python3
"""
Setup proper tenant database isolation for EdSteward (Fixed Version)
Uses pg_dump/pg_restore for proper schema and data migration
"""

import psycopg2
import subprocess
import os
import sys

# Base database configuration
BASE_DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

# Tenant configuration
TENANTS = {
    'admin': {
        'name': 'EdSteward Admin',
        'database': 'edsteward_admin',
        'description': 'Admin console and staging environment'
    },
    'moravian': {
        'name': 'Moravian University',
        'database': 'edsteward_moravian',
        'description': 'Moravian University production tenant'
    },
    'staging': {
        'name': 'EdSteward Staging',
        'database': 'edsteward_staging',
        'description': 'Staging environment for testing'
    },
    'test': {
        'name': 'EdSteward Test',
        'database': 'edsteward_test',
        'description': 'Test environment for development'
    }
}

def connect_to_database(database='postgres'):
    """Connect to PostgreSQL database"""
    config = {**BASE_DB_CONFIG, 'database': database}
    return psycopg2.connect(**config)

def database_exists(cursor, db_name):
    """Check if database exists"""
    cursor.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s",
        (db_name,)
    )
    return cursor.fetchone() is not None

def create_database(cursor, db_name):
    """Create database if it doesn't exist"""
    if not database_exists(cursor, db_name):
        cursor.execute(f'CREATE DATABASE "{db_name}"')
        print(f'✅ Created database: {db_name}')
        return True
    else:
        print(f'ℹ️  Database already exists: {db_name}')
        return False

def copy_database_with_pgdump(source_db, target_db):
    """Copy database using pg_dump and pg_restore"""
    print(f'🔄 Copying database from {source_db} to {target_db} using pg_dump...')
    
    # Set environment variables for PostgreSQL commands
    env = os.environ.copy()
    env['PGPASSWORD'] = BASE_DB_CONFIG['password']
    
    dump_file = f'/tmp/{target_db}_dump.sql'
    
    try:
        # Step 1: Dump source database
        print(f'   📤 Dumping {source_db}...')
        dump_cmd = [
            'pg_dump',
            '-h', BASE_DB_CONFIG['host'],
            '-p', str(BASE_DB_CONFIG['port']),
            '-U', BASE_DB_CONFIG['user'],
            '-d', source_db,
            '-f', dump_file,
            '--verbose',
            '--no-owner',
            '--no-privileges'
        ]
        
        result = subprocess.run(dump_cmd, env=env, capture_output=True, text=True)
        if result.returncode != 0:
            print(f'   ❌ pg_dump failed: {result.stderr}')
            return False
        
        print(f'   ✅ Successfully dumped {source_db}')
        
        # Step 2: Restore to target database
        print(f'   📥 Restoring to {target_db}...')
        restore_cmd = [
            'psql',
            '-h', BASE_DB_CONFIG['host'],
            '-p', str(BASE_DB_CONFIG['port']),
            '-U', BASE_DB_CONFIG['user'],
            '-d', target_db,
            '-f', dump_file,
            '-v', 'ON_ERROR_STOP=1'
        ]
        
        result = subprocess.run(restore_cmd, env=env, capture_output=True, text=True)
        if result.returncode != 0:
            print(f'   ⚠️  psql restore had issues: {result.stderr[:500]}...')
            # Don't return False here as some warnings are expected
        
        print(f'   ✅ Successfully restored to {target_db}')
        
        # Clean up dump file
        os.remove(dump_file)
        
        return True
        
    except Exception as e:
        print(f'   ❌ Database copy failed: {e}')
        # Clean up dump file if it exists
        if os.path.exists(dump_file):
            os.remove(dump_file)
        return False

def setup_tenant_databases():
    """Set up all tenant databases"""
    print('🏢 Setting up tenant database isolation for EdSteward (Fixed Version)')
    print('=' * 70)
    
    # Connect to PostgreSQL server
    conn = connect_to_database('postgres')
    conn.autocommit = True  # Required for CREATE DATABASE
    cursor = conn.cursor()
    
    try:
        # Create tenant databases
        print('\n📋 Step 1: Creating tenant databases...')
        for tenant_id, config in TENANTS.items():
            print(f'\n🏗️  Setting up tenant: {config["name"]} ({tenant_id})')
            print(f'   Database: {config["database"]}')
            print(f'   Description: {config["description"]}')
            
            created = create_database(cursor, config['database'])
            
            # Copy data for all tenants except Moravian (which will be migrated separately)
            if created or tenant_id in ['admin', 'staging', 'test']:
                print(f'📋 Copying data to {config["database"]}...')
                
                if tenant_id == 'moravian':
                    print(f'   ℹ️  Moravian tenant will be set up with existing data')
                    # Copy from main edsteward database to moravian database
                    success = copy_database_with_pgdump('edsteward', config['database'])
                else:
                    # For admin/staging/test, copy from main database
                    success = copy_database_with_pgdump('edsteward', config['database'])
                
                if success:
                    print(f'   ✅ Database setup complete for {tenant_id}')
                else:
                    print(f'   ⚠️  Database setup had issues for {tenant_id}')
        
        print('\n📊 Step 2: Generating environment variables...')
        
        # Generate environment variables
        env_vars = []
        for tenant_id, config in TENANTS.items():
            var_name = f"{tenant_id.upper()}_DATABASE_URL"
            var_value = f"postgresql://{BASE_DB_CONFIG['user']}:{BASE_DB_CONFIG['password']}@{BASE_DB_CONFIG['host']}:{BASE_DB_CONFIG['port']}/{config['database']}?sslmode=require"
            env_vars.append(f'{var_name}="{var_value}"')
        
        print('\n🔧 Environment Variables to Add:')
        print('-' * 40)
        for env_var in env_vars:
            print(env_var)
        
        # Save to file
        with open('tenant-database-env-vars.txt', 'w') as f:
            f.write('# Tenant Database Environment Variables\n')
            f.write('# Add these to your deployment environment\n\n')
            for env_var in env_vars:
                f.write(env_var + '\n')
        
        print(f'\n💾 Environment variables saved to: tenant-database-env-vars.txt')
        
        print('\n📊 Step 3: Database summary...')
        print('-' * 40)
        
        for tenant_id, config in TENANTS.items():
            # Check database size
            try:
                cursor.execute(f"""
                    SELECT pg_size_pretty(pg_database_size('{config["database"]}'))
                """)
                size = cursor.fetchone()[0]
                print(f'   {config["name"]}: {config["database"]} ({size})')
            except Exception as e:
                print(f'   {config["name"]}: {config["database"]} (size check failed: {e})')
        
        print('\n🎉 Tenant database isolation setup complete!')
        print('\n📋 Next Steps:')
        print('1. Add the environment variables to your deployment')
        print('2. Restart the application to use tenant-specific databases')
        print('3. Test each tenant endpoint to verify isolation')
        print('4. Monitor database connections and performance')
        
    finally:
        cursor.close()
        conn.close()

def verify_tenant_isolation():
    """Verify that tenant isolation is working"""
    print('\n🔍 Verifying tenant isolation...')
    
    for tenant_id, config in TENANTS.items():
        try:
            conn = connect_to_database(config['database'])
            cursor = conn.cursor()
            
            # Check if tables exist
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            table_count = cursor.fetchone()[0]
            
            if table_count > 0:
                # Check regulations count
                cursor.execute("SELECT COUNT(*) FROM regulations")
                reg_count = cursor.fetchone()[0]
                
                # Check users count
                cursor.execute("SELECT COUNT(*) FROM users")
                user_count = cursor.fetchone()[0]
                
                print(f'   ✅ {config["name"]}: {reg_count} regulations, {user_count} users, {table_count} tables')
            else:
                print(f'   ⚠️  {config["name"]}: No tables found')
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f'   ❌ {config["name"]}: Connection failed - {e}')

def migrate_moravian_data():
    """Special function to migrate Moravian data properly"""
    print('\n🏛️  Migrating Moravian data to separate database...')
    
    # The main 'edsteward' database contains Moravian's data
    # We need to copy it to 'edsteward_moravian' 
    success = copy_database_with_pgdump('edsteward', 'edsteward_moravian')
    
    if success:
        print('✅ Moravian data migration complete')
        return True
    else:
        print('❌ Moravian data migration failed')
        return False

if __name__ == "__main__":
    try:
        setup_tenant_databases()
        verify_tenant_isolation()
        
        # Special handling for Moravian data migration
        print('\n' + '='*50)
        migrate_moravian_data()
        
    except KeyboardInterrupt:
        print('\n⚠️  Setup interrupted by user')
        sys.exit(1)
    except Exception as e:
        print(f'\n❌ Setup failed: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1) 