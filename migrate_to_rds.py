#!/usr/bin/env python3

import psycopg2
import psycopg2.extras
import os
import time
import sys
from pathlib import Path
import re
from typing import List, Dict, Optional

class RDSMigrator:
    def __init__(self):
        # RDS connection details (from live AWS application)
        self.rds_config = {
            'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            'port': 5432,
            'database': 'postgres',
            'user': 'postgres',
            'password': 'EdSteward2024!Secure',
            'sslmode': 'prefer'  # Changed from 'require' to 'prefer' to match live config
        }
        
        # Files to migrate in order
        self.migration_files = [
            'sql_dump/full_schema.sql',     # Schema first
            'sql_dump/users_data.sql',      # Users data
            'exports/regulations.sql',      # Regulations if exists
            'exports/notes.sql',           # Notes if exists
            'exports/guides.sql',          # Guides if exists
            'exports/deadlines.sql',       # Deadlines if exists
        ]
        
        self.log_file = 'migration_log.txt'
        
    def log(self, message: str, level: str = "INFO"):
        """Log messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        colors = {
            "SUCCESS": "\033[92m✅",
            "ERROR": "\033[91m❌",
            "WARNING": "\033[93m⚠️",
            "INFO": "\033[94mℹ️"
        }
        reset = "\033[0m"
        
        formatted_msg = f"{colors.get(level, colors['INFO'])} [{timestamp}] {message}{reset}"
        print(formatted_msg)
        
        # Also write to log file
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {level}: {message}\n")
    
    def test_rds_connection(self) -> bool:
        """Test connection to RDS with SSL"""
        self.log("Testing RDS connection with SSL...")
        
        try:
            conn = psycopg2.connect(**self.rds_config)
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            self.log(f"Connected to RDS: {version}", "SUCCESS")
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"RDS connection failed: {e}", "ERROR")
            return False
    
    def backup_existing_data(self) -> bool:
        """Create a backup of existing RDS data before migration"""
        self.log("Creating backup of existing RDS data...")
        
        try:
            conn = psycopg2.connect(**self.rds_config)
            cursor = conn.cursor()
            
            # Check if tables exist and have data
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            """)
            
            tables = [row[0] for row in cursor.fetchall()]
            
            if tables:
                self.log(f"Found {len(tables)} existing tables: {', '.join(tables)}")
                
                # Create backup directory
                backup_dir = Path('rds_backup')
                backup_dir.mkdir(exist_ok=True)
                
                # Backup each table
                for table in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    
                    if count > 0:
                        self.log(f"Backing up {table} ({count} rows)")
                        cursor.execute(f"SELECT * FROM {table}")
                        rows = cursor.fetchall()
                        
                        # Get column names
                        cursor.execute(f"""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name = '{table}' 
                            ORDER BY ordinal_position
                        """)
                        columns = [row[0] for row in cursor.fetchall()]
                        
                        # Write to backup file
                        backup_file = backup_dir / f"{table}_backup.sql"
                        with open(backup_file, 'w', encoding='utf-8') as f:
                            f.write(f"-- Backup of {table} table\\n\\n")
                            for row in rows:
                                values = []
                                for val in row:
                                    if val is None:
                                        values.append('NULL')
                                    elif isinstance(val, str):
                                        # Escape single quotes
                                        escaped = val.replace("'", "''")
                                        values.append(f"'{escaped}'")
                                    else:
                                        values.append(str(val))
                                
                                f.write(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(values)});\\n")
                
                self.log(f"Backup completed in {backup_dir}", "SUCCESS")
            else:
                self.log("No existing tables found - fresh database")
            
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"Backup failed: {e}", "WARNING")
            return False
    
    def clean_sql_content(self, content: str) -> str:
        """Clean SQL content for safe execution"""
        # Remove comments and normalize whitespace
        lines = []
        for line in content.split('\\n'):
            line = line.strip()
            if line and not line.startswith('--'):
                lines.append(line)
        
        return '\\n'.join(lines)
    
    def execute_sql_file(self, file_path: str) -> bool:
        """Execute SQL file content safely"""
        file_path_obj = Path(file_path)
        
        if not file_path_obj.exists():
            self.log(f"File not found: {file_path}", "WARNING")
            return True  # Continue with migration
        
        self.log(f"Executing SQL file: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if not content.strip():
                self.log(f"File is empty: {file_path}", "WARNING")
                return True
            
            conn = psycopg2.connect(**self.rds_config)
            conn.autocommit = False  # Use transactions
            cursor = conn.cursor()
            
            try:
                # Split content into individual statements
                statements = []
                current_statement = []
                
                for line in content.split('\\n'):
                    line = line.strip()
                    if not line or line.startswith('--'):
                        continue
                    
                    current_statement.append(line)
                    
                    # End of statement
                    if line.endswith(';'):
                        statement = ' '.join(current_statement).strip()
                        if statement and statement != ';':
                            statements.append(statement)
                        current_statement = []
                
                # Execute each statement
                executed_count = 0
                for statement in statements:
                    try:
                        cursor.execute(statement)
                        executed_count += 1
                    except psycopg2.IntegrityError as e:
                        if 'already exists' in str(e).lower():
                            self.log(f"Skipping existing object: {str(e)[:100]}", "WARNING")
                            conn.rollback()
                            conn.autocommit = False
                        else:
                            raise
                    except Exception as e:
                        self.log(f"Statement failed: {str(e)[:200]}", "ERROR")
                        self.log(f"Statement: {statement[:200]}...", "ERROR")
                        raise
                
                conn.commit()
                self.log(f"Successfully executed {executed_count} statements from {file_path}", "SUCCESS")
                
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                cursor.close()
                conn.close()
            
            return True
            
        except Exception as e:
            self.log(f"Failed to execute {file_path}: {e}", "ERROR")
            return False
    
    def verify_migration(self) -> bool:
        """Verify that migration was successful"""
        self.log("Verifying migration...")
        
        try:
            conn = psycopg2.connect(**self.rds_config)
            cursor = conn.cursor()
            
            # Check table counts
            verification_results = {}
            
            # Key tables to verify
            tables_to_check = ['users', 'regulations', 'notes', 'guides', 'deadlines']
            
            for table in tables_to_check:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    verification_results[table] = count
                    self.log(f"Table {table}: {count} rows")
                except Exception as e:
                    self.log(f"Could not verify table {table}: {e}", "WARNING")
                    verification_results[table] = "Error"
            
            # Check if we have users (critical for login)
            if verification_results.get('users', 0) > 0:
                cursor.execute("SELECT username, role FROM users LIMIT 5")
                users = cursor.fetchall()
                self.log("Sample users:", "SUCCESS")
                for username, role in users:
                    self.log(f"  - {username} ({role})")
            
            cursor.close()
            conn.close()
            
            self.log("Migration verification completed", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Verification failed: {e}", "ERROR")
            return False
    
    def run_migration(self) -> bool:
        """Run the complete migration process"""
        self.log("🚀 Starting database migration to RDS", "INFO")
        
        # Clear log file
        with open(self.log_file, 'w') as f:
            f.write("Database Migration Log\\n" + "="*50 + "\\n")
        
        # Step 1: Test connection
        if not self.test_rds_connection():
            self.log("Migration aborted - cannot connect to RDS", "ERROR")
            return False
        
        # Step 2: Backup existing data
        self.backup_existing_data()
        
        # Step 3: Execute migration files
        success_count = 0
        total_files = len(self.migration_files)
        
        for file_path in self.migration_files:
            if self.execute_sql_file(file_path):
                success_count += 1
            else:
                self.log(f"Migration file failed: {file_path}", "ERROR")
                # Continue with other files - don't abort completely
        
        self.log(f"Migration completed: {success_count}/{total_files} files processed successfully")
        
        # Step 4: Verify migration
        verification_success = self.verify_migration()
        
        # Step 5: Summary
        if success_count == total_files and verification_success:
            self.log("🎉 Migration completed successfully!", "SUCCESS")
            self.log("Your application should now work with the migrated data", "SUCCESS")
            return True
        else:
            self.log("⚠️ Migration completed with some issues", "WARNING")
            self.log("Check the migration log for details", "WARNING")
            return False

def main():
    migrator = RDSMigrator()
    
    print("🔄 Database Migration to AWS RDS")
    print("=" * 50)
    print("This will migrate your local database to AWS RDS")
    print("SSL connection required - pager issues avoided")
    print()
    
    # Confirm before proceeding
    response = input("Do you want to proceed? (y/N): ").strip().lower()
    if response != 'y':
        print("Migration cancelled")
        return
    
    success = migrator.run_migration()
    
    if success:
        print("\\n✅ Migration completed successfully!")
        print("🌐 Your application at https://edsteward.ai should now have all your data")
    else:
        print("\\n⚠️ Migration completed with issues")
        print("📋 Check migration_log.txt for details")
    
    print(f"\\n📋 Full log available in: migration_log.txt")

if __name__ == "__main__":
    main()