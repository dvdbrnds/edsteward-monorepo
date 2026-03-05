-- Regulatory Sources and Updates Migration

-- Create regulatory_sources table to track authoritative sources
CREATE TABLE regulatory_sources (
  id SERIAL PRIMARY KEY,
  source_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  authority VARCHAR(255) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  description TEXT,
  contact_info JSONB,
  refresh_interval INTEGER NOT NULL DEFAULT 86400, -- Default: daily in seconds
  collector_type VARCHAR(100) NOT NULL,
  collector_config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create source_updates table to track history of updates from sources
CREATE TABLE source_updates (
  id SERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES regulatory_sources(id),
  update_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fetch_status VARCHAR(50) NOT NULL,
  error_message TEXT,
  changes_detected BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary JSONB,
  raw_response JSONB,
  processed_regulations INTEGER,
  source_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create regulations table to store regulation definitions
CREATE TABLE regulations (
  id SERIAL PRIMARY KEY,
  regulation_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_id INTEGER NOT NULL REFERENCES regulatory_sources(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create regulation_versions table to track versions of regulations
CREATE TABLE regulation_versions (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  version VARCHAR(50) NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE,
  publish_date TIMESTAMP WITH TIME ZONE NOT NULL,
  document_number VARCHAR(100),
  content JSONB NOT NULL,
  source_url VARCHAR(500),
  source_update_id INTEGER REFERENCES source_updates(id),
  change_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(regulation_id, version)
);

-- Create requirements table to store individual regulatory requirements
CREATE TABLE requirements (
  id SERIAL PRIMARY KEY,
  requirement_id VARCHAR(100) NOT NULL UNIQUE,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  regulation_version_id INTEGER NOT NULL REFERENCES regulation_versions(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  requirement_type VARCHAR(50) NOT NULL,
  validation_rule JSONB, -- Stores patterns, semantic rules, or other validation criteria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_source_updates_source_id ON source_updates(source_id);
CREATE INDEX idx_source_updates_timestamp ON source_updates(update_timestamp);
CREATE INDEX idx_regulations_source_id ON regulations(source_id);
CREATE INDEX idx_regulation_versions_regulation_id ON regulation_versions(regulation_id);
CREATE INDEX idx_regulation_versions_effective_date ON regulation_versions(effective_date);
CREATE INDEX idx_requirements_regulation_id ON requirements(regulation_id);
CREATE INDEX idx_requirements_regulation_version_id ON requirements(regulation_version_id);

-- Insert initial source data
INSERT INTO regulatory_sources 
  (source_code, name, authority, base_url, description, collector_type, collector_config)
VALUES
  (
    'FEDERAL_REGISTER',
    'Federal Register',
    'Office of the Federal Register',
    'https://www.federalregister.gov/api/v1',
    'The Federal Register is the official journal of the federal government of the United States that contains government agency rules, proposed rules, and public notices.',
    'FederalRegisterCollector',
    '{"documentTypes": ["RULE", "NOTICE"], "refreshInterval": 86400}'
  ),
  (
    'ED_GOV',
    'Department of Education',
    'U.S. Department of Education',
    'https://www2.ed.gov',
    'The U.S. Department of Education is responsible for education policies and regulations.',
    'EdGovCollector',
    '{"refreshInterval": 86400}'
  ),
  (
    'ECFR_GOV',
    'Electronic Code of Federal Regulations',
    'Office of the Federal Register',
    'https://www.ecfr.gov',
    'The Electronic Code of Federal Regulations (eCFR) is the codification of the general and permanent rules published in the Federal Register by the executive departments and agencies of the federal government.',
    'ECFRCollector',
    '{"refreshInterval": 86400}'
  );

-- Create a view for convenient access to regulation data with source information
CREATE VIEW regulation_with_source AS
SELECT 
  r.regulation_id,
  r.name,
  r.description,
  rv.version,
  rv.effective_date,
  rv.publish_date,
  rv.content,
  rv.source_url,
  s.name AS source_name,
  s.authority AS source_authority,
  s.base_url AS source_base_url,
  su.update_timestamp AS last_source_update
FROM regulations r
JOIN regulatory_sources s ON r.source_id = s.id
JOIN regulation_versions rv ON r.id = rv.regulation_id
LEFT JOIN source_updates su ON rv.source_update_id = su.id;

-- Create a function to mark source update complete
CREATE OR REPLACE FUNCTION mark_source_update_complete(
  p_source_id INTEGER,
  p_fetch_status VARCHAR(50),
  p_changes_detected BOOLEAN,
  p_change_summary JSONB,
  p_processed_regulations INTEGER,
  p_source_metadata JSONB,
  p_error_message TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  new_update_id INTEGER;
BEGIN
  INSERT INTO source_updates 
    (source_id, fetch_status, changes_detected, change_summary, processed_regulations, source_metadata, error_message)
  VALUES 
    (p_source_id, p_fetch_status, p_changes_detected, p_change_summary, p_processed_regulations, p_source_metadata, p_error_message)
  RETURNING id INTO new_update_id;
  
  UPDATE regulatory_sources 
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = p_source_id;
  
  RETURN new_update_id;
END;
$$ LANGUAGE plpgsql; 