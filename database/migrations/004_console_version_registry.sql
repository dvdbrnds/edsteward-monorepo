-- ============================================================
-- CONSOLE VERSION REGISTRY SCHEMA
-- Migration 004 - Console-level version control for gold standards
-- ============================================================
-- Purpose: Track versioned, immutable console artifacts
-- Once a regulation passes workflow and is certified "gold", 
-- the console becomes a sacrosanct compliance deliverable.
-- ============================================================

-- ============================================================
-- CONSOLE VERSIONS (Immutable artifacts)
-- ============================================================
CREATE TABLE IF NOT EXISTS console_versions (
    id SERIAL PRIMARY KEY,
    
    -- Identity (REG-KEY is canonical)
    reg_key VARCHAR(20) NOT NULL,              -- REG-001, REG-002, etc.
    version VARCHAR(20) NOT NULL,              -- v1.0, v1.1, v2.0
    
    -- Status lifecycle: draft → review → gold → superseded
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'review', 'gold', 'superseded', 'rejected')),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,  -- Only ONE active per reg_key
    
    -- Content integrity
    console_filename VARCHAR(255) NOT NULL,    -- Original filename
    console_html_path VARCHAR(500) NOT NULL,   -- Path to versioned HTML file
    content_hash VARCHAR(64) NOT NULL,         -- SHA-256 of console content
    content_size_bytes INTEGER,                -- File size for quick validation
    
    -- Workflow certification
    workflow_score INTEGER                     -- Overall audit score (0-100)
        CHECK (workflow_score IS NULL OR workflow_score BETWEEN 0 AND 100),
    content_score INTEGER,
    summary_score INTEGER,
    requirements_score INTEGER,
    deadlines_score INTEGER,
    tasks_score INTEGER,
    workflow_results JSONB,                    -- Full workflow output
    certainty_level CHAR(1)                    -- A, B, C, D
        CHECK (certainty_level IS NULL OR certainty_level IN ('A', 'B', 'C', 'D')),
    
    -- Task/deadline counts at time of certification
    task_count INTEGER DEFAULT 0,
    deadline_count INTEGER DEFAULT 0,
    
    -- Certification metadata
    certified_by VARCHAR(100),
    certified_at TIMESTAMP,
    certification_notes TEXT,
    
    -- Supersession tracking
    superseded_by INTEGER REFERENCES console_versions(id),
    superseded_at TIMESTAMP,
    supersession_reason TEXT,
    
    -- Rollback tracking
    rolled_back_from INTEGER REFERENCES console_versions(id),
    rollback_reason TEXT,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    
    -- Constraints
    UNIQUE(reg_key, version)
);

-- ============================================================
-- CONSOLE VERSION AUDIT LOG (Immutable - INSERT only)
-- ============================================================
CREATE TABLE IF NOT EXISTS console_version_audit (
    id SERIAL PRIMARY KEY,
    
    console_version_id INTEGER REFERENCES console_versions(id),
    reg_key VARCHAR(20) NOT NULL,
    version VARCHAR(20),
    
    action VARCHAR(50) NOT NULL,  -- created, certified, activated, deactivated, rolled_back, superseded
    
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    
    details JSONB,
    
    performed_by VARCHAR(100),
    performed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    notes TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_console_versions_reg_key 
    ON console_versions(reg_key);

CREATE INDEX IF NOT EXISTS idx_console_versions_active 
    ON console_versions(reg_key, is_active) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_console_versions_status 
    ON console_versions(status);

CREATE INDEX IF NOT EXISTS idx_console_versions_gold 
    ON console_versions(reg_key, status) 
    WHERE status = 'gold';

CREATE INDEX IF NOT EXISTS idx_console_audit_reg_key 
    ON console_version_audit(reg_key);

CREATE INDEX IF NOT EXISTS idx_console_audit_version_id 
    ON console_version_audit(console_version_id);

-- ============================================================
-- CONSTRAINT: Only one active version per reg_key
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_console_versions_one_active 
    ON console_versions(reg_key) 
    WHERE is_active = TRUE;

-- ============================================================
-- FUNCTION: Auto-audit console version changes
-- ============================================================
CREATE OR REPLACE FUNCTION audit_console_version_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO console_version_audit 
            (console_version_id, reg_key, version, action, new_status, performed_by, details)
        VALUES 
            (NEW.id, NEW.reg_key, NEW.version, 'created', NEW.status, NEW.created_by,
             jsonb_build_object('content_hash', NEW.content_hash, 'console_path', NEW.console_html_path));
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO console_version_audit 
                (console_version_id, reg_key, version, action, previous_status, new_status, performed_by)
            VALUES 
                (NEW.id, NEW.reg_key, NEW.version, 
                 CASE 
                     WHEN NEW.status = 'gold' THEN 'certified'
                     WHEN NEW.status = 'superseded' THEN 'superseded'
                     ELSE 'status_changed'
                 END,
                 OLD.status, NEW.status, COALESCE(NEW.certified_by, 'system'));
        END IF;
        
        -- Log activation changes
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            INSERT INTO console_version_audit 
                (console_version_id, reg_key, version, action, performed_by, 
                 details)
            VALUES 
                (NEW.id, NEW.reg_key, NEW.version,
                 CASE WHEN NEW.is_active THEN 'activated' ELSE 'deactivated' END,
                 COALESCE(NEW.certified_by, 'system'),
                 CASE WHEN NEW.rollback_reason IS NOT NULL 
                      THEN jsonb_build_object('rollback_reason', NEW.rollback_reason)
                      ELSE NULL 
                 END);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Auto-audit
-- ============================================================
DROP TRIGGER IF EXISTS console_versions_audit ON console_versions;
CREATE TRIGGER console_versions_audit
    AFTER INSERT OR UPDATE ON console_versions
    FOR EACH ROW EXECUTE FUNCTION audit_console_version_changes();

-- ============================================================
-- VIEW: Active gold standards (quick lookup)
-- ============================================================
CREATE OR REPLACE VIEW active_gold_consoles AS
SELECT 
    cv.reg_key,
    cv.version,
    cv.console_html_path,
    cv.content_hash,
    cv.workflow_score,
    cv.certainty_level,
    cv.task_count,
    cv.deadline_count,
    cv.certified_by,
    cv.certified_at,
    r.name as regulation_name
FROM console_versions cv
LEFT JOIN regulations r ON r.reg_key = cv.reg_key AND r.is_current = TRUE
WHERE cv.is_active = TRUE AND cv.status = 'gold'
ORDER BY cv.reg_key;

-- ============================================================
-- VERIFY MIGRATION
-- ============================================================
SELECT 'Console Version Registry schema created successfully!' as status;
