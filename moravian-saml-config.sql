-- Moravian University SAML Configuration
-- Generated: July 7, 2025
-- For tenant: moravian

-- Connect to EdSteward admin database first
-- \c edsteward_admin;

-- Update Moravian tenant with SAML configuration
UPDATE edsteward_admin.tenants 
SET saml_config = '{
  "entityId": "http://www.okta.com/exk1c4nmsctSaNRIg0x8",
  "ssoUrl": "https://login.moravian.edu/app/moravian_edstewardbeta_1/exk1c4nmsctSaNRIg0x8/sso/saml",
  "sloUrl": "https://login.moravian.edu/app/moravian_edstewardbeta_1/exk1c4nmsctSaNRIg0x8/slo/saml",
  "certificate": "-----BEGIN CERTIFICATE-----\nMIIDoDCCAoigAwIBAgIGAZfmcQJcMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEG\nA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEU\nMBIGA1UECwwLU1NPUHJvdmlkZXIxETAPBgNVBAMMCG1vcmF2aWFuMRwwGgYJKoZIhvcNAQkBFg1p\nbmZvQG9rdGEuY29tMB4XDTI1MDcwNzE5NDk1NVoXDTM1MDcwNzE5NTA1NVowgZAxCzAJBgNVBAYT\nAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYwFAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ0wCwYDVQQK\nDARPa3RhMRQwEgYDVQQLDAtTU09Qcm92aWRlcjERMA8GA1UEAwwIbW9yYXZpYW4xHDAaBgkqhkiG\n9w0BCQEWDWluZm9Ab2t0YS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDMje8G\nKNaccsCajH/7NMPNff/dN6p5D4cW9xuzjB5FRiMg09KWmVQ1TyYAbpiFHWIZeBftOIZ861GKOe9F\nHsieaLggHEN5Er851lof0EbeHeHx2JU6oXn7Y9UUlinbOSmmyt+99Ln8JaDQWqUGszO4MEVDFFVU\nO41oYecBdrkcPPQS7sI47pggm0F+3Z7o3BAbkSghAUKCWzlrgoa2QFwxmREv+1hVbJ+JRkxKnYtW\n9lwRJ/88eMGJkZVScrxFYjc7jqL24fHdxUW2yc9jrSIr2/bLRA865DFRD9axRSBRk1Vz/xe0B3Av\ndRS3VMPXLk3Yd5JrC0mgNY0ztA0+0aEnAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABZa7cwDIlDc\ndMK42alQm6NQEdrjoMTPj+RZL0wnp/suAof01m59uNzyiJl2mQYUtaCFCnd5IIqJBBXxRX0smSz4\nxALQAhi6cFCzTB1vcWkEHTIo/InaTCbz0ZdI8QuTZooWY8DYYeYaDeq+4gaGvn/dLpuNLf+3tjQk\n/dGrnk/CwuOQinLIIX7TuX5vtAEgmRvLCaJisenG9Yx33mWtoW1xLKyX9vL/gvEtCeGgYXhqEi1b\nXbqIyWREy7OEAIskczBsAXp9ldqC2H6qgbj5k+Nqf9rSI/aS8VyzSEAh4JS0+acuah9tBLIFcoTf\njjlkuxhB/k1CWKKt0BG1hqlZ5iY=\n-----END CERTIFICATE-----",
  "attributeMapping": {
    "email": "email",
    "firstName": "firstName",
    "lastName": "lastName",
    "department": "department",
    "groups": "groups"
  },
  "enhancedSecurity": true
}'
WHERE id = 'moravian';

-- Enable auto-provisioning for new users
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{enableAutoProvisioning}', 
  'true'::jsonb
)
WHERE id = 'moravian';

-- Set allowed domains for Moravian
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{allowedDomains}', 
  '["moravian.edu"]'::jsonb
)
WHERE id = 'moravian';

-- Configure role mapping for OKTA groups
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{roleMapping}', 
  '{
    "EdSteward-Admin": "admin",
    "EdSteward-ComplianceOfficer": "compliance_officer", 
    "EdSteward-User": "user"
  }'::jsonb
)
WHERE id = 'moravian';

-- Set default role for new users
UPDATE edsteward_admin.tenants 
SET settings = jsonb_set(
  settings, 
  '{defaultRole}', 
  '"user"'::jsonb
)
WHERE id = 'moravian';

-- Verify the configuration
SELECT 
  id,
  name,
  saml_config->'entityId' as entity_id,
  saml_config->'ssoUrl' as sso_url,
  saml_config->'enhancedSecurity' as enhanced_security,
  settings->'enableAutoProvisioning' as auto_provisioning,
  settings->'allowedDomains' as allowed_domains,
  settings->'defaultRole' as default_role
FROM edsteward_admin.tenants 
WHERE id = 'moravian'; 