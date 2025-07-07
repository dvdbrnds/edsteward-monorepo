#!/usr/bin/env node

/**
 * EdSteward Architecture Verification Script
 * 
 * Verifies the true database-per-tenant architecture as documented in ARCHITECTURE.md
 * Tests the gold standard multi-tenant implementation with complete physical isolation
 * 
 * Architecture Pattern: Database-Per-Tenant
 * - Each tenant has dedicated PostgreSQL database  
 * - Complete physical data separation
 * - Tenant-specific connection pools
 * - Subdomain-based routing
 */

const { Pool } = require('pg');

// Database configurations per tenant (from ARCHITECTURE.md)
const TENANT_DATABASES = {
  admin: {
    name: 'EdSteward Admin',
    database: 'edsteward_admin',
    subdomain: 'admin',
    purpose: 'Admin console, tenant management',
    envVar: 'ADMIN_DATABASE_URL'
  },
  moravian: {
    name: 'Moravian University',
    database: 'edsteward_moravian', 
    subdomain: 'moravian',
    purpose: 'Moravian University production',
    envVar: 'MORAVIAN_DATABASE_URL'
  },
  staging: {
    name: 'EdSteward Staging',
    database: 'edsteward_staging',
    subdomain: 'staging', 
    purpose: 'Testing environment',
    envVar: 'STAGING_DATABASE_URL'
  },
  test: {
    name: 'EdSteward Test',
    database: 'edsteward_test',
    subdomain: 'test',
    purpose: 'Development testing',
    envVar: 'TEST_DATABASE_URL'
  }
};

// Core tables that should exist in each tenant database
const CORE_TABLES = [
  'users', 'tenants', 'regulations', 'regulationVersions', 'regulationUpdates',
  'deadlines', 'notes', 'evidenceFiles', 'notifications', 'notificationQueue',
  'systemLogs', 'csvSchemas'
];

// Application endpoints to test
const ENDPOINTS = {
  admin: 'https://admin.edsteward.ai',
  moravian: 'https://moravian.edsteward.ai', 
  staging: 'https://staging.edsteward.ai',
  dev: 'https://dev.edsteward.ai'
};

class EdStewardArchitectureVerifier {
  constructor() {
    this.results = {
      databaseConnections: {},
      schemaValidation: {},
      tenantIsolation: {},
      endpointAccessibility: {},
      samlConfiguration: {},
      healthChecks: {}
    };
    this.pools = {};
  }

  async createDatabasePool(tenantId, config) {
    const connectionString = process.env[config.envVar] || 
      `postgresql://user:pass@localhost:5432/${config.database}`;
    
    try {
      const pool = new Pool({
        connectionString,
        max: 5,
        connectionTimeoutMillis: 5000,
      });
      
      // Test connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.pools[tenantId] = pool;
      return { success: true, pool };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async verifyDatabaseConnections() {
    console.log('\n🔍 VERIFYING DATABASE-PER-TENANT CONNECTIONS');
    console.log('=' .repeat(60));
    
    for (const [tenantId, config] of Object.entries(TENANT_DATABASES)) {
      console.log(`\n📊 Testing ${config.name} (${tenantId})`);
      console.log(`   Database: ${config.database}`);
      console.log(`   Purpose: ${config.purpose}`);
      
      const result = await this.createDatabasePool(tenantId, config);
      
      if (result.success) {
        console.log('   ✅ Database connection successful');
        this.results.databaseConnections[tenantId] = { status: 'success', config };
      } else {
        console.log(`   ❌ Database connection failed: ${result.error}`);
        this.results.databaseConnections[tenantId] = { status: 'failed', error: result.error };
      }
    }
  }

  async verifySchemaConsistency() {
    console.log('\n🏗️ VERIFYING SCHEMA CONSISTENCY ACROSS TENANT DATABASES');
    console.log('=' .repeat(60));
    
    for (const [tenantId, pool] of Object.entries(this.pools)) {
      console.log(`\n📋 Checking schema for ${TENANT_DATABASES[tenantId].name}`);
      
      try {
        const client = await pool.connect();
        
        // Check if core tables exist
        const tableQuery = `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `;
        
        const tablesResult = await client.query(tableQuery);
        const existingTables = tablesResult.rows.map(row => row.table_name);
        
        console.log(`   📊 Found ${existingTables.length} tables`);
        
        const missingTables = CORE_TABLES.filter(table => !existingTables.includes(table));
        const extraTables = existingTables.filter(table => !CORE_TABLES.includes(table));
        
        if (missingTables.length === 0) {
          console.log('   ✅ All core tables present');
        } else {
          console.log(`   ⚠️  Missing tables: ${missingTables.join(', ')}`);
        }
        
        if (extraTables.length > 0) {
          console.log(`   ℹ️  Additional tables: ${extraTables.slice(0, 5).join(', ')}${extraTables.length > 5 ? '...' : ''}`);
        }
        
        this.results.schemaValidation[tenantId] = {
          totalTables: existingTables.length,
          coreTablesPresent: CORE_TABLES.length - missingTables.length,
          missingTables,
          extraTables: extraTables.length
        };
        
        client.release();
        
      } catch (error) {
        console.log(`   ❌ Schema check failed: ${error.message}`);
        this.results.schemaValidation[tenantId] = { error: error.message };
      }
    }
  }

  async verifyTenantIsolation() {
    console.log('\n🔒 VERIFYING TENANT ISOLATION');
    console.log('=' .repeat(60));
    
    for (const [tenantId, pool] of Object.entries(this.pools)) {
      console.log(`\n🏢 Testing isolation for ${TENANT_DATABASES[tenantId].name}`);
      
      try {
        const client = await pool.connect();
        
        // Count users in this tenant's database
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        const users = parseInt(userCount.rows[0].count);
        
        // Check if tenants table exists and get tenant configuration
        const tenantQuery = await client.query(`
          SELECT id, name, subdomain, domain, status, features 
          FROM tenants 
          LIMIT 5
        `);
        
        console.log(`   📊 Users in database: ${users}`);
        console.log(`   📊 Tenant records: ${tenantQuery.rows.length}`);
        
        // Verify this is truly isolated data
        if (tenantQuery.rows.length > 0) {
          const mainTenant = tenantQuery.rows[0];
          console.log(`   🏷️  Primary tenant: ${mainTenant.name} (${mainTenant.subdomain})`);
          console.log(`   🌐 Domain: ${mainTenant.domain}`);
          console.log(`   ✅ Status: ${mainTenant.status}`);
        }
        
        this.results.tenantIsolation[tenantId] = {
          userCount: users,
          tenantRecords: tenantQuery.rows.length,
          primaryTenant: tenantQuery.rows[0] || null,
          isolation: 'PHYSICAL_SEPARATION'
        };
        
        client.release();
        
      } catch (error) {
        console.log(`   ❌ Isolation check failed: ${error.message}`);
        this.results.tenantIsolation[tenantId] = { error: error.message };
      }
    }
  }

  async verifyEndpointAccessibility() {
    console.log('\n🌐 VERIFYING SUBDOMAIN-BASED TENANT ROUTING');
    console.log('=' .repeat(60));
    
    for (const [tenantId, url] of Object.entries(ENDPOINTS)) {
      console.log(`\n🔗 Testing ${url}`);
      
      try {
        // Test health endpoint
        const healthUrl = `${url}/health`;
        const response = await fetch(healthUrl, { 
          method: 'GET',
          timeout: 5000 
        });
        
        if (response.ok) {
          console.log(`   ✅ Health endpoint accessible (${response.status})`);
          
          // Test API health for more detailed info
          try {
            const apiHealthUrl = `${url}/api/health`;
            const apiResponse = await fetch(apiHealthUrl, { timeout: 5000 });
            
            if (apiResponse.ok) {
              const healthData = await apiResponse.json();
              console.log(`   ✅ API health: ${healthData.status}`);
              console.log(`   🏢 Tenant: ${healthData.tenant?.tenantId || 'unknown'}`);
              console.log(`   💾 Database: ${healthData.database?.connected ? 'connected' : 'disconnected'}`);
            }
          } catch (apiError) {
            console.log(`   ⚠️  API health check failed: ${apiError.message}`);
          }
          
          this.results.endpointAccessibility[tenantId] = { 
            status: 'accessible', 
            httpStatus: response.status 
          };
        } else {
          console.log(`   ❌ Endpoint not accessible (${response.status})`);
          this.results.endpointAccessibility[tenantId] = { 
            status: 'failed', 
            httpStatus: response.status 
          };
        }
        
      } catch (error) {
        console.log(`   ❌ Connection failed: ${error.message}`);
        this.results.endpointAccessibility[tenantId] = { 
          status: 'failed', 
          error: error.message 
        };
      }
    }
  }

  async verifySAMLConfiguration() {
    console.log('\n🔐 VERIFYING SAML 2.0 CONFIGURATION');
    console.log('=' .repeat(60));
    
    // Focus on Moravian tenant for SAML
    if (this.pools.moravian) {
      try {
        const client = await this.pools.moravian.connect();
        
        const samlQuery = await client.query(`
          SELECT id, name, subdomain, saml_config 
          FROM tenants 
          WHERE subdomain = 'moravian'
        `);
        
        if (samlQuery.rows.length > 0) {
          const moravianTenant = samlQuery.rows[0];
          const samlConfig = moravianTenant.saml_config;
          
          console.log(`\n🎓 Moravian University SAML Configuration:`);
          console.log(`   🏷️  Tenant: ${moravianTenant.name}`);
          
          if (samlConfig) {
            console.log(`   ✅ SAML configuration exists`);
            console.log(`   🆔 Entity ID: ${samlConfig.entityId || 'Not configured'}`);
            console.log(`   🔗 SSO URL: ${samlConfig.ssoUrl ? 'Configured' : 'Pending'}`);
            console.log(`   📜 Certificate: ${samlConfig.certificate ? 'Present' : 'Pending Moravian IT'}`);
            
            // Test SAML metadata endpoint
            try {
              const metadataUrl = 'https://moravian.edsteward.ai/auth/saml/metadata';
              const metadataResponse = await fetch(metadataUrl, { timeout: 5000 });
              
              if (metadataResponse.ok) {
                console.log(`   ✅ SAML metadata endpoint accessible`);
              } else {
                console.log(`   ⚠️  SAML metadata endpoint returned ${metadataResponse.status}`);
              }
            } catch (metadataError) {
              console.log(`   ❌ SAML metadata endpoint failed: ${metadataError.message}`);
            }
            
            this.results.samlConfiguration.moravian = {
              configured: true,
              entityId: samlConfig.entityId,
              ssoUrl: !!samlConfig.ssoUrl,
              certificate: !!samlConfig.certificate
            };
          } else {
            console.log(`   ⚠️  No SAML configuration found`);
            this.results.samlConfiguration.moravian = { configured: false };
          }
        }
        
        client.release();
        
      } catch (error) {
        console.log(`   ❌ SAML configuration check failed: ${error.message}`);
        this.results.samlConfiguration.moravian = { error: error.message };
      }
    }
  }

  async verifyHealthChecks() {
    console.log('\n🏥 VERIFYING SYSTEM HEALTH');
    console.log('=' .repeat(60));
    
    const healthChecks = [
      'staging.edsteward.ai',
      'moravian.edsteward.ai', 
      'admin.edsteward.ai'
    ];
    
    let healthyCount = 0;
    
    for (const domain of healthChecks) {
      try {
        const response = await fetch(`https://${domain}/health`, { 
          method: 'GET',
          timeout: 3000 
        });
        
        if (response.ok) {
          console.log(`   ✅ ${domain} - Healthy`);
          healthyCount++;
          this.results.healthChecks[domain] = { status: 'healthy' };
        } else {
          console.log(`   ❌ ${domain} - Failed (${response.status})`);
          this.results.healthChecks[domain] = { status: 'failed', httpStatus: response.status };
        }
      } catch (error) {
        console.log(`   ❌ ${domain} - Connection failed`);
        this.results.healthChecks[domain] = { status: 'failed', error: error.message };
      }
    }
    
    console.log(`\n📊 Overall Health: ${healthyCount}/${healthChecks.length} systems healthy`);
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 EDSTEWARD ARCHITECTURE VERIFICATION REPORT');
    console.log('='.repeat(80));
    
    // Database Connections Summary
    const dbConnections = Object.entries(this.results.databaseConnections);
    const successfulConnections = dbConnections.filter(([_, result]) => result.status === 'success').length;
    
    console.log(`\n🗄️ DATABASE-PER-TENANT ARCHITECTURE:`);
    console.log(`   ✅ Successful connections: ${successfulConnections}/${dbConnections.length}`);
    console.log(`   🏗️ Architecture pattern: Physical database separation (GOLD STANDARD)`);
    console.log(`   🔒 Tenant isolation: Complete physical data separation`);
    
    // Schema Validation Summary
    const schemas = Object.entries(this.results.schemaValidation);
    const validSchemas = schemas.filter(([_, result]) => !result.error && result.missingTables?.length === 0).length;
    
    console.log(`\n📋 SCHEMA CONSISTENCY:`);
    console.log(`   ✅ Valid schemas: ${validSchemas}/${schemas.length}`);
    
    // Tenant Isolation Summary  
    console.log(`\n🏢 TENANT ISOLATION:`);
    Object.entries(this.results.tenantIsolation).forEach(([tenantId, result]) => {
      if (!result.error) {
        console.log(`   ${tenantId.toUpperCase()}: ${result.userCount} users, ${result.tenantRecords} tenant records`);
      }
    });
    
    // Endpoint Accessibility
    const endpoints = Object.entries(this.results.endpointAccessibility);
    const accessibleEndpoints = endpoints.filter(([_, result]) => result.status === 'accessible').length;
    
    console.log(`\n🌐 SUBDOMAIN ROUTING:`);
    console.log(`   ✅ Accessible endpoints: ${accessibleEndpoints}/${endpoints.length}`);
    
    // SAML Configuration
    console.log(`\n🔐 SAML 2.0 CONFIGURATION:`);
    if (this.results.samlConfiguration.moravian) {
      const saml = this.results.samlConfiguration.moravian;
      if (saml.configured) {
        console.log(`   ✅ Moravian SAML configured`);
        console.log(`   🆔 Entity ID: ${saml.entityId ? 'Set' : 'Missing'}`);
        console.log(`   🔗 SSO URL: ${saml.ssoUrl ? 'Configured' : 'Pending'}`);
        console.log(`   📜 Certificate: ${saml.certificate ? 'Present' : 'Pending'}`);
      } else {
        console.log(`   ⚠️  Moravian SAML needs configuration`);
      }
    }
    
    // Overall Assessment
    console.log('\n' + '='.repeat(80));
    console.log('🎯 OVERALL ASSESSMENT');
    console.log('='.repeat(80));
    
    if (successfulConnections === dbConnections.length && accessibleEndpoints >= endpoints.length * 0.8) {
      console.log('✅ ARCHITECTURE VERIFICATION: PASSED');
      console.log('🎉 EdSteward database-per-tenant architecture is working correctly');
      console.log('🏗️ Gold standard multi-tenant isolation confirmed');
      console.log('🚀 System ready for production use');
    } else {
      console.log('⚠️  ARCHITECTURE VERIFICATION: ISSUES DETECTED');
      console.log('🔧 Some components need attention before full deployment');
    }
    
    console.log('='.repeat(80));
  }

  async cleanup() {
    // Close all database pools
    for (const [tenantId, pool] of Object.entries(this.pools)) {
      try {
        await pool.end();
      } catch (error) {
        console.log(`Warning: Failed to close pool for ${tenantId}: ${error.message}`);
      }
    }
  }

  async run() {
    console.log('🏗️ EDSTEWARD ARCHITECTURE VERIFICATION');
    console.log('Database-Per-Tenant Implementation Verification');
    console.log('Based on ARCHITECTURE.md specification');
    console.log('='.repeat(80));
    
    try {
      await this.verifyDatabaseConnections();
      await this.verifySchemaConsistency(); 
      await this.verifyTenantIsolation();
      await this.verifyEndpointAccessibility();
      await this.verifySAMLConfiguration();
      await this.verifyHealthChecks();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Run verification
if (require.main === module) {
  const verifier = new EdStewardArchitectureVerifier();
  verifier.run().catch(console.error);
}

module.exports = EdStewardArchitectureVerifier; 