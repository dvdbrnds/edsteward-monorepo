-- Development Database Initialization
-- Creates tables without neondb_owner references

-- Create basic schema first
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER,
    user_id INTEGER,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deadlines (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER,
    title VARCHAR(255),
    deadline_date DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_files (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    description TEXT,
    uploaded_by INTEGER NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    storage_path TEXT NOT NULL,
    is_official BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS guides (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER,
    user_id INTEGER,
    title VARCHAR(255),
    content TEXT,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regulations (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(255) UNIQUE,
    title TEXT,
    summary TEXT,
    agency VARCHAR(255),
    category VARCHAR(255),
    jurisdiction VARCHAR(255),
    topic VARCHAR(255),
    status VARCHAR(100),
    effective_date DATE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    regulation_text TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),
    message TEXT,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    source VARCHAR(100),
    facility VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    password VARCHAR(255),
    avatar_url VARCHAR(500),
    preferences JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_regulations_agency ON regulations(agency);
CREATE INDEX IF NOT EXISTS idx_regulations_category ON regulations(category);
CREATE INDEX IF NOT EXISTS idx_regulations_item_id ON regulations(item_id);
CREATE INDEX IF NOT EXISTS idx_regulations_jurisdiction ON regulations(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_regulations_last_updated ON regulations(last_updated);
CREATE INDEX IF NOT EXISTS idx_regulations_topic ON regulations(topic);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);

-- Insert test users for development with hashed passwords
-- Password for developer: admin123
-- Password for testuser: test123
INSERT INTO users (external_id, username, email, full_name, role, password) 
VALUES 
  ('dev-user-1', 'developer', 'dev@regulatorytrackr.com', 'Development User', 'admin', 'ae4570032cd4849aa31a51186bebe89d8fc8fda991bc01d650cacb1b12c4d7433a31e2f55d062383f39ce9b8be416c030edae4dfc76678a6bee550bf054dc5dd.edbd6e8767ca739244f043ed0c7bd407'),
  ('test-user-1', 'testuser', 'test@regulatorytrackr.com', 'Test User', 'user', '0dd04a03c1e49e1b8304e51297551c7de32662ee86e6238a42f6b3fe4d4a83537b1e20927f2e57d907820f0965e352b9983105356344c84cb4b4fb33c1217099.0aee7909f1f535c9e922fb9ebd4ca634')
ON CONFLICT (username) DO NOTHING;

-- Insert some sample regulations for testing
INSERT INTO regulations (item_id, title, summary, agency, category, jurisdiction, topic, status, effective_date) 
VALUES 
  ('REG-DEV-001', 'Development Test Regulation', 'A sample regulation for testing during development', 'Test Agency', 'Development', 'Federal', 'Testing', 'active', CURRENT_DATE),
  ('REG-DEV-002', 'Another Test Regulation', 'Another sample for development testing', 'Test Agency', 'Development', 'State', 'Testing', 'active', CURRENT_DATE)
ON CONFLICT (item_id) DO NOTHING;

-- Development completion message
DO $$
BEGIN
    RAISE NOTICE 'Development database initialized successfully!';
    RAISE NOTICE 'Test users created: developer (admin), testuser (user)';
    RAISE NOTICE 'Sample regulations added for testing';
END $$; 