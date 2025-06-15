import json
import psycopg2
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database configuration
DB_CONFIG = {
    'host': 'edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'sslmode': 'prefer'
}

# Schema SQL
SCHEMA_SQL = """
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Regulations table
CREATE TABLE IF NOT EXISTS regulations (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    effective_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER REFERENCES regulations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guides table
CREATE TABLE IF NOT EXISTS guides (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    category VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT false
);

-- Deadlines table
CREATE TABLE IF NOT EXISTS deadlines (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER REFERENCES regulations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_regulations_category ON regulations(category);
CREATE INDEX IF NOT EXISTS idx_regulations_status ON regulations(status);
CREATE INDEX IF NOT EXISTS idx_notes_regulation_id ON notes(regulation_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
CREATE INDEX IF NOT EXISTS idx_deadlines_regulation_id ON deadlines(regulation_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_assigned_to ON deadlines(assigned_to);
"""

# Sample data
USERS_DATA = """
INSERT INTO users (username, email, password_hash, role, department, is_active) VALUES
('admin', 'admin@edsteward.ai', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9jG', 'admin', 'IT', true),
('john.doe', 'john.doe@edsteward.ai', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Compliance', true),
('jane.smith', 'jane.smith@edsteward.ai', '$2b$12$gSvs2AANp.VgCzxbRjXnUOh1l8/0nZ8VhWn8/LewdBPj/VcSAg/9jG', 'manager', 'Legal', true),
('mike.wilson', 'mike.wilson@edsteward.ai', '$2b$12$h3vB4AANp.VgCzxbRjXnUOh1l8/0nZ8VhWn8/LewdBPj/VcSAg/9jG', 'user', 'Operations', true)
ON CONFLICT (username) DO NOTHING;
"""

REGULATIONS_DATA = """
INSERT INTO regulations (title, description, category, effective_date, status, created_by) VALUES
('GDPR Compliance Requirements', 'General Data Protection Regulation compliance guidelines', 'Data Privacy', '2018-05-25', 'active', 1),
('SOX Financial Reporting', 'Sarbanes-Oxley Act financial reporting requirements', 'Financial', '2002-07-30', 'active', 1),
('HIPAA Privacy Rules', 'Health Insurance Portability and Accountability Act privacy requirements', 'Healthcare', '1996-08-21', 'active', 1),
('PCI DSS Standards', 'Payment Card Industry Data Security Standards', 'Security', '2004-12-15', 'active', 1)
ON CONFLICT DO NOTHING;
"""

GUIDES_DATA = """
INSERT INTO guides (title, content, category, created_by, is_published) VALUES
('GDPR Implementation Guide', 'Step-by-step guide for implementing GDPR compliance measures...', 'Data Privacy', 1, true),
('SOX Audit Preparation', 'How to prepare for SOX compliance audits...', 'Financial', 1, true),
('Data Breach Response Plan', 'Emergency response procedures for data breaches...', 'Security', 1, true)
ON CONFLICT DO NOTHING;
"""

def lambda_handler(event, context):
    """
    Lambda function to migrate database schema and data
    """
    try:
        logger.info("Starting database migration...")
        
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        cursor = conn.cursor()
        
        try:
            # Create schema
            logger.info("Creating database schema...")
            cursor.execute(SCHEMA_SQL)
            
            # Insert users data
            logger.info("Inserting users data...")
            cursor.execute(USERS_DATA)
            
            # Insert regulations data
            logger.info("Inserting regulations data...")
            cursor.execute(REGULATIONS_DATA)
            
            # Insert guides data
            logger.info("Inserting guides data...")
            cursor.execute(GUIDES_DATA)
            
            # Commit transaction
            conn.commit()
            logger.info("Migration completed successfully!")
            
            # Verify data
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM regulations")
            regulation_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM guides")
            guide_count = cursor.fetchone()[0]
            
            result = {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Migration completed successfully',
                    'users_count': user_count,
                    'regulations_count': regulation_count,
                    'guides_count': guide_count
                })
            }
            
            logger.info(f"Migration results: {result['body']}")
            return result
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Migration failed: {str(e)}")
            raise e
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        } 