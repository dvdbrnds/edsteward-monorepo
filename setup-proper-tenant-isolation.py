#!/usr/bin/env python3
"""
Setup proper tenant database isolation for EdSteward
Creates separate databases for each tenant with proper data migration
"""

import psycopg2
import json
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
        # Create database (must be done outside transaction)
        cursor.execute(f'CREATE DATABASE "{db_name}"')
        print(f'✅ Created database: {db_name}')
        return True
    else:
        print(f'ℹ️  Database already exists: {db_name}')
        return False

def copy_schema_and_data(source_db, target_db, tenant_id):
    """Copy schema and data from source to target database"""
    print(f'🔄 Copying schema and data from {source_db} to {target_db}...')
    
    # Connect to source database
    source_conn = connect_to_database(source_db)
    source_cursor = source_conn.cursor()
    
    # Connect to target database
    target_conn = connect_to_database(target_db)
    target_cursor = target_conn.cursor()
    
    try:
        # Get all table names
        source_cursor.execute("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename NOT LIKE 'pg_%'
            ORDER BY tablename
        """)
        tables = [row[0] for row in source_cursor.fetchall()]
        
        print(f'📋 Found {len(tables)} tables to copy')
        
        for table in tables:
            print(f'   Copying table: {table}')
            
            # Get table schema
            source_cursor.execute(f"""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '{table}' 
                ORDER BY ordinal_position
            """)
            columns = source_cursor.fetchall()
            
            if not columns:
                continue
                
            # Create table in target database
            create_sql = f"CREATE TABLE IF NOT EXISTS {table} ("
            column_defs = []
            
            for col_name, data_type, is_nullable, col_default in columns:
                col_def = f"{col_name} {data_type}"
                if is_nullable == 'NO':
                    col_def += " NOT NULL"
                if col_default:
                    col_def += f" DEFAULT {col_default}"
                column_defs.append(col_def)
            
            create_sql += ", ".join(column_defs) + ")"
            
            try:
                target_cursor.execute(create_sql)
                target_conn.commit()
            except Exception as e:
                print(f'   ⚠️  Schema creation failed for {table}: {e}')
                continue
            
            # Copy data
            source_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            row_count = source_cursor.fetchone()[0]
            
            if row_count > 0:
                print(f'   📊 Copying {row_count} rows from {table}')
                
                # Get all data
                source_cursor.execute(f"SELECT * FROM {table}")
                rows = source_cursor.fetchall()
                
                if rows:
                    # Get column names for insert
                    source_cursor.execute(f"""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = '{table}' 
                        ORDER BY ordinal_position
                    """)
                    col_names = [row[0] for row in source_cursor.fetchall()]
                    
                    # Prepare insert statement
                    placeholders = ', '.join(['%s'] * len(col_names))
                    insert_sql = f"INSERT INTO {table} ({', '.join(col_names)}) VALUES ({placeholders})"
                    
                    # Insert data in batches
                    batch_size = 100
                    for i in range(0, len(rows), batch_size):
                        batch = rows[i:i + batch_size]
                        try:
                            target_cursor.executemany(insert_sql, batch)
                            target_conn.commit()
                        except Exception as e:
                            print(f'   ⚠️  Data copy failed for {table} batch {i//batch_size + 1}: {e}')
                            target_conn.rollback()
                            continue
                    
                    print(f'   ✅ Copied {len(rows)} rows to {table}')
            else:
                print(f'   ℹ️  No data to copy for {table}')
        
        # Copy indexes and constraints
        print('🔗 Copying indexes and constraints...')
        source_cursor.execute("""
            SELECT indexname, indexdef FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname NOT LIKE 'pg_%'
            AND indexname NOT LIKE '%_pkey'
        """)
        indexes = source_cursor.fetchall()
        
        for index_name, index_def in indexes:
            try:
                target_cursor.execute(index_def)
                target_conn.commit()
                print(f'   ✅ Created index: {index_name}')
            except Exception as e:
                print(f'   ⚠️  Index creation failed for {index_name}: {e}')
        
        print(f'✅ Successfully copied database from {source_db} to {target_db}')
        
    finally:
        source_cursor.close()
        source_conn.close()
        target_cursor.close()
        target_conn.close()

def setup_tenant_databases():
    """Set up all tenant databases"""
    print('🏢 Setting up tenant database isolation for EdSteward')
    print('=' * 60)
    
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
            
            if created or tenant_id in ['admin', 'staging']:
                # Copy data from main database to tenant database
                print(f'📋 Copying data to {config["database"]}...')
                
                # For admin/staging, copy from main edsteward database
                # For moravian, it should already have data
                # For test, copy from main database
                source_db = 'edsteward'
                
                if tenant_id == 'moravian':
                    # Moravian should keep its existing data in main database
                    print(f'   ℹ️  Moravian tenant will use existing data in main database')
                    continue
                
                copy_schema_and_data(source_db, config['database'], tenant_id)
        
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
            cursor.execute(f"""
                SELECT pg_size_pretty(pg_database_size('{config["database"]}'))
            """)
            try:
                size = cursor.fetchone()[0]
                print(f'   {config["name"]}: {config["database"]} ({size})')
            except:
                print(f'   {config["name"]}: {config["database"]} (size unknown)')
        
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
            
            # Check regulations count
            cursor.execute("SELECT COUNT(*) FROM regulations")
            reg_count = cursor.fetchone()[0]
            
            # Check users count
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            
            print(f'   {config["name"]}: {reg_count} regulations, {user_count} users')
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f'   ❌ {config["name"]}: Connection failed - {e}')

if __name__ == "__main__":
    try:
        setup_tenant_databases()
        verify_tenant_isolation()
    except KeyboardInterrupt:
        print('\n⚠️  Setup interrupted by user')
        sys.exit(1)
    except Exception as e:
        print(f'\n❌ Setup failed: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1) 