-- ============================================================
-- MULTI-JURISDICTION REGULATION SCHEMA
-- Migration 005 - Support for state, international, accreditor,
-- and industry-association regulations with normalized data model
-- ============================================================
-- Purpose: Extend the regulations system to handle regulations
-- from all 50 US states, international bodies (GDPR),
-- accreditors (MSCHE), and industry associations.
-- Adds junction tables for multi-state, relationships, and tags.
-- ============================================================

BEGIN;

-- ============================================================
-- ALTER REGULATIONS TABLE — new jurisdiction columns
-- ============================================================
-- Note: jurisdiction_source, state_code, effective_date, agency_name
-- already exist. We add columns that are missing.

ALTER TABLE regulations
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(3) DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS regulatory_body VARCHAR(200),
  ADD COLUMN IF NOT EXISTS jurisdiction_label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS act_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS applicability VARCHAR(50) DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS reg_key VARCHAR(20);

COMMENT ON COLUMN regulations.country_code IS 'ISO 3166 alpha-3 country code. US for federal/state, GBR, EU for EU-wide, etc.';
COMMENT ON COLUMN regulations.regulatory_body IS 'Issuing authority. E.g. "Pennsylvania Dept of Education", "European Parliament", "MSCHE"';
COMMENT ON COLUMN regulations.jurisdiction_label IS 'Human-readable jurisdiction label for UI filtering. E.g. "Pennsylvania", "European Union"';
COMMENT ON COLUMN regulations.act_number IS 'Act or law number. E.g. "Act 55 of 2022", "Regulation (EU) 2016/679"';
COMMENT ON COLUMN regulations.applicability IS 'Institution types this regulation applies to: all, public, private, for-profit';
COMMENT ON COLUMN regulations.reg_key IS 'Canonical MCP regulation key. E.g. REG-001 through REG-251+';

-- Backfill regulatory_body from existing agency_name where populated
UPDATE regulations
SET regulatory_body = agency_name
WHERE regulatory_body IS NULL AND agency_name IS NOT NULL;

-- Backfill jurisdiction_label from state_code and jurisdiction_source
UPDATE regulations
SET jurisdiction_label = CASE
  WHEN jurisdiction_source = 'federal' THEN 'United States Federal'
  WHEN jurisdiction_source = 'state' AND state_code = 'PA' THEN 'Pennsylvania'
  WHEN jurisdiction_source = 'state' AND state_code = 'NJ' THEN 'New Jersey'
  WHEN jurisdiction_source = 'international' THEN 'International'
  ELSE jurisdiction_source
END
WHERE jurisdiction_label IS NULL;

-- Backfill country_code
UPDATE regulations
SET country_code = 'US'
WHERE country_code IS NULL;

-- ============================================================
-- REGULATION JURISDICTIONS — multi-state/multi-region support
-- ============================================================
-- A regulation can apply to multiple states or regions.
-- The main regulations.state_code column stays as a convenience
-- denorm for the common single-state case.

CREATE TABLE IF NOT EXISTS regulation_jurisdictions (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    state_code VARCHAR(2),
    country_code VARCHAR(3) DEFAULT 'US',
    region_code VARCHAR(20),
    applies_to VARCHAR(50) DEFAULT 'all',

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(regulation_id, state_code, country_code)
);

COMMENT ON TABLE regulation_jurisdictions IS 'Junction table for regulations that apply to multiple states/regions';
COMMENT ON COLUMN regulation_jurisdictions.state_code IS 'US state code (PA, NJ, CA). NULL for federal/international.';
COMMENT ON COLUMN regulation_jurisdictions.country_code IS 'ISO 3166 alpha-3. Defaults to US.';
COMMENT ON COLUMN regulation_jurisdictions.region_code IS 'Regional identifier: EU, northeast-compact, etc.';
COMMENT ON COLUMN regulation_jurisdictions.applies_to IS 'Institution type filter: all, public, private, for-profit';

-- Seed from existing state_code data
INSERT INTO regulation_jurisdictions (regulation_id, state_code, country_code)
SELECT id, state_code, COALESCE(country_code, 'US')
FROM regulations
WHERE state_code IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- REGULATION RELATIONSHIPS — implements, amends, extends, etc.
-- ============================================================
-- Tracks how regulations relate to each other. E.g.:
-- PA Act 55 of 2022 "extends" federal Title IX
-- PA Act 55 of 2022 "extends" federal VAWA

CREATE TABLE IF NOT EXISTS regulation_relationships (
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

COMMENT ON TABLE regulation_relationships IS 'Tracks relationships between regulations (implements, amends, extends, supersedes)';

-- ============================================================
-- REGULATION TAGS — multi-category/topic support
-- ============================================================
-- Replaces single category/topic with flexible multi-value tagging.
-- Existing category and topic columns stay for backward compat.

CREATE TABLE IF NOT EXISTS regulation_tags (
    id SERIAL PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    tag_type VARCHAR(50) NOT NULL DEFAULT 'category'
        CHECK (tag_type IN ('category', 'topic', 'keyword', 'agency', 'program')),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(regulation_id, tag, tag_type)
);

COMMENT ON TABLE regulation_tags IS 'Multi-value tags for regulations (categories, topics, keywords)';

-- Seed tags from existing category and topic columns
INSERT INTO regulation_tags (regulation_id, tag, tag_type)
SELECT id, category, 'category'
FROM regulations
WHERE category IS NOT NULL AND category != ''
ON CONFLICT DO NOTHING;

INSERT INTO regulation_tags (regulation_id, tag, tag_type)
SELECT id, topic, 'topic'
FROM regulations
WHERE topic IS NOT NULL AND topic != ''
ON CONFLICT DO NOTHING;

-- ============================================================
-- ALTER REGULATION DEADLINES — add structured fields
-- ============================================================
-- The regulation_deadlines table exists but needs a few additions
-- for the multi-jurisdiction system.

ALTER TABLE regulation_deadlines
  ADD COLUMN IF NOT EXISTS deadline_label VARCHAR(200),
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_passed BOOLEAN DEFAULT FALSE;

-- Backfill is_recurring from frequency
UPDATE regulation_deadlines
SET is_recurring = TRUE
WHERE frequency IS NOT NULL AND frequency != '' AND frequency != 'one-time';

-- Backfill is_passed from due_date
UPDATE regulation_deadlines
SET is_passed = (due_date < CURRENT_DATE)
WHERE due_date IS NOT NULL;

-- Backfill deadline_label from name
UPDATE regulation_deadlines
SET deadline_label = name
WHERE deadline_label IS NULL AND name IS NOT NULL;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_regulations_country ON regulations(country_code);
CREATE INDEX IF NOT EXISTS idx_regulations_body ON regulations(regulatory_body);
CREATE INDEX IF NOT EXISTS idx_regulations_label ON regulations(jurisdiction_label);
CREATE INDEX IF NOT EXISTS idx_regulations_applicability ON regulations(applicability);
CREATE INDEX IF NOT EXISTS idx_regulations_reg_key ON regulations(reg_key);

CREATE INDEX IF NOT EXISTS idx_reg_jurisdictions_state ON regulation_jurisdictions(state_code);
CREATE INDEX IF NOT EXISTS idx_reg_jurisdictions_country ON regulation_jurisdictions(country_code);
CREATE INDEX IF NOT EXISTS idx_reg_jurisdictions_reg ON regulation_jurisdictions(regulation_id);

CREATE INDEX IF NOT EXISTS idx_reg_relationships_source ON regulation_relationships(source_regulation_id);
CREATE INDEX IF NOT EXISTS idx_reg_relationships_target ON regulation_relationships(target_regulation_id);
CREATE INDEX IF NOT EXISTS idx_reg_relationships_type ON regulation_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_reg_tags_reg ON regulation_tags(regulation_id);
CREATE INDEX IF NOT EXISTS idx_reg_tags_tag ON regulation_tags(tag);
CREATE INDEX IF NOT EXISTS idx_reg_tags_type ON regulation_tags(tag_type);

CREATE INDEX IF NOT EXISTS idx_deadlines_is_passed ON regulation_deadlines(is_passed);

-- ============================================================
-- VIEWS — convenient jurisdiction queries
-- ============================================================

CREATE OR REPLACE VIEW regulations_with_jurisdiction AS
SELECT
    r.id,
    r.item_id,
    r.name,
    r.reg_key,
    r.jurisdiction_source,
    r.state_code,
    r.country_code,
    r.jurisdiction_label,
    r.regulatory_body,
    r.act_number,
    r.applicability,
    r.category,
    r.topic,
    r.statute,
    r.effective_date,
    r.is_current,
    COALESCE(
        array_agg(DISTINCT rj.state_code) FILTER (WHERE rj.state_code IS NOT NULL),
        ARRAY[]::varchar[]
    ) AS all_state_codes,
    COALESCE(
        array_agg(DISTINCT rt.tag) FILTER (WHERE rt.tag IS NOT NULL AND rt.tag_type = 'category'),
        ARRAY[]::varchar[]
    ) AS categories,
    COALESCE(
        array_agg(DISTINCT rt.tag) FILTER (WHERE rt.tag IS NOT NULL AND rt.tag_type = 'topic'),
        ARRAY[]::varchar[]
    ) AS topics,
    (SELECT COUNT(*) FROM regulation_deadlines rd WHERE rd.regulation_id = r.id) AS deadline_count,
    (SELECT COUNT(*) FROM regulation_deadlines rd WHERE rd.regulation_id = r.id AND rd.is_passed = TRUE) AS passed_deadline_count,
    (SELECT COUNT(*) FROM regulation_relationships rr WHERE rr.source_regulation_id = r.id OR rr.target_regulation_id = r.id) AS relationship_count
FROM regulations r
LEFT JOIN regulation_jurisdictions rj ON r.id = rj.regulation_id
LEFT JOIN regulation_tags rt ON r.id = rt.regulation_id
WHERE r.is_current = TRUE
GROUP BY r.id;

COMMENT ON VIEW regulations_with_jurisdiction IS 'Denormalized view joining regulations with jurisdiction, tags, and deadline counts';

-- ============================================================
-- HELPER FUNCTION: Find regulations by customer jurisdiction
-- ============================================================
CREATE OR REPLACE FUNCTION find_regulations_for_customer(
    p_country_code VARCHAR(3),
    p_state_codes VARCHAR(2)[],
    p_institution_type VARCHAR(50) DEFAULT 'all',
    p_include_federal BOOLEAN DEFAULT TRUE,
    p_include_international BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (regulation_id INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.id
    FROM regulations r
    LEFT JOIN regulation_jurisdictions rj ON r.id = rj.regulation_id
    WHERE r.is_current = TRUE
      AND (r.applicability = 'all' OR r.applicability = p_institution_type)
      AND (
          (p_include_federal AND r.jurisdiction_source = 'federal' AND r.country_code = p_country_code)
          OR (r.jurisdiction_source = 'state' AND rj.state_code = ANY(p_state_codes))
          OR (p_include_international AND r.jurisdiction_source = 'international')
          OR (r.jurisdiction_source IN ('accreditor', 'industry-association'))
      )
    ORDER BY r.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_regulations_for_customer IS 'Returns regulation IDs applicable to a customer based on their jurisdiction config';

-- ============================================================
-- VERIFY MIGRATION
-- ============================================================
SELECT 'Migration 005: Multi-jurisdiction schema created successfully!' AS status;

SELECT
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'regulations' AND column_name = 'country_code') AS has_country_code,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'regulation_jurisdictions') AS has_jurisdictions_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'regulation_relationships') AS has_relationships_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'regulation_tags') AS has_tags_table;

COMMIT;
