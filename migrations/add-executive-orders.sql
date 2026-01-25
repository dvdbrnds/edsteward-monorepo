-- Executive Orders Integration
-- Tracks Presidential Executive Orders and their impact on federal regulations
-- MCP Engine Integration - January 2026

-- Table: executive_orders
-- Stores Executive Order details from Federal Register
CREATE TABLE IF NOT EXISTS executive_orders (
  id SERIAL PRIMARY KEY,
  eo_number VARCHAR(20) NOT NULL UNIQUE,        -- e.g., "EO 14322"
  title VARCHAR(500) NOT NULL,
  signed_date DATE NOT NULL,
  published_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, enjoined, revoked, superseded
  president VARCHAR(100),                        -- e.g., "Donald Trump"
  term VARCHAR(20),                              -- e.g., "Trump-2", "Biden-1"
  summary TEXT,                                  -- Federal Register abstract
  full_text_url VARCHAR(500),                   -- Link to Federal Register
  pdf_url VARCHAR(500),
  federal_register_citation VARCHAR(100),       -- e.g., "90 FR 12345"
  topics TEXT[],                                 -- Array of keywords
  -- Court actions
  enjoined_date DATE,
  enjoined_by VARCHAR(255),                     -- Court that issued injunction
  revoked_date DATE,
  revoked_by VARCHAR(20),                       -- EO number that revoked this
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eo_status ON executive_orders(status);
CREATE INDEX IF NOT EXISTS idx_eo_signed_date ON executive_orders(signed_date DESC);
CREATE INDEX IF NOT EXISTS idx_eo_president ON executive_orders(president);

-- Table: eo_regulation_impacts
-- Links Executive Orders to regulations with impact analysis
CREATE TABLE IF NOT EXISTS eo_regulation_impacts (
  id SERIAL PRIMARY KEY,
  eo_id INTEGER NOT NULL REFERENCES executive_orders(id) ON DELETE CASCADE,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  
  -- Impact classification
  impact_type VARCHAR(20) NOT NULL,             -- modifies, reinforces, conflicts, supersedes
  impact_severity VARCHAR(20) NOT NULL,         -- critical, high, medium, low
  impact_summary TEXT,                          -- AI-generated analysis (from MCP Engine)
  
  -- Assessment metadata
  assessed_by VARCHAR(100),                     -- "MCP Engine AI" or "Manual Review"
  assessment_date DATE,
  confidence_score DECIMAL(3,2),                -- 0.00-1.00
  
  -- Review tracking (for CCO workflow)
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  review_notes TEXT,
  review_status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, addressed, dismissed
  
  -- Auto-generated task reference
  generated_task_id INTEGER REFERENCES compliance_tasks(id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(eo_id, regulation_id)
);

CREATE INDEX IF NOT EXISTS idx_eori_regulation ON eo_regulation_impacts(regulation_id);
CREATE INDEX IF NOT EXISTS idx_eori_severity ON eo_regulation_impacts(impact_severity);
CREATE INDEX IF NOT EXISTS idx_eori_review_status ON eo_regulation_impacts(review_status);

-- Table: eo_status_history
-- Tracks status changes for Executive Orders (court actions, revocations)
CREATE TABLE IF NOT EXISTS eo_status_history (
  id SERIAL PRIMARY KEY,
  eo_id INTEGER NOT NULL REFERENCES executive_orders(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  change_date DATE NOT NULL,
  change_reason TEXT,                           -- e.g., "Enjoined by 5th Circuit Court"
  source_url VARCHAR(500),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eo_history_eo ON eo_status_history(eo_id);
CREATE INDEX IF NOT EXISTS idx_eo_history_date ON eo_status_history(change_date DESC);

-- Add comment for documentation
COMMENT ON TABLE executive_orders IS 'Presidential Executive Orders from Federal Register - MCP Engine Integration';
COMMENT ON TABLE eo_regulation_impacts IS 'Links EOs to regulations with AI-analyzed impact assessment';
COMMENT ON TABLE eo_status_history IS 'Tracks court actions and status changes for EOs';
