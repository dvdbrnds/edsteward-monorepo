-- Migration: Add role_assignments table for role-to-person mapping
-- Date: 2026-01-23
-- Purpose: Allow admins to assign default DRIs to suggested roles from MCP Engine

-- =====================================================
-- Create role_assignments table
-- =====================================================

CREATE TABLE IF NOT EXISTS role_assignments (
  id SERIAL PRIMARY KEY,
  
  -- The role name (from MCP Engine suggestions or custom)
  role_name TEXT NOT NULL UNIQUE,
  
  -- Display name for UI
  display_name TEXT,
  
  -- Default assignee for this role
  default_user_id INTEGER REFERENCES users(id),
  
  -- For external assignees (not in system)
  default_email TEXT,
  default_name TEXT,
  
  -- Backup/escalation contact
  backup_user_id INTEGER REFERENCES users(id),
  backup_email TEXT,
  
  -- Category for grouping in UI
  category TEXT,
  
  -- Description of this role's responsibilities
  description TEXT,
  
  -- Whether auto-assignment is enabled
  auto_assign_enabled BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS role_assignments_role_name_idx ON role_assignments(role_name);
CREATE INDEX IF NOT EXISTS role_assignments_category_idx ON role_assignments(category);

-- =====================================================
-- Insert common default roles (can be customized)
-- =====================================================

INSERT INTO role_assignments (role_name, display_name, category, description, auto_assign_enabled) VALUES
  ('Registrar', 'Office of the Registrar', 'Academic', 'Manages student records, enrollment, and academic documentation including FERPA compliance', true),
  ('Title IX Coordinator', 'Title IX Office', 'Civil Rights', 'Oversees Title IX compliance, investigations, and training', true),
  ('Campus Police Chief', 'Department of Public Safety', 'Safety', 'Leads campus security operations and Clery Act compliance', true),
  ('Dean of Students', 'Dean of Students Office', 'Student Affairs', 'Oversees student conduct, housing, and student life policies', true),
  ('HR Director', 'Human Resources', 'HR', 'Manages employment policies, benefits, and workplace compliance', true),
  ('Financial Aid Director', 'Financial Aid Office', 'Financial', 'Administers student financial aid and related compliance', true),
  ('VP Academic Affairs', 'Academic Affairs', 'Academic', 'Senior leadership for academic programs and faculty', true),
  ('VP Student Affairs', 'Student Affairs', 'Student Affairs', 'Senior leadership for student services and campus life', true),
  ('IT Security Officer', 'Information Technology', 'Technology', 'Manages cybersecurity and data protection compliance', true),
  ('Legal Counsel', 'Office of General Counsel', 'Legal', 'Provides legal guidance and regulatory interpretation', true),
  ('Disability Services', 'Office of Disability Services', 'Student Affairs', 'Coordinates ADA compliance and student accommodations', true),
  ('Athletic Director', 'Athletics', 'Athletics', 'Oversees athletic programs and NCAA compliance', true)
ON CONFLICT (role_name) DO NOTHING;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE role_assignments IS 
'Maps suggested roles (from MCP Engine) to default assignees for automatic task assignment';

COMMENT ON COLUMN role_assignments.role_name IS 
'The role identifier - must match MCP Engine assignedRole values for auto-assignment to work';

COMMENT ON COLUMN role_assignments.default_user_id IS 
'Primary person assigned to this role (if they exist in users table)';

COMMENT ON COLUMN role_assignments.default_email IS 
'Email for external assignees not in the users table (e.g., external consultants)';

COMMENT ON COLUMN role_assignments.auto_assign_enabled IS 
'When true, tasks with this assignedRole will automatically get the default assignee';
