-- Circuit Court Interpretations Schema Migration (Mar 2026)
-- Adds circuit_interpretations and circuit_splits tables,
-- and stateCode column to institution_configurations.

-- 1. Add state_code to institution_configurations (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institution_configurations' AND column_name = 'state_code'
  ) THEN
    ALTER TABLE institution_configurations ADD COLUMN state_code text;
  END IF;
END $$;

-- 2. Create circuit_interpretations table
CREATE TABLE IF NOT EXISTS circuit_interpretations (
  id serial PRIMARY KEY NOT NULL,
  regulation_id integer NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  circuit_number integer NOT NULL,
  case_name text NOT NULL,
  case_year integer,
  case_citation text,
  court_level text DEFAULT 'circuit' NOT NULL,
  interpretation_type text NOT NULL,
  summary text NOT NULL,
  compliance_implication text,
  affected_requirements jsonb,
  impact_severity text NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  is_circuit_split boolean DEFAULT false,
  split_id integer,
  source_url text,
  assessed_by text,
  confidence_score text,
  review_status text DEFAULT 'pending' NOT NULL,
  reviewed_by integer REFERENCES users(id),
  reviewed_at timestamp,
  review_notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 3. Create circuit_splits table
CREATE TABLE IF NOT EXISTS circuit_splits (
  id serial PRIMARY KEY NOT NULL,
  regulation_id integer NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  affected_circuits jsonb,
  scotus_petition_pending boolean DEFAULT false,
  scotus_cert_granted boolean DEFAULT false,
  scotus_case_info text,
  status text DEFAULT 'active' NOT NULL,
  resolved_by text,
  resolved_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS ci_regulation_idx ON circuit_interpretations(regulation_id);
CREATE INDEX IF NOT EXISTS ci_circuit_idx ON circuit_interpretations(circuit_number);
CREATE INDEX IF NOT EXISTS ci_status_idx ON circuit_interpretations(status);
CREATE INDEX IF NOT EXISTS ci_review_status_idx ON circuit_interpretations(review_status);
CREATE INDEX IF NOT EXISTS ci_reg_circuit_idx ON circuit_interpretations(regulation_id, circuit_number);
CREATE INDEX IF NOT EXISTS cs_regulation_idx ON circuit_splits(regulation_id);
CREATE INDEX IF NOT EXISTS cs_status_idx ON circuit_splits(status);
