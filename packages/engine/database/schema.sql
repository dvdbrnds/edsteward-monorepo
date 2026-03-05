-- ============================================================
-- MCP ENGINE DATABASE SCHEMA
-- PostgreSQL Migration - Complete Schema
-- Includes: Multi-jurisdiction support (migration 005)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DROP EXISTING TABLES (clean slate)
-- ============================================================
DROP TABLE IF EXISTS transmission_log CASCADE;
DROP TABLE IF EXISTS regulation_audit_log CASCADE;
DROP TABLE IF EXISTS regulation_versions CASCADE;
DROP TABLE IF EXISTS regulation_tasks CASCADE;
DROP TABLE IF EXISTS regulation_deadlines CASCADE;
DROP TABLE IF EXISTS regulation_relationships CASCADE;
DROP TABLE IF EXISTS regulation_jurisdictions CASCADE;
DROP TABLE IF EXISTS regulation_tags CASCADE;
DROP TABLE IF EXISTS regulations CASCADE;

-- ============================================================
-- REGULATIONS (Core table)
-- ============================================================
CREATE TABLE regulations (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(200) UNIQUE NOT NULL,
    
    -- Identity
    name VARCHAR(500) NOT NULL,
    short_name VARCHAR(100),
    
    -- Legal Reference
    statute VARCHAR(500),
    uscode VARCHAR(200),
    cfr VARCHAR(200),
    public_law VARCHAR(100),
    
    -- Classification
    category VARCHAR(100) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    jurisdiction_source VARCHAR(50) NOT NULL DEFAULT 'federal',
    state_code VARCHAR(2),
    country_code VARCHAR(3) DEFAULT 'US',
    regulatory_body VARCHAR(200),
    jurisdiction_label VARCHAR(100),
    act_number VARCHAR(100),
    applicability VARCHAR(50) DEFAULT 'all',
    reg_key VARCHAR(20),
    
    -- Content
    summary TEXT,
    requirements TEXT,
    regulation_text TEXT,
    purpose TEXT,
    scope TEXT,
    reporting_requirements TEXT,
    
    -- Source
    source_url VARCHAR(500),
    source_last_checked TIMESTAMP,
    agency_name VARCHAR(200),
    agency_url VARCHAR(500),
    agency_contact VARCHAR(200),
    
    -- Dates
    effective_date DATE,
    last_amended DATE,
    deadline VARCHAR(200),
    deadline_month VARCHAR(20),
    deadline_label VARCHAR(50),
    
    -- L.O.V.V. Validation
    lovv_level CHAR(1) CHECK (lovv_level IN ('A', 'B', 'C', 'D')),
    last_validated TIMESTAMP,
    validation_method VARCHAR(50),
    validation_certainty INTEGER CHECK (validation_certainty BETWEEN 0 AND 100),
    
    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    version_hash VARCHAR(64),
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system'
);

-- ============================================================
-- REGULATION DEADLINES
-- ============================================================
CREATE TABLE regulation_deadlines (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    
    deadline_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    deadline_type VARCHAR(50),
    due_date DATE,
    frequency VARCHAR(50),
    recurring_month INTEGER CHECK (recurring_month BETWEEN 1 AND 12),
    recurring_day INTEGER CHECK (recurring_day BETWEEN 1 AND 31),
    
    advance_notice_days INTEGER DEFAULT 30,
    penalty_for_missing TEXT,
    reporting_to VARCHAR(200),
    
    deadline_label VARCHAR(200),
    is_recurring BOOLEAN DEFAULT FALSE,
    is_passed BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REGULATION JURISDICTIONS (multi-state/multi-region)
-- ============================================================
CREATE TABLE regulation_jurisdictions (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    state_code VARCHAR(2),
    country_code VARCHAR(3) DEFAULT 'US',
    region_code VARCHAR(20),
    applies_to VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(regulation_id, state_code, country_code)
);

-- ============================================================
-- REGULATION RELATIONSHIPS (implements, amends, extends, etc.)
-- ============================================================
CREATE TABLE regulation_relationships (
    id SERIAL PRIMARY KEY,
    source_regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    target_regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL
        CHECK (relationship_type IN (
            'implements', 'amends', 'extends', 'supersedes',
            'related', 'conflicts', 'complements'
        )),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(source_regulation_id, target_regulation_id, relationship_type)
);

-- ============================================================
-- REGULATION TAGS (multi-category/topic tagging)
-- ============================================================
CREATE TABLE regulation_tags (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    tag_type VARCHAR(50) NOT NULL DEFAULT 'category'
        CHECK (tag_type IN ('category', 'topic', 'keyword', 'agency', 'program')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(regulation_id, tag, tag_type)
);

-- ============================================================
-- REGULATION TASKS
-- ============================================================
CREATE TABLE regulation_tasks (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    deadline_id INTEGER REFERENCES regulation_deadlines(id) ON DELETE SET NULL,
    parent_task_id INTEGER REFERENCES regulation_tasks(id) ON DELETE SET NULL,
    
    task_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    
    category VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    assigned_role VARCHAR(100),
    estimated_effort VARCHAR(50),
    
    evidence_required BOOLEAN DEFAULT FALSE,
    evidence_type VARCHAR(50),
    evidence_instructions TEXT,
    
    deliverable VARCHAR(255),
    deliverable_template_url VARCHAR(500),
    
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REGULATION VERSIONS (History)
-- ============================================================
CREATE TABLE regulation_versions (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    version_hash VARCHAR(64),
    
    content_snapshot JSONB NOT NULL,
    
    change_summary TEXT,
    changed_by VARCHAR(100),
    change_source VARCHAR(100),
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(regulation_id, version)
);

-- ============================================================
-- AUDIT LOG (Immutable - INSERT only)
-- ============================================================
CREATE TABLE regulation_audit_log (
    id SERIAL PRIMARY KEY,
    
    regulation_id INTEGER REFERENCES regulations(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    
    action VARCHAR(50) NOT NULL,
    
    previous_values JSONB,
    new_values JSONB,
    
    performed_by VARCHAR(100),
    performed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    
    notes TEXT
);

-- ============================================================
-- TRANSMISSION LOG (EdSteward sync tracking)
-- ============================================================
CREATE TABLE transmission_log (
    id SERIAL PRIMARY KEY,
    transmission_id UUID DEFAULT uuid_generate_v4(),
    
    destination VARCHAR(100) NOT NULL DEFAULT 'edsteward',
    regulation_id INTEGER REFERENCES regulations(id),
    regulation_count INTEGER NOT NULL DEFAULT 1,
    deadline_count INTEGER DEFAULT 0,
    task_count INTEGER DEFAULT 0,
    
    payload JSONB,
    payload_hash VARCHAR(64),
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    response_code INTEGER,
    response_data JSONB,
    acknowledged_at TIMESTAMP,
    
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_regulations_jurisdiction ON regulations(jurisdiction_source, state_code);
CREATE INDEX idx_regulations_category ON regulations(category);
CREATE INDEX idx_regulations_topic ON regulations(topic);
CREATE INDEX idx_regulations_lovv ON regulations(lovv_level);
CREATE INDEX idx_regulations_item_id ON regulations(item_id);
CREATE INDEX idx_regulations_current ON regulations(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_regulations_name_search ON regulations USING gin(to_tsvector('english', name));
CREATE INDEX idx_regulations_country ON regulations(country_code);
CREATE INDEX idx_regulations_body ON regulations(regulatory_body);
CREATE INDEX idx_regulations_label ON regulations(jurisdiction_label);
CREATE INDEX idx_regulations_applicability ON regulations(applicability);
CREATE INDEX idx_regulations_reg_key ON regulations(reg_key);

CREATE INDEX idx_deadlines_regulation ON regulation_deadlines(regulation_id);
CREATE INDEX idx_deadlines_due_date ON regulation_deadlines(due_date);
CREATE INDEX idx_deadlines_is_passed ON regulation_deadlines(is_passed);

CREATE INDEX idx_reg_jurisdictions_state ON regulation_jurisdictions(state_code);
CREATE INDEX idx_reg_jurisdictions_country ON regulation_jurisdictions(country_code);
CREATE INDEX idx_reg_jurisdictions_reg ON regulation_jurisdictions(regulation_id);

CREATE INDEX idx_reg_relationships_source ON regulation_relationships(source_regulation_id);
CREATE INDEX idx_reg_relationships_target ON regulation_relationships(target_regulation_id);
CREATE INDEX idx_reg_relationships_type ON regulation_relationships(relationship_type);

CREATE INDEX idx_reg_tags_reg ON regulation_tags(regulation_id);
CREATE INDEX idx_reg_tags_tag ON regulation_tags(tag);
CREATE INDEX idx_reg_tags_type ON regulation_tags(tag_type);

CREATE INDEX idx_tasks_regulation ON regulation_tasks(regulation_id);
CREATE INDEX idx_tasks_deadline ON regulation_tasks(deadline_id);
CREATE INDEX idx_tasks_priority ON regulation_tasks(priority);

CREATE INDEX idx_audit_regulation ON regulation_audit_log(regulation_id);
CREATE INDEX idx_audit_action ON regulation_audit_log(action);
CREATE INDEX idx_audit_timestamp ON regulation_audit_log(performed_at);

CREATE INDEX idx_transmission_status ON transmission_log(status);
CREATE INDEX idx_transmission_date ON transmission_log(created_at);
CREATE INDEX idx_transmission_regulation ON transmission_log(regulation_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER regulations_updated_at
    BEFORE UPDATE ON regulations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER deadlines_updated_at
    BEFORE UPDATE ON regulation_deadlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON regulation_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-increment version and archive on content change
CREATE OR REPLACE FUNCTION increment_regulation_version()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.name, OLD.statute, OLD.summary, OLD.requirements, OLD.regulation_text) 
       IS DISTINCT FROM 
       (NEW.name, NEW.statute, NEW.summary, NEW.requirements, NEW.regulation_text) THEN
        
        -- Archive old version
        INSERT INTO regulation_versions (regulation_id, version, version_hash, content_snapshot, changed_by, change_source)
        VALUES (OLD.id, OLD.version, OLD.version_hash, to_jsonb(OLD), NEW.updated_by, 'content_update');
        
        -- Increment version
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER regulations_version_increment
    BEFORE UPDATE ON regulations
    FOR EACH ROW EXECUTE FUNCTION increment_regulation_version();

-- Auto-log all changes to audit table
CREATE OR REPLACE FUNCTION audit_regulation_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO regulation_audit_log (regulation_id, entity_type, entity_id, action, new_values, performed_by)
        VALUES (NEW.id, 'regulation', NEW.id, 'create', to_jsonb(NEW), COALESCE(NEW.created_by, 'system'));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO regulation_audit_log (regulation_id, entity_type, entity_id, action, previous_values, new_values, performed_by)
        VALUES (NEW.id, 'regulation', NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), COALESCE(NEW.updated_by, 'system'));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO regulation_audit_log (regulation_id, entity_type, entity_id, action, previous_values, performed_by)
        VALUES (OLD.id, 'regulation', OLD.id, 'delete', to_jsonb(OLD), 'system');
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER regulations_audit
    AFTER INSERT OR UPDATE OR DELETE ON regulations
    FOR EACH ROW EXECUTE FUNCTION audit_regulation_changes();

-- ============================================================
-- VERIFY SCHEMA
-- ============================================================
SELECT 'Schema created successfully!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
