/**
 * Tenant Provisioning Service
 * Handles the complete tenant creation workflow:
 * 1. Create Neon database
 * 2. Clone schema and data from template
 * 3. Create initial admin user
 * 4. Configure branding
 * 5. Register tenant in admin database
 * 6. Update ECS task definition with new database URL
 * 7. Deploy updated task
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { execSync } from 'child_process';

// Configuration
const NEON_API_KEY = process.env.NEON_API_KEY;
const NEON_ORG_ID = process.env.NEON_ORG_ID || 'org-young-mouse-05097443';
const TEMPLATE_DATABASE_URL = process.env.TEMPLATE_DATABASE_URL;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const ECS_CLUSTER = process.env.ECS_CLUSTER || 'edsteward-cluster';
const ECS_SERVICE = process.env.ECS_SERVICE || 'edsteward-service';
const ECS_TASK_FAMILY = process.env.ECS_TASK_FAMILY || 'edsteward-saml-production';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://moravian.edsteward.ai';
const REGISTRY_API_SECRET = process.env.REGISTRY_API_SECRET;

function registryHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (REGISTRY_API_SECRET) {
    headers['x-registry-secret'] = REGISTRY_API_SECRET;
  }
  return headers;
}

// Interfaces
export interface TenantProvisioningRequest {
  name: string;
  subdomain: string;
  contactEmail?: string;
  contactName?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  adminUser: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
  };
  institution?: {
    primaryType?: string;
    characteristics?: string[];
    stateCode?: string;
  };
}

export interface ProvisioningStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  data?: any;
}

export interface ProvisioningResult {
  success: boolean;
  tenantId: string;
  subdomain: string;
  steps: ProvisioningStep[];
  error?: string;
}

// ===== STEP 1: CREATE NEON DATABASE =====

export async function createNeonDatabase(subdomain: string): Promise<{
  projectId: string;
  connectionUri: string;
  password: string;
}> {
  if (!NEON_API_KEY) {
    throw new Error('NEON_API_KEY not configured');
  }

  const projectName = `edsteward-${subdomain}`;
  
  console.log(`📦 Creating Neon project: ${projectName}`);

  const response = await fetch('https://console.neon.tech/api/v2/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NEON_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project: {
        name: projectName,
        region_id: 'aws-us-east-2',
        org_id: NEON_ORG_ID,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create Neon project: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  return {
    projectId: data.project.id,
    connectionUri: data.connection_uris[0].connection_uri,
    password: data.roles[0].password,
  };
}

// ===== STEP 2: CLONE SCHEMA FROM TEMPLATE =====

export async function cloneSchemaFromTemplate(targetDatabaseUrl: string): Promise<void> {
  if (!TEMPLATE_DATABASE_URL) {
    throw new Error('TEMPLATE_DATABASE_URL not configured');
  }

  console.log('📋 Cloning schema from template via pg_dump...');

  try {
    // pg_dump --schema-only captures everything: tables, indexes, constraints,
    // sequences, foreign keys, and defaults — unlike the old manual approach
    // which missed most of those.
    const output = execSync(
      `pg_dump "${TEMPLATE_DATABASE_URL}" --schema-only --no-owner --no-privileges --no-comments | psql "${targetDatabaseUrl}"`,
      { encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log('✅ Schema cloned successfully via pg_dump');
  } catch (error: any) {
    // pg_dump/psql not available — fall back to a simpler SQL-level clone
    console.warn('⚠️ pg_dump not available, falling back to SQL-level schema clone:', error.message);
    await cloneSchemaViaSQL(targetDatabaseUrl);
  }
}

async function cloneSchemaViaSQL(targetDatabaseUrl: string): Promise<void> {
  const templatePool = new Pool({
    connectionString: TEMPLATE_DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });

  const targetPool = new Pool({
    connectionString: targetDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Get the full DDL from pg_dump format via SQL (pg_get_tabledef equivalent)
    const tablesResult = await templatePool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`Found ${tables.length} tables to clone via SQL fallback`);

    const client = await targetPool.connect();
    try {
      await client.query('BEGIN');

      for (const table of tables) {
        // Use CREATE TABLE ... (LIKE template INCLUDING ALL) pattern via raw DDL
        const ddlResult = await templatePool.query(`
          SELECT 'CREATE TABLE IF NOT EXISTS "' || $1 || '" (' ||
            string_agg(
              '"' || column_name || '" ' ||
              CASE
                WHEN data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(character_maximum_length::text, '255') || ')'
                WHEN data_type = 'ARRAY' THEN 'TEXT[]'
                WHEN column_default LIKE 'nextval%' THEN 'SERIAL'
                ELSE UPPER(data_type)
              END ||
              CASE WHEN is_nullable = 'NO' AND column_default NOT LIKE 'nextval%' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN column_default IS NOT NULL AND column_default NOT LIKE 'nextval%' THEN ' DEFAULT ' || column_default ELSE '' END,
              ', ' ORDER BY ordinal_position
            ) || ')' as ddl
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
        `, [table]);

        if (ddlResult.rows[0]?.ddl) {
          await client.query(ddlResult.rows[0].ddl);
          console.log(`  ✓ Created table: ${table}`);
        }
      }

      // Add primary keys
      const pkResult = await templatePool.query(`
        SELECT tc.table_name, string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as pk_cols
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
        GROUP BY tc.table_name, tc.constraint_name
      `);
      for (const pk of pkResult.rows) {
        try {
          await client.query(`ALTER TABLE "${pk.table_name}" ADD PRIMARY KEY (${pk.pk_cols.split(', ').map((c: string) => `"${c}"`).join(', ')})`);
        } catch { /* PK may already exist from SERIAL */ }
      }

      await client.query('COMMIT');
      console.log('✅ Schema cloned via SQL fallback');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await templatePool.end();
    await targetPool.end();
  }
}

// ===== STEP 3: COPY DATA FROM TEMPLATE =====

export async function copyDataFromTemplate(targetDatabaseUrl: string): Promise<{
  regulationsCount: number;
  tasksCount: number;
}> {
  if (!TEMPLATE_DATABASE_URL) {
    throw new Error('TEMPLATE_DATABASE_URL not configured');
  }

  console.log('📊 Copying data from template...');

  const templatePool = new Pool({
    connectionString: TEMPLATE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const targetPool = new Pool({
    connectionString: targetDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  // Helper to properly serialize values for PostgreSQL (handles JSON/JSONB columns)
  const serializeValue = (value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && !(value instanceof Date)) {
      return JSON.stringify(value);  // Stringify objects/arrays for JSON columns
    }
    return value;
  };

  try {
    // Copy regulations
    const regsResult = await templatePool.query('SELECT * FROM regulations');
    console.log(`  Found ${regsResult.rows.length} regulations to copy`);

    if (regsResult.rows.length > 0) {
      const columns = Object.keys(regsResult.rows[0]);
      
      for (const row of regsResult.rows) {
        const values = columns.map(col => serializeValue(row[col]));
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnList = columns.map(c => `"${c}"`).join(', ');
        
        await targetPool.query(
          `INSERT INTO regulations (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }
      
      // Reset sequence
      await targetPool.query(`SELECT setval('regulations_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM regulations), false)`);
    }

    // Copy compliance_tasks
    const tasksResult = await templatePool.query('SELECT * FROM compliance_tasks');
    console.log(`  Found ${tasksResult.rows.length} compliance tasks to copy`);

    if (tasksResult.rows.length > 0) {
      const columns = Object.keys(tasksResult.rows[0]);
      
      for (const row of tasksResult.rows) {
        const values = columns.map(col => serializeValue(row[col]));
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnList = columns.map(c => `"${c}"`).join(', ');
        
        await targetPool.query(
          `INSERT INTO compliance_tasks (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }
      
      // Reset sequence
      await targetPool.query(`SELECT setval('compliance_tasks_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM compliance_tasks), false)`);
    }

    // CRITICAL: Clean up ALL tenant-specific data - new tenants should start completely fresh!
    // Reset ALL actions to clean defaults - no inherited required flags or completion data
    console.log('  🧹 Resetting all actions to clean defaults for fresh tenant...');
    await targetPool.query(`
      UPDATE regulations 
      SET actions = '[
        {"type": "attestation", "status": "pending", "enabled": true, "required": false},
        {"type": "website_publish", "status": "pending", "enabled": true, "required": false},
        {"type": "community_communication", "status": "pending", "enabled": true, "required": false},
        {"type": "agency_submission", "status": "pending", "enabled": true, "required": false}
      ]'::jsonb
      WHERE actions IS NOT NULL
    `);
    
    // Clear any compliance task status/assignments
    await targetPool.query(`
      UPDATE compliance_tasks 
      SET status = 'pending',
          completed_at = NULL,
          completed_by = NULL,
          assigned_to = NULL
      WHERE status != 'pending' OR completed_at IS NOT NULL
    `);

    // Clear ALL tenant-specific operational data - new tenants start completely fresh
    console.log('  🧹 Clearing pending updates, notifications, and other operational data...');
    await targetPool.query(`DELETE FROM regulation_updates`);
    await targetPool.query(`DELETE FROM version_conflicts`);
    await targetPool.query(`DELETE FROM notification_queue`);
    await targetPool.query(`DELETE FROM notifications`);
    await targetPool.query(`DELETE FROM attestation_tokens`);
    await targetPool.query(`DELETE FROM task_evidence`);
    await targetPool.query(`DELETE FROM task_activity`);
    await targetPool.query(`DELETE FROM evidence_files`);
    await targetPool.query(`DELETE FROM notes`);
    await targetPool.query(`DELETE FROM deadlines`);

    console.log('✅ Data copied and cleaned successfully');

    return {
      regulationsCount: regsResult.rows.length,
      tasksCount: tasksResult.rows.length,
    };
  } finally {
    await templatePool.end();
    await targetPool.end();
  }
}

// ===== STEP 4: CREATE ADMIN USER =====

export async function createAdminUser(
  databaseUrl: string,
  user: TenantProvisioningRequest['adminUser']
): Promise<{ userId: number }> {
  console.log(`👤 Creating admin user: ${user.username}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Hash password using scrypt (same format as main app)
    // IMPORTANT: Main app uses Buffer.from(salt, 'hex') so we must do the same
    const saltBuffer = crypto.randomBytes(16);
    const salt = saltBuffer.toString('hex');
    const hash = crypto.scryptSync(user.password, saltBuffer, 32).toString('hex');
    const passwordHash = `${salt}:${hash}`;

    const result = await pool.query(`
      INSERT INTO users (username, email, password, role, "firstName", "lastName", department, created_at)
      VALUES ($1, $2, $3, 'admin', $4, $5, 'Administration', NOW())
      RETURNING id
    `, [user.username, user.email, passwordHash, user.firstName, user.lastName]);

    console.log('✅ Admin user created');
    return { userId: result.rows[0].id };
  } finally {
    await pool.end();
  }
}

// ===== STEP 5: CONFIGURE BRANDING =====

// Helper to darken a color
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Helper to lighten a color
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export async function configureBranding(
  databaseUrl: string,
  tenantId: string,
  branding: TenantProvisioningRequest['branding'],
  institutionName?: string
): Promise<void> {
  console.log('🎨 Configuring branding...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const primaryColor = branding?.primaryColor || '#3d1a5a';
    
    // Build complete branding config with all derived colors
    const configData = {
      tenantId,
      institutionName: institutionName || tenantId,
      title: `${institutionName || tenantId} Compliance Portal`,
      primaryColor: primaryColor,
      secondaryColor: darkenColor(primaryColor, 0.2),
      accentColor: lightenColor(primaryColor, 0.3),
      logoUrl: branding?.logoUrl || '/assets/es-white-on-purple-logo.png', // Generic EdSteward logo as default
      faviconUrl: '/favicon.ico',
      loginScreenBackgroundColor: '#f8fafc',
      loginScreenAccentColor: primaryColor,
      loginScreenTextColor: '#1f2937',
      loginScreenHeroColor: darkenColor(primaryColor, 0.3),
    };

    // Check if a row already exists (single-tenant mode typically has 1 row)
    const existing = await pool.query('SELECT id FROM branding_configurations LIMIT 1');
    
    if (existing.rows.length > 0) {
      // Update existing row
      await pool.query(
        'UPDATE branding_configurations SET config_data = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(configData), existing.rows[0].id]
      );
    } else {
      // Insert new row
      await pool.query(
        'INSERT INTO branding_configurations (config_data, created_at, updated_at) VALUES ($1, NOW(), NOW())',
        [JSON.stringify(configData)]
      );
    }

    console.log('✅ Branding configured:', configData);
  } finally {
    await pool.end();
  }
}

// ===== STEP 5b: CONFIGURE INSTITUTION =====

export async function configureInstitution(
  databaseUrl: string,
  tenantId: string,
  institution?: TenantProvisioningRequest['institution']
): Promise<void> {
  if (!institution?.primaryType && !institution?.stateCode) {
    console.log('⏭️  No institution config provided, skipping');
    return;
  }

  console.log('🏛️  Configuring institution settings...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const existing = await pool.query(
      'SELECT id FROM institution_configurations WHERE tenant_id = $1',
      [tenantId]
    );

    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE institution_configurations
        SET primary_type = $1, characteristics = $2, state_code = $3, updated_at = NOW()
        WHERE tenant_id = $4
      `, [
        institution.primaryType || null,
        JSON.stringify(institution.characteristics || []),
        institution.stateCode || null,
        tenantId,
      ]);
    } else {
      await pool.query(`
        INSERT INTO institution_configurations (tenant_id, primary_type, characteristics, state_code, hide_non_applicable, allow_users_to_toggle, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, true, NOW(), NOW())
      `, [
        tenantId,
        institution.primaryType || null,
        JSON.stringify(institution.characteristics || []),
        institution.stateCode || null,
      ]);
    }

    console.log('✅ Institution configured:', { primaryType: institution.primaryType, stateCode: institution.stateCode });
  } finally {
    await pool.end();
  }
}

// ===== STEP 6: ADD TENANT RECORD =====

export async function addTenantToOwnDatabase(
  databaseUrl: string,
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    contactEmail?: string;
  }
): Promise<void> {
  console.log('📝 Adding tenant record to database...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(`
      INSERT INTO tenants (id, name, subdomain, status, database_url, contact_email, plan, deployment_type, health_check_url)
      VALUES ($1, $2, $3, 'active', $4, $5, 'professional', 'cloud', $6)
      ON CONFLICT (id) DO UPDATE SET status = 'active'
    `, [
      tenant.id,
      tenant.name,
      tenant.subdomain,
      databaseUrl,
      tenant.contactEmail || null,  // Allow null contact email
      `https://${tenant.subdomain}.edsteward.ai/api/health`
    ]);

    console.log('✅ Tenant record added');
  } finally {
    await pool.end();
  }
}

// ===== MAIN PROVISIONING FUNCTION =====

export async function provisionTenant(
  request: TenantProvisioningRequest,
  adminPool: Pool // Connection to admin database
): Promise<ProvisioningResult> {
  const steps: ProvisioningStep[] = [
    { step: 1, name: 'Create Neon Database', status: 'pending' },
    { step: 2, name: 'Clone Schema', status: 'pending' },
    { step: 3, name: 'Copy Regulations & Tasks', status: 'pending' },
    { step: 4, name: 'Create Admin User', status: 'pending' },
    { step: 5, name: 'Configure Branding & Institution', status: 'pending' },
    { step: 6, name: 'Register Tenant', status: 'pending' },
    { step: 7, name: 'Finalize', status: 'pending' },
  ];

  const tenantId = request.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  let databaseUrl = '';
  let neonProjectId = '';

  const updateStep = (stepNum: number, status: ProvisioningStep['status'], message?: string, data?: any) => {
    const step = steps.find(s => s.step === stepNum);
    if (step) {
      step.status = status;
      step.message = message;
      step.data = data;
    }
  };

  try {
    // Step 1: Create Neon Database
    updateStep(1, 'in_progress', 'Creating Neon database...');
    const neonResult = await createNeonDatabase(request.subdomain);
    databaseUrl = neonResult.connectionUri;
    neonProjectId = neonResult.projectId;
    updateStep(1, 'completed', 'Database created', { projectId: neonProjectId });

    // Step 2: Clone Schema
    updateStep(2, 'in_progress', 'Cloning schema from template...');
    await cloneSchemaFromTemplate(databaseUrl);
    updateStep(2, 'completed', 'Schema cloned');

    // Step 3: Copy Data
    updateStep(3, 'in_progress', 'Copying regulations and tasks...');
    const copyResult = await copyDataFromTemplate(databaseUrl);
    updateStep(3, 'completed', `Copied ${copyResult.regulationsCount} regulations, ${copyResult.tasksCount} tasks`, copyResult);

    // Step 4: Create Admin User
    updateStep(4, 'in_progress', 'Creating admin user...');
    const userResult = await createAdminUser(databaseUrl, request.adminUser);
    updateStep(4, 'completed', `Admin user created (ID: ${userResult.userId})`, userResult);

    // Step 5: Configure Branding & Institution
    updateStep(5, 'in_progress', 'Configuring branding and institution...');
    await configureBranding(databaseUrl, tenantId, request.branding, request.name);
    await configureInstitution(databaseUrl, tenantId, request.institution);
    updateStep(5, 'completed', 'Branding and institution configured');

    // Step 6: Register Tenant in Admin Database
    updateStep(6, 'in_progress', 'Registering tenant...');
    
    // Add to admin database
    await adminPool.query(`
      INSERT INTO tenants (
        id, name, subdomain, status, database_url, contact_email, contact_name,
        plan, deployment_type, health_check_url, max_users, max_regulations
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, 'cloud', $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        database_url = EXCLUDED.database_url,
        status = 'pending'
    `, [
      tenantId,
      request.name,
      request.subdomain,
      databaseUrl,
      request.contactEmail || null,  // Allow null contact email
      request.contactName || null,
      request.plan,
      `https://${request.subdomain}.edsteward.ai/api/health`,
      request.plan === 'enterprise' ? 999 : request.plan === 'professional' ? 100 : 10,
      request.plan === 'enterprise' ? 9999 : request.plan === 'professional' ? 1000 : 100,
    ]);

    // Add to tenant's own database
    await addTenantToOwnDatabase(databaseUrl, {
      id: tenantId,
      name: request.name,
      subdomain: request.subdomain,
      contactEmail: request.contactEmail || undefined,
    });
    
    updateStep(6, 'completed', 'Tenant registered');

    // Step 7: Update ECS and Finalize
    updateStep(7, 'in_progress', 'Updating ECS configuration...');
    
    // Update ECS task definition with new database URL
    try {
      const ecsResult = await updateAndDeployEcs(request.subdomain, databaseUrl);
      if (ecsResult.success) {
        console.log('✅ ECS task definition updated and deployment started');
      } else {
        console.warn('⚠️ ECS update failed (non-critical):', ecsResult.message);
      }
    } catch (ecsError) {
      console.warn('⚠️ Could not update ECS (non-critical):', ecsError);
    }
    
    // Update tenant status to active
    await adminPool.query(
      'UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2',
      ['active', tenantId]
    );

    // Refresh the main application's tenant registry
    try {
      const refreshResponse = await fetch(`${APP_BASE_URL}/api/admin/tenant-registry/refresh`, {
        method: 'POST',
        headers: registryHeaders(),
      });
      
      if (refreshResponse.ok) {
        console.log('✅ Main app tenant registry refreshed');
      } else {
        console.warn('⚠️ Failed to refresh main app tenant registry (non-critical)');
      }
    } catch (refreshError) {
      console.warn('⚠️ Could not reach main app to refresh tenant registry:', refreshError);
    }

    updateStep(7, 'completed', 'Tenant provisioning complete!');

    console.log(`\n✅ Tenant ${request.name} (${request.subdomain}) provisioned successfully!`);
    console.log(`   URL: https://${request.subdomain}.edsteward.ai`);
    console.log(`   Database: ${neonProjectId}`);

    return {
      success: true,
      tenantId,
      subdomain: request.subdomain,
      steps,
    };

  } catch (error: any) {
    console.error('❌ Provisioning failed:', error);

    // Mark current step as failed
    const failedStep = steps.find(s => s.status === 'in_progress');
    if (failedStep) {
      failedStep.status = 'failed';
      failedStep.message = error.message;
    }

    return {
      success: false,
      tenantId,
      subdomain: request.subdomain,
      steps,
      error: error.message,
    };
  }
}

// ===== TEST CONNECTION =====

export async function testDatabaseConnection(databaseUrl: string): Promise<{
  success: boolean;
  message: string;
  tables?: number;
}> {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query('SELECT COUNT(*) FROM pg_tables WHERE schemaname = $1', ['public']);
    const tableCount = parseInt(result.rows[0].count);
    
    return {
      success: true,
      message: `Connected successfully. Found ${tableCount} tables.`,
      tables: tableCount,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  } finally {
    await pool.end();
  }
}

// ===== STEP 7: UPDATE ECS TASK DEFINITION =====

/**
 * Get AWS credentials - tries environment variables first, then ECS task role
 */
async function getAwsCredentials(): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}> {
  // Try environment variables first
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    };
  }

  // Try ECS task role credentials (from metadata service)
  const ecsMetadataUri = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  if (ecsMetadataUri) {
    try {
      const response = await fetch(`http://169.254.170.2${ecsMetadataUri}`);
      if (response.ok) {
        const creds = await response.json();
        return {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.Token,
        };
      }
    } catch (error) {
      console.warn('Failed to get ECS task role credentials:', error);
    }
  }

  throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or use ECS task role.');
}

/**
 * AWS API helper - makes signed requests to AWS services
 */
async function makeAwsRequest(
  service: string,
  action: string,
  body: any,
  region: string = AWS_REGION
): Promise<any> {
  const credentials = await getAwsCredentials();

  const host = `${service}.${region}.amazonaws.com`;
  const endpoint = `https://${host}`;
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.substring(0, 8);
  
  const bodyString = JSON.stringify(body);
  
  // Create canonical request
  const method = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  
  // Hash the body
  const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  
  // Build headers list (with optional session token)
  let canonicalHeaders = 
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-date:${timestamp}\n`;
  
  let signedHeaders = 'content-type;host;x-amz-date';
  
  if (credentials.sessionToken) {
    canonicalHeaders += `x-amz-security-token:${credentials.sessionToken}\n`;
    signedHeaders += ';x-amz-security-token';
  }
  
  canonicalHeaders += `x-amz-target:AmazonEC2ContainerServiceV20141113.${action}\n`;
  signedHeaders += ';x-amz-target';
  
  const canonicalRequest = 
    `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;
  
  // Calculate signature
  const kDate = crypto.createHmac('sha256', `AWS4${credentials.secretAccessKey}`).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  // Create authorization header
  const authorizationHeader = 
    `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  // Build request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-amz-json-1.1',
    'X-Amz-Date': timestamp,
    'X-Amz-Target': `AmazonEC2ContainerServiceV20141113.${action}`,
    'Authorization': authorizationHeader,
  };
  
  if (credentials.sessionToken) {
    headers['X-Amz-Security-Token'] = credentials.sessionToken;
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: bodyString,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AWS ${action} failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get the current ECS task definition
 */
export async function getEcsTaskDefinition(): Promise<any> {
  console.log(`📋 Getting current ECS task definition: ${ECS_TASK_FAMILY}`);
  
  const result = await makeAwsRequest('ecs', 'DescribeTaskDefinition', {
    taskDefinition: ECS_TASK_FAMILY,
  });
  
  return result.taskDefinition;
}

/**
 * Update ECS task definition with new environment variable
 */
export async function updateEcsTaskDefinition(
  subdomain: string,
  databaseUrl: string
): Promise<{
  success: boolean;
  taskDefinitionArn?: string;
  revision?: number;
  message: string;
}> {
  console.log(`🔧 Updating ECS task definition with ${subdomain.toUpperCase()}_DATABASE_URL`);

  try {
    // Get current task definition
    const currentTaskDef = await getEcsTaskDefinition();
    
    // Extract only the fields needed for registration (remove AWS-added fields)
    const newTaskDef: any = {
      family: currentTaskDef.family,
      networkMode: currentTaskDef.networkMode,
      requiresCompatibilities: currentTaskDef.requiresCompatibilities,
      cpu: currentTaskDef.cpu,
      memory: currentTaskDef.memory,
      executionRoleArn: currentTaskDef.executionRoleArn,
      containerDefinitions: JSON.parse(JSON.stringify(currentTaskDef.containerDefinitions)),
    };

    if (currentTaskDef.taskRoleArn) {
      newTaskDef.taskRoleArn = currentTaskDef.taskRoleArn;
    }

    // Find the main container (usually the first one)
    const container = newTaskDef.containerDefinitions[0];
    
    // Ensure environment array exists
    if (!container.environment) {
      container.environment = [];
    }

    // Add the new environment variable
    const envVarName = `${subdomain.toUpperCase()}_DATABASE_URL`;
    
    // Check if it already exists
    const existingIndex = container.environment.findIndex((e: any) => e.name === envVarName);
    if (existingIndex >= 0) {
      // Update existing
      container.environment[existingIndex].value = databaseUrl;
      console.log(`  Updated existing env var: ${envVarName}`);
    } else {
      // Add new
      container.environment.push({
        name: envVarName,
        value: databaseUrl,
      });
      console.log(`  Added new env var: ${envVarName}`);
    }

    // Register the new task definition
    console.log('  Registering new task definition revision...');
    const registerResult = await makeAwsRequest('ecs', 'RegisterTaskDefinition', newTaskDef);
    
    const newTaskDefArn = registerResult.taskDefinition.taskDefinitionArn;
    const revision = registerResult.taskDefinition.revision;
    
    console.log(`✅ New task definition registered: ${ECS_TASK_FAMILY}:${revision}`);

    return {
      success: true,
      taskDefinitionArn: newTaskDefArn,
      revision,
      message: `Task definition updated to revision ${revision}`,
    };
  } catch (error: any) {
    console.error('❌ ECS update failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Deploy the updated ECS task definition by updating the service
 */
export async function deployEcsService(taskDefinitionArn?: string): Promise<{
  success: boolean;
  message: string;
}> {
  console.log(`🚀 Deploying ECS service: ${ECS_SERVICE}`);

  try {
    const updateParams: any = {
      cluster: ECS_CLUSTER,
      service: ECS_SERVICE,
      forceNewDeployment: true,
    };

    if (taskDefinitionArn) {
      updateParams.taskDefinition = taskDefinitionArn;
    }

    await makeAwsRequest('ecs', 'UpdateService', updateParams);
    
    console.log('✅ ECS service deployment initiated');
    
    return {
      success: true,
      message: 'ECS service deployment initiated. New tasks will start within 2-3 minutes.',
    };
  } catch (error: any) {
    console.error('❌ ECS deployment failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Full ECS update: update task definition and deploy
 */
export async function updateAndDeployEcs(
  subdomain: string,
  databaseUrl: string
): Promise<{
  success: boolean;
  taskDefinitionArn?: string;
  revision?: number;
  message: string;
}> {
  // Step 1: Update task definition
  const updateResult = await updateEcsTaskDefinition(subdomain, databaseUrl);
  
  if (!updateResult.success) {
    return updateResult;
  }

  // Step 2: Deploy the service
  const deployResult = await deployEcsService(updateResult.taskDefinitionArn);
  
  if (!deployResult.success) {
    return {
      success: false,
      taskDefinitionArn: updateResult.taskDefinitionArn,
      revision: updateResult.revision,
      message: `Task definition updated but deployment failed: ${deployResult.message}`,
    };
  }

  return {
    success: true,
    taskDefinitionArn: updateResult.taskDefinitionArn,
    revision: updateResult.revision,
    message: `Task definition updated to revision ${updateResult.revision} and deployment initiated`,
  };
}

/**
 * Check ECS credentials configuration
 */
export function checkEcsCredentials(): {
  configured: boolean;
  method: 'environment' | 'task_role' | 'none';
  missing: string[];
} {
  // Check environment variables first
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    return {
      configured: true,
      method: 'environment',
      missing: [],
    };
  }

  // Check for ECS task role (only works when running in ECS)
  if (process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) {
    return {
      configured: true,
      method: 'task_role',
      missing: [],
    };
  }

  const missing: string[] = [];
  if (!AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  
  return {
    configured: false,
    method: 'none',
    missing,
  };
}

// =============================================================================
// TENANT DELETION - WITH MULTIPLE SAFEGUARDS
// =============================================================================

/**
 * Protected tenants that CANNOT be deleted under any circumstances
 * These are critical infrastructure tenants
 */
const PROTECTED_TENANTS = [
  'moravian',      // Primary production customer
  'template',      // Gold standard template for new tenants
  'admin',         // Admin database
];

/**
 * Tenants that require EXTRA confirmation (but can be deleted)
 * These are production or important tenants
 */
const HIGH_PROTECTION_TENANTS = [
  'staging',       // Staging environment
];

/**
 * Deletion request interface
 */
export interface TenantDeletionRequest {
  tenantId: string;
  confirmationPhrase: string;          // Must match "DELETE {subdomain}"
  adminPassword: string;               // Re-authentication
  reason: string;                      // Why are you deleting this?
  acknowledgeDataLoss: boolean;        // Explicit acknowledgment
  deleteNeonDatabase?: boolean;        // Default FALSE - keep database for recovery (costs minimal when inactive)
}

/**
 * Deletion result interface
 */
export interface TenantDeletionResult {
  success: boolean;
  tenantId: string;
  deletionType: 'soft' | 'hard';
  steps: {
    step: string;
    status: 'completed' | 'failed' | 'skipped';
    message?: string;
  }[];
  recoveryInfo?: {
    neonProjectId?: string;
    databaseUrl?: string;
    backupCreated?: boolean;
    canRecover: boolean;
    recoveryDeadline?: Date;
    databasePreserved?: boolean;  // Indicates Neon DB was kept for recovery
  };
  error?: string;
}

/**
 * Audit log for deletion attempts
 */
export interface DeletionAuditLog {
  timestamp: Date;
  tenantId: string;
  requestedBy: string;
  action: 'request' | 'approved' | 'blocked' | 'completed' | 'failed';
  reason: string;
  details?: string;
}

// In-memory audit log (should be persisted to database in production)
const deletionAuditLog: DeletionAuditLog[] = [];

/**
 * Log a deletion attempt for audit purposes
 */
function logDeletionAttempt(entry: DeletionAuditLog): void {
  deletionAuditLog.push(entry);
  console.log(`[DELETION AUDIT] ${entry.action.toUpperCase()}: Tenant "${entry.tenantId}" by ${entry.requestedBy} - ${entry.reason}`);
  if (entry.details) {
    console.log(`  Details: ${entry.details}`);
  }
}

/**
 * Get deletion audit log
 */
export function getDeletionAuditLog(): DeletionAuditLog[] {
  return [...deletionAuditLog];
}

/**
 * Check if a tenant can be deleted
 */
export function canDeleteTenant(tenantId: string): {
  canDelete: boolean;
  reason: string;
  protectionLevel: 'protected' | 'high' | 'normal';
  requiredConfirmations: string[];
} {
  const normalizedId = tenantId.toLowerCase();
  
  // Check if tenant is in protected list
  if (PROTECTED_TENANTS.includes(normalizedId)) {
    return {
      canDelete: false,
      reason: `Tenant "${tenantId}" is a PROTECTED infrastructure tenant and cannot be deleted. Protected tenants: ${PROTECTED_TENANTS.join(', ')}`,
      protectionLevel: 'protected',
      requiredConfirmations: [],
    };
  }
  
  // Check if tenant requires high protection
  if (HIGH_PROTECTION_TENANTS.includes(normalizedId)) {
    return {
      canDelete: true,
      reason: `Tenant "${tenantId}" is a HIGH-PROTECTION tenant. Extra confirmation required.`,
      protectionLevel: 'high',
      requiredConfirmations: [
        'Type "DELETE {subdomain}" exactly',
        'Re-enter your admin password',
        'Acknowledge permanent data loss',
        'Provide reason for deletion',
        'Wait 30-second cooling off period',
      ],
    };
  }
  
  // Normal tenant
  return {
    canDelete: true,
    reason: `Tenant "${tenantId}" can be deleted with standard confirmation.`,
    protectionLevel: 'normal',
    requiredConfirmations: [
      'Type "DELETE {subdomain}" exactly',
      'Re-enter your admin password',
      'Acknowledge permanent data loss',
      'Provide reason for deletion',
    ],
  };
}

/**
 * Validate deletion request
 */
export function validateDeletionRequest(
  request: TenantDeletionRequest,
  adminEmail: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check confirmation phrase
  const expectedPhrase = `DELETE ${request.tenantId}`.toUpperCase();
  if (request.confirmationPhrase.toUpperCase() !== expectedPhrase) {
    errors.push(`Confirmation phrase must be exactly "${expectedPhrase}"`);
  }
  
  // Check acknowledgment
  if (!request.acknowledgeDataLoss) {
    errors.push('You must acknowledge that this action will permanently delete all tenant data');
  }
  
  // Check reason
  if (!request.reason || request.reason.length < 10) {
    errors.push('Please provide a detailed reason for deletion (minimum 10 characters)');
  }
  
  // Check password is provided
  if (!request.adminPassword) {
    errors.push('Admin password is required for re-authentication');
  }
  
  // Log the attempt
  logDeletionAttempt({
    timestamp: new Date(),
    tenantId: request.tenantId,
    requestedBy: adminEmail,
    action: errors.length === 0 ? 'approved' : 'blocked',
    reason: request.reason || 'No reason provided',
    details: errors.length > 0 ? `Validation failed: ${errors.join(', ')}` : 'Validation passed',
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Soft delete a tenant (mark as deleted, don't destroy data)
 * This is the recommended first step - data can be recovered
 */
export async function softDeleteTenant(
  tenantId: string,
  adminPool: Pool,
  adminEmail: string,
  reason: string
): Promise<TenantDeletionResult> {
  const steps: TenantDeletionResult['steps'] = [];
  
  try {
    console.log(`🗑️  SOFT DELETE initiated for tenant: ${tenantId}`);
    
    // Step 1: Mark tenant as deleted in admin database
    steps.push({ step: 'Mark tenant as deleted', status: 'completed' });
    
    await adminPool.query(`
      UPDATE tenants 
      SET status = 'deleted',
          deleted_at = NOW(),
          deleted_by = $1,
          deletion_reason = $2,
          updated_at = NOW()
      WHERE id = $3 OR subdomain = $3
    `, [adminEmail, reason, tenantId]);
    
    // Step 2: Log the deletion
    logDeletionAttempt({
      timestamp: new Date(),
      tenantId,
      requestedBy: adminEmail,
      action: 'completed',
      reason,
      details: 'Soft delete completed. Tenant marked as deleted but data preserved.',
    });
    
    steps.push({ step: 'Audit log recorded', status: 'completed' });
    
    // Step 3: Refresh main app's tenant registry
    try {
      await fetch(`${APP_BASE_URL}/api/admin/tenant-registry/refresh`, {
        method: 'POST',
        headers: registryHeaders(),
      });
      steps.push({ step: 'Refresh tenant registry', status: 'completed' });
    } catch (error) {
      steps.push({ step: 'Refresh tenant registry', status: 'failed', message: 'Non-critical failure' });
    }
    
    console.log(`✅ Tenant "${tenantId}" soft deleted successfully`);
    
    return {
      success: true,
      tenantId,
      deletionType: 'soft',
      steps,
      recoveryInfo: {
        canRecover: true,
        recoveryDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    };
    
  } catch (error: any) {
    console.error(`❌ Soft delete failed for tenant "${tenantId}":`, error);
    
    logDeletionAttempt({
      timestamp: new Date(),
      tenantId,
      requestedBy: adminEmail,
      action: 'failed',
      reason,
      details: `Soft delete failed: ${error.message}`,
    });
    
    return {
      success: false,
      tenantId,
      deletionType: 'soft',
      steps,
      error: error.message,
    };
  }
}

/**
 * Hard delete a tenant (permanently destroy all data)
 * ⚠️ THIS IS IRREVERSIBLE ⚠️
 */
export async function hardDeleteTenant(
  request: TenantDeletionRequest,
  adminPool: Pool,
  adminEmail: string
): Promise<TenantDeletionResult> {
  const steps: TenantDeletionResult['steps'] = [];
  let neonProjectId: string | undefined;
  let databaseUrl: string | undefined;
  
  try {
    console.log(`⚠️  HARD DELETE initiated for tenant: ${request.tenantId}`);
    console.log(`⚠️  THIS WILL PERMANENTLY DESTROY ALL DATA`);
    
    // Step 1: Get tenant info before deletion
    const tenantResult = await adminPool.query(
      'SELECT * FROM tenants WHERE id = $1 OR subdomain = $1',
      [request.tenantId]
    );
    
    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant "${request.tenantId}" not found`);
    }
    
    const tenant = tenantResult.rows[0];
    databaseUrl = tenant.database_url;
    neonProjectId = tenant.neon_project_id;
    
    steps.push({ step: 'Retrieve tenant info', status: 'completed' });
    
    // Step 2: Delete from admin database
    await adminPool.query(
      'DELETE FROM tenants WHERE id = $1 OR subdomain = $1',
      [request.tenantId]
    );
    
    steps.push({ step: 'Delete from admin database', status: 'completed' });
    
    // Step 3: Delete Neon database (only if explicitly requested - default is to KEEP it)
    // Neon databases cost minimal when inactive, so we preserve for emergency recovery
    if (request.deleteNeonDatabase === true && neonProjectId && NEON_API_KEY) {
      try {
        console.log(`🗄️  ⚠️ DELETING Neon project: ${neonProjectId}`);
        console.log(`   This action is PERMANENT and cannot be undone!`);
        
        const response = await fetch(`https://console.neon.tech/api/v2/projects/${neonProjectId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${NEON_API_KEY}`,
          },
        });
        
        if (response.ok) {
          steps.push({ step: 'Delete Neon database', status: 'completed', message: '⚠️ Database permanently deleted' });
        } else {
          const error = await response.text();
          steps.push({ step: 'Delete Neon database', status: 'failed', message: error });
        }
      } catch (error: any) {
        steps.push({ step: 'Delete Neon database', status: 'failed', message: error.message });
      }
    } else {
      // Default: KEEP the database for recovery (minimal cost when inactive)
      steps.push({ 
        step: 'Preserve Neon database', 
        status: 'completed', 
        message: 'Database preserved for emergency recovery (costs minimal when inactive)' 
      });
    }
    
    // Step 4: Remove environment variable from ECS (optional - complex and may not be needed)
    steps.push({ step: 'Remove ECS env var', status: 'skipped', message: 'Environment variable left in place (safe to ignore)' });
    
    // Step 5: Refresh tenant registry
    try {
      await fetch(`${APP_BASE_URL}/api/admin/tenant-registry/refresh`, {
        method: 'POST',
        headers: registryHeaders(),
      });
      steps.push({ step: 'Refresh tenant registry', status: 'completed' });
    } catch (error) {
      steps.push({ step: 'Refresh tenant registry', status: 'failed', message: 'Non-critical failure' });
    }
    
    // Step 6: Log the deletion
    logDeletionAttempt({
      timestamp: new Date(),
      tenantId: request.tenantId,
      requestedBy: adminEmail,
      action: 'completed',
      reason: request.reason,
      details: `HARD DELETE completed. Steps: ${steps.map(s => `${s.step}:${s.status}`).join(', ')}`,
    });
    
    steps.push({ step: 'Audit log recorded', status: 'completed' });
    
    console.log(`✅ Tenant "${request.tenantId}" hard deleted successfully`);
    
    return {
      success: true,
      tenantId: request.tenantId,
      deletionType: 'hard',
      steps,
      recoveryInfo: {
        neonProjectId,
        databaseUrl: request.deleteNeonDatabase !== true ? databaseUrl : undefined,
        canRecover: request.deleteNeonDatabase !== true,
        databasePreserved: request.deleteNeonDatabase !== true,
      },
    };
    
  } catch (error: any) {
    console.error(`❌ Hard delete failed for tenant "${request.tenantId}":`, error);
    
    logDeletionAttempt({
      timestamp: new Date(),
      tenantId: request.tenantId,
      requestedBy: adminEmail,
      action: 'failed',
      reason: request.reason,
      details: `Hard delete failed: ${error.message}`,
    });
    
    return {
      success: false,
      tenantId: request.tenantId,
      deletionType: 'hard',
      steps,
      recoveryInfo: {
        neonProjectId,
        databaseUrl,
        canRecover: true,
        databasePreserved: true,
      },
      error: error.message,
    };
  }
}

/**
 * Restore a soft-deleted tenant
 */
export async function restoreTenant(
  tenantId: string,
  adminPool: Pool,
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`♻️  Restoring tenant: ${tenantId}`);
    
    const result = await adminPool.query(`
      UPDATE tenants 
      SET status = 'active',
          deleted_at = NULL,
          deleted_by = NULL,
          deletion_reason = NULL,
          updated_at = NOW()
      WHERE (id = $1 OR subdomain = $1) AND status = 'deleted'
      RETURNING id, name
    `, [tenantId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: `Tenant "${tenantId}" not found or is not in deleted status`,
      };
    }
    
    // Refresh tenant registry
    try {
      await fetch(`${APP_BASE_URL}/api/admin/tenant-registry/refresh`, {
        method: 'POST',
        headers: registryHeaders(),
      });
    } catch (error) {
      // Non-critical
    }
    
    logDeletionAttempt({
      timestamp: new Date(),
      tenantId,
      requestedBy: adminEmail,
      action: 'completed',
      reason: 'Tenant restoration',
      details: `Tenant ${result.rows[0].name} restored to active status`,
    });
    
    console.log(`✅ Tenant "${tenantId}" restored successfully`);
    
    return {
      success: true,
      message: `Tenant "${result.rows[0].name}" has been restored to active status`,
    };
    
  } catch (error: any) {
    console.error(`❌ Restore failed for tenant "${tenantId}":`, error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Get list of deleted tenants that can be restored
 */
export async function getDeletedTenants(adminPool: Pool): Promise<{
  tenants: Array<{
    id: string;
    name: string;
    subdomain: string;
    deletedAt: Date;
    deletedBy: string;
    reason: string;
    canRestore: boolean;
  }>;
}> {
  const result = await adminPool.query(`
    SELECT id, name, subdomain, deleted_at, deleted_by, deletion_reason
    FROM tenants
    WHERE status = 'deleted'
    ORDER BY deleted_at DESC
  `);
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    tenants: result.rows.map(row => ({
      id: row.id,
      name: row.name,
      subdomain: row.subdomain,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
      reason: row.deletion_reason,
      canRestore: new Date(row.deleted_at) > thirtyDaysAgo,
    })),
  };
}
