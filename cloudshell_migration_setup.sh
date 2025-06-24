#!/bin/bash

# AWS CloudShell Migration Setup Script
echo "🚀 Setting up Database Migration in AWS CloudShell"
echo "================================================"

# Create migration directory
mkdir -p ~/database-migration
cd ~/database-migration

echo "📦 Installing dependencies..."

# Install Python dependencies
pip3 install --user psycopg2-binary boto3

echo "✅ Dependencies installed"

# Create the migration script
cat > migrate_to_rds.py << 'EOF'
#!/usr/bin/env python3

import psycopg2
import psycopg2.extras
import os
import time
import sys
from pathlib import Path
import re
from typing import List, Dict, Optional

class CloudShellRDSMigrator:
    def __init__(self):
        # RDS connection details (from live AWS application)
        self.rds_config = {
            'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
            'port': 5432,
            'database': 'postgres',
            'user': 'postgres',
            'password': 'EdSteward2024!Secure',
            'sslmode': 'prefer'
        }
        
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
        """Test connection to RDS"""
        self.log("Testing RDS connection from CloudShell...")
        
        try:
            conn = psycopg2.connect(**self.rds_config)
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            self.log(f"Connected to RDS: {version}", "SUCCESS")
            
            # Check existing tables
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            """)
            
            tables = [row[0] for row in cursor.fetchall()]
            if tables:
                self.log(f"Found {len(tables)} existing tables: {', '.join(tables)}")
            else:
                self.log("Database is empty - ready for migration")
            
            cursor.close()
            conn.close()
            return True
            
        except Exception as e:
            self.log(f"RDS connection failed: {e}", "ERROR")
            return False
    
    def create_sample_data(self):
        """Create sample data for migration"""
        self.log("Creating sample SQL data files...")
        
        # Create users data
        users_sql = """
-- Sample users data for migration
INSERT INTO users (id, username, password, role, department, email, "firstName", "lastName", created_at, updated_at) VALUES
(1, 'admin', 'hashed_password_1', 'admin', 'IT', 'admin@moravian.edu', 'Admin', 'User', NOW(), NOW()),
(2, 'dvdbrnds', 'hashed_password_2', 'admin', 'IT', 'brandesd@moravian.edu', 'David', 'Brandes', NOW(), NOW()),
(3, 'testuser', 'hashed_password_3', 'user', 'Compliance', 'test@moravian.edu', 'Test', 'User', NOW(), NOW());

-- Update sequence
SELECT setval('users_id_seq', 3, true);
"""
        
        with open('sample_users.sql', 'w') as f:
            f.write(users_sql)
        
        # Create basic schema
        schema_sql = """
-- Basic schema for EdSteward application
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    department VARCHAR(255),
    email VARCHAR(255),
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    external_id VARCHAR(255),
    provider_id VARCHAR(255),
    identity_provider VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regulations (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(255),
    agency_name VARCHAR(255),
    jurisdiction VARCHAR(255),
    topic VARCHAR(255),
    item_id VARCHAR(255),
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER REFERENCES regulations(id),
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(255) DEFAULT 'general',
    status VARCHAR(255) DEFAULT 'active',
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guides (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS deadlines (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER REFERENCES regulations(id),
    due_date DATE NOT NULL,
    status TEXT NOT NULL,
    assigned_to INTEGER REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_regulations_agency ON regulations(agency_name);
CREATE INDEX IF NOT EXISTS idx_regulations_category ON regulations(category);
CREATE INDEX IF NOT EXISTS idx_regulations_last_updated ON regulations(last_updated);
CREATE INDEX IF NOT EXISTS idx_notes_regulation_id ON notes(regulation_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
"""
        
        with open('schema.sql', 'w') as f:
            f.write(schema_sql)
        
        self.log("Sample data files created")
    
    def execute_sql_file(self, file_path: str) -> bool:
        """Execute SQL file"""
        if not os.path.exists(file_path):
            self.log(f"File not found: {file_path}", "WARNING")
            return True
        
        self.log(f"Executing SQL file: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if not content.strip():
                self.log(f"File is empty: {file_path}", "WARNING")
                return True
            
            conn = psycopg2.connect(**self.rds_config)
            conn.autocommit = False
            cursor = conn.cursor()
            
            try:
                # Execute the SQL content
                cursor.execute(content)
                conn.commit()
                self.log(f"Successfully executed {file_path}", "SUCCESS")
                
            except Exception as e:
                conn.rollback()
                self.log(f"Failed to execute {file_path}: {e}", "ERROR")
                return False
            finally:
                cursor.close()
                conn.close()
            
            return True
            
        except Exception as e:
            self.log(f"Failed to process {file_path}: {e}", "ERROR")
            return False
    
    def verify_migration(self) -> bool:
        """Verify migration results"""
        self.log("Verifying migration...")
        
        try:
            conn = psycopg2.connect(**self.rds_config)
            cursor = conn.cursor()
            
            # Check tables
            tables_to_check = ['users', 'regulations', 'notes', 'guides', 'deadlines']
            
            for table in tables_to_check:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    self.log(f"Table {table}: {count} rows")
                except Exception as e:
                    self.log(f"Table {table}: not found or error - {e}", "WARNING")
            
            # Check sample users
            try:
                cursor.execute("SELECT username, role FROM users LIMIT 5")
                users = cursor.fetchall()
                if users:
                    self.log("Sample users found:", "SUCCESS")
                    for username, role in users:
                        self.log(f"  - {username} ({role})")
            except Exception as e:
                self.log(f"Could not verify users: {e}", "WARNING")
            
            cursor.close()
            conn.close()
            
            return True
            
        except Exception as e:
            self.log(f"Verification failed: {e}", "ERROR")
            return False
    
    def run_migration(self):
        """Run complete migration"""
        self.log("🚀 Starting CloudShell Database Migration", "INFO")
        
        # Clear log
        with open(self.log_file, 'w') as f:
            f.write("CloudShell Database Migration Log\n" + "="*50 + "\n")
        
        # Test connection
        if not self.test_rds_connection():
            self.log("Migration aborted - cannot connect to RDS", "ERROR")
            return False
        
        # Create sample data
        self.create_sample_data()
        
        # Execute schema
        success = self.execute_sql_file('schema.sql')
        if success:
            # Execute sample data
            success = self.execute_sql_file('sample_users.sql')
        
        # Verify
        if success:
            self.verify_migration()
            self.log("🎉 Migration completed successfully!", "SUCCESS")
            self.log("Your AWS application should now have sample data", "SUCCESS")
        else:
            self.log("⚠️ Migration completed with issues", "WARNING")
        
        return success

def main():
    print("🔄 AWS CloudShell Database Migration")
    print("=" * 50)
    print("This will migrate sample data to your AWS RDS instance")
    print()
    
    migrator = CloudShellRDSMigrator()
    success = migrator.run_migration()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("🌐 Your application at https://edsteward.ai should now have data")
    else:
        print("\n⚠️ Migration completed with issues")
        print("📋 Check migration_log.txt for details")

if __name__ == "__main__":
    main()
EOF

# Create test connection script
cat > test_connection.py << 'EOF'
#!/usr/bin/env python3

import psycopg2

def test_connection():
    print("🔄 Testing RDS Connection from CloudShell")
    print("=" * 45)
    
    config = {
        'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
        'port': 5432,
        'database': 'postgres',
        'user': 'postgres',
        'password': 'EdSteward2024!Secure',
        'sslmode': 'prefer'
    }
    
    try:
        conn = psycopg2.connect(**config)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✅ Connected successfully!")
        print(f"📊 PostgreSQL: {version}")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()
EOF

echo "🎉 Migration setup complete!"
echo ""
echo "Next steps:"
echo "1. Test connection: python3 test_connection.py"
echo "2. Run migration: python3 migrate_to_rds.py"
echo ""
echo "Files created:"
echo "- migrate_to_rds.py (main migration script)"
echo "- test_connection.py (connection test)"
echo "- schema.sql (will be created by migration script)"
echo "- sample_users.sql (will be created by migration script)"