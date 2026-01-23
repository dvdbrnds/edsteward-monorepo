/**
 * MCP Engine Delivery Server
 * 
 * HTTP server that hosts the regulation delivery system
 * Integrates with existing LLM Gateway infrastructure
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { RegulationDeliveryEngine, REGULATION_EVENTS } from './regulation-delivery-engine.js';
import { EdStewardIntegration } from './edsteward-integration.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Load customer configuration
let customerConfig = { customers: [], defaults: {} };
try {
  const configPath = path.join(__dirname, '../../config/customers.json');
  customerConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(`✅ Loaded ${customerConfig.customers.length} customers from config`);
} catch (error) {
  console.warn('⚠️ Customer config not found, using defaults');
}

class DeliveryServer {
  constructor(options = {}) {
    this.port = options.port || 3003;  // EdSteward expects MCP WebSocket on 3003
    this.app = express();
    this.server = createServer(this.app);
    this.deliveryEngine = null;
    this.edstewardIntegration = null;
    this.customers = customerConfig.customers;
    this.customerDefaults = customerConfig.defaults;
    
    // Initialize database pool for regulation data
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'mcp_engine',
      user: process.env.PGUSER || process.env.USER,
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors({
      origin: ['http://localhost:3050', 'http://localhost:3000', 'http://localhost:3010'],
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    // Health check endpoint (with timeout protection)
    this.app.get('/health', (req, res) => {
      try {
        // Set a response timeout to prevent hanging
        const timeout = setTimeout(() => {
          if (!res.headersSent) {
            res.status(503).json({
              service: 'RegulationDeliveryEngine',
              status: 'timeout',
              timestamp: new Date().toISOString(),
              error: 'Health check timed out'
            });
          }
        }, 2000); // 2 second timeout

        const status = this.deliveryEngine ? this.deliveryEngine.getStatus() : null;
        
        clearTimeout(timeout);
        
        if (!res.headersSent) {
          res.json({
            service: 'RegulationDeliveryEngine',
            status: status ? 'healthy' : 'initializing',
            timestamp: new Date().toISOString(),
            details: status,
            uptime: process.uptime(),
            customers: this.customers.length
          });
        }
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({
            service: 'RegulationDeliveryEngine',
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
          });
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CUSTOMER MANAGEMENT ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════════════

    // List all available customers for dropdown
    this.app.get('/api/customers', (req, res) => {
      const customers = this.customers.map(c => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        type: c.type,
        enabled: c.enabled,
        url: c.url
      }));
      
      res.json({
        customers,
        defaults: this.customerDefaults,
        timestamp: new Date().toISOString()
      });
    });

    // Get customer status (online/offline check)
    this.app.get('/api/customers/:customerId/status', async (req, res) => {
      const { customerId } = req.params;
      const customer = this.customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found', customerId });
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const healthUrl = `${customer.url}/health`;
        const response = await fetch(healthUrl, { 
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        res.json({
          customerId,
          name: customer.name,
          status: response.ok ? 'online' : 'error',
          statusCode: response.status,
          url: customer.url,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.json({
          customerId,
          name: customer.name,
          status: 'offline',
          error: error.message,
          url: customer.url,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Push regulation update to specific customer(s)
    this.app.post('/api/customers/push', async (req, res) => {
      const { regulationId, customerIds, pushToAll = false } = req.body;
      
      if (!regulationId) {
        return res.status(400).json({ error: 'regulationId is required' });
      }

      // Determine which customers to push to
      let targetCustomers = [];
      if (pushToAll) {
        targetCustomers = this.customers.filter(c => c.enabled);
      } else if (customerIds && customerIds.length > 0) {
        targetCustomers = this.customers.filter(c => customerIds.includes(c.id) && c.enabled);
      } else {
        // Default customer
        const defaultCustomer = this.customers.find(c => c.id === this.customerDefaults.defaultCustomer);
        if (defaultCustomer) targetCustomers = [defaultCustomer];
      }

      if (targetCustomers.length === 0) {
        return res.status(400).json({ error: 'No valid customers specified' });
      }

      // Fetch regulation content from Registry API (full data)
      let regulationContent = {};
      try {
        // First try to get all regulations and find by ID
        const registryResponse = await fetch('http://localhost:3010/api/regulations');
        if (registryResponse.ok) {
          const regulations = await registryResponse.json();
          if (regulations && regulations.length > 0) {
            // Find by exact regulationId/item_id match
            regulationContent = regulations.find(r => 
              r.regulationId === regulationId || 
              r.item_id === regulationId ||
              r.regulationId?.startsWith(regulationId) ||
              regulationId?.startsWith(r.regulationId)
            );
            
            // If not found by ID, try searching by name
            if (!regulationContent) {
              const searchTerm = regulationId.replace(/-/g, ' ').substring(0, 30);
              regulationContent = regulations.find(r => 
                r.name?.toLowerCase().includes(searchTerm.toLowerCase())
              );
            }
            
            if (regulationContent) {
              console.log(`✅ Fetched regulation from Registry: ${regulationContent.name}`);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch from Registry API: ${error.message}`);
      }
      
      // Fallback to CDC if Registry didn't return data
      if (!regulationContent.name && this.deliveryEngine) {
        try {
          regulationContent = await this.deliveryEngine.cdc.fetchRegulationState(regulationId);
        } catch (error) {
          console.error(`Failed to fetch regulation state: ${error.message}`);
        }
      }

      // Push to each customer
      const results = [];
      for (const customer of targetCustomers) {
        try {
          console.log(`📤 Pushing ${regulationId} to ${customer.name}...`);
          
          // Use regKey as the universal identifier (REG-001 to REG-251)
          const regKey = regulationContent.regKey || regulationContent.reg_key;
          const itemId = regulationContent.regulationId || regulationContent.item_id || regulationId;
          console.log(`   📋 Using regKey: ${regKey || 'N/A'}, itemId: ${itemId}`);

          // Build EdSteward /api/regulation-updates payload (PENDING UPDATE format)
          // This creates a pending update for CCO review, NOT a direct sync
          const deadlinesJson = Array.isArray(regulationContent.filingDeadlines)
            ? JSON.stringify(regulationContent.filingDeadlines.map(d => ({
                deadline: d.dueDate || d.date || null,
                description: d.name || d.description || d.type || 'Filing deadline'
              })))
            : '[]';

          // Build requirements text - prioritize AI-extracted keyRequirements
          let requirementsText = '';
          
          // PRIORITY 1: Use keyRequirements from AI extraction (structured compliance requirements)
          if (Array.isArray(regulationContent.keyRequirements) && regulationContent.keyRequirements.length > 0) {
            requirementsText = '## Key Compliance Requirements\n\n' + 
              regulationContent.keyRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n');
          }
          // PRIORITY 2: Use existing requirements text field
          else if (typeof regulationContent.requirements === 'string' && regulationContent.requirements.length > 50) {
            requirementsText = regulationContent.requirements;
          }
          // PRIORITY 3: Build from compliance tasks
          else if (Array.isArray(regulationContent.complianceTasks) && regulationContent.complianceTasks.length > 0) {
            requirementsText = '## Compliance Tasks\n\n' + 
              regulationContent.complianceTasks.map(t => `• ${t.title}: ${t.description || ''}`).join('\n');
          }
          // PRIORITY 4: Use keyProvisions as fallback
          else if (Array.isArray(regulationContent.keyProvisions)) {
            requirementsText = regulationContent.keyProvisions.map(p => `• ${p.title}: ${p.description || ''}`).join('\n');
          }
          
          console.log(`   📋 Requirements: ${requirementsText.length} chars (source: ${
            Array.isArray(regulationContent.keyRequirements) && regulationContent.keyRequirements.length > 0 ? 'keyRequirements' :
            regulationContent.requirements?.length > 50 ? 'requirements field' :
            regulationContent.complianceTasks?.length > 0 ? 'tasks' : 'none'
          })`);
          
          // Extract risk score data
          const riskAssessment = regulationContent.riskAssessment || regulationContent.risk_assessment || null;
          const riskScore = riskAssessment?.riskScore || riskAssessment?.risk_score || null;
          const riskLevel = riskAssessment?.riskLevel || riskAssessment?.risk_level || null;
          
          console.log(`   📊 Risk Score: ${riskScore || 'N/A'} (${riskLevel || 'N/A'})`)

          // Build content text (ensure it's a string, not array)
          let contentText = '';
          if (typeof regulationContent.description === 'string') {
            contentText = regulationContent.description;
          } else if (typeof regulationContent.fullText === 'string') {
            contentText = regulationContent.fullText;
          } else if (typeof regulationContent.content === 'string') {
            contentText = regulationContent.content;
          } else if (Array.isArray(regulationContent.regulations)) {
            contentText = regulationContent.regulations.join('\n\n');
          } else if (typeof regulationContent.regulations === 'string') {
            contentText = regulationContent.regulations;
          }

          // Build statutes string
          const statutesText = Array.isArray(regulationContent.statutes) 
            ? regulationContent.statutes.join('; ')
            : (regulationContent.statute || '');

          // Build hierarchical compliance tasks with tempId and parentTempId
          // This preserves the parent-child relationships for EdSteward
          const hierarchicalTasks = [];
          const tasksArray = regulationContent.complianceTasks || regulationContent.tasks || [];
          if (Array.isArray(tasksArray) && tasksArray.length > 0) {
            // Group tasks by parent relationship using database parent_task_id
            const taskMap = new Map();
            const parentTasks = [];
            const childTasks = [];
            
            // First pass: identify parents vs children
            for (const task of tasksArray) {
              const tempId = `task-${task.id || task.sortOrder || hierarchicalTasks.length}`;
              taskMap.set(task.id, tempId);
              
              if (task.parentTaskId || task.parent_task_id) {
                childTasks.push({ ...task, tempId });
              } else {
                parentTasks.push({ ...task, tempId });
              }
            }
            
            // Add parent tasks first
            for (const task of parentTasks) {
              hierarchicalTasks.push({
                tempId: task.tempId,
                taskId: task.task_id || task.taskId || task.tempId,
                title: task.title,
                description: task.description || '',
                category: task.category || '',
                priority: task.priority || 'medium',
                requirementType: task.requirement_type || task.requirementType || 'requirement',
                assignedRole: task.assignedRole || task.assigned_role || '',
                evidenceRequired: task.evidenceRequired || task.evidence_required || false,
                evidenceType: task.evidenceType || task.evidence_type || 'document',
                sortOrder: task.sortOrder || task.sort_order || 0
              });
            }
            
            // Add child tasks with parentTempId reference
            for (const task of childTasks) {
              const parentDbId = task.parentTaskId || task.parent_task_id;
              const parentTempId = taskMap.get(parentDbId);
              
              hierarchicalTasks.push({
                tempId: task.tempId,
                taskId: task.task_id || task.taskId || task.tempId,
                parentTempId: parentTempId,  // CRITICAL: links to parent task
                title: task.title,
                description: task.description || '',
                category: task.category || '',
                priority: task.priority || 'medium',
                requirementType: task.requirement_type || task.requirementType || 'requirement',
                assignedRole: task.assignedRole || task.assigned_role || '',
                evidenceRequired: task.evidenceRequired || task.evidence_required || false,
                evidenceType: task.evidenceType || task.evidence_type || 'document',
                sortOrder: task.sortOrder || task.sort_order || 0
              });
            }
          }

          // Build the PENDING UPDATE payload for /api/regulation-updates
          // This goes to CCO review queue - NOT direct database write
          const filingDeadlinesArray = Array.isArray(regulationContent.filingDeadlines)
            ? regulationContent.filingDeadlines.map(d => ({
                deadline: d.dueDate || d.date || null,
                description: d.name || d.description || d.type || 'Filing deadline'
              }))
            : [];

          const payload = {
            // PRIMARY IDENTIFIER - Universal REG-XXX key (REG-001 to REG-251)
            mcpRegKey: regKey,
            regKey: regKey,
            
            // Backup identifiers (EdSteward will use regKey first)
            itemId: itemId,
            
            // Required fields for /api/mcp/regulations/sync
            name: regulationContent.name || regulationId,
            statute: regulationContent.statute || statutesText || 'See CFR',
            category: regulationContent.category || 'Uncategorized',
            topic: regulationContent.topic || 'General',
            cfr: regulationContent.cfr || '',
            
            // Content fields
            originalContent: contentText.substring(0, 5000) || 'Current regulation content',
            updatedContent: contentText.substring(0, 5000) || 'Updated regulation content',
            status: 'pending',  // CRITICAL: Creates pending update for CCO review
            
            // Additional context
            summary: regulationContent.summary || regulationContent.description || `MCP Engine update for ${regulationContent.name}`,
            requirements: requirementsText || '',
            filingDeadlines: JSON.stringify(filingDeadlinesArray),
            
            // Full hierarchical task list (parent-child relationships preserved)
            complianceTasks: hierarchicalTasks,
            
            // INSTITUTIONAL RISK SCORE (1-100) - COMPLETE BREAKDOWN
            riskScore: riskScore,
            riskLevel: riskLevel,
            riskAssessment: riskAssessment ? {
              score: riskScore,
              level: riskLevel,
              
              // Full risk factor breakdown with rationale for each score
              factors: riskAssessment.riskFactors || riskAssessment.risk_factors || null,
              
              // Factor summary for quick reference (score only)
              factorScores: {
                financialPenalty: riskAssessment.riskFactors?.financialPenalty?.score || riskAssessment.riskFactors?.financialPenalty || null,
                federalFunding: riskAssessment.riskFactors?.federalFunding?.score || riskAssessment.riskFactors?.federalFunding || null,
                accreditationImpact: riskAssessment.riskFactors?.accreditationImpact?.score || riskAssessment.riskFactors?.accreditationImpact || null,
                reputationalLegal: riskAssessment.riskFactors?.reputationalLegal?.score || riskAssessment.riskFactors?.reputationalLegal || null,
                operationalDisruption: riskAssessment.riskFactors?.operationalDisruption?.score || riskAssessment.riskFactors?.operationalDisruption || null
              },
              
              // Enforcement context
              enforcementTrend: riskAssessment.enforcementTrend || riskAssessment.enforcement_trend || null,
              recentEnforcementActions: riskAssessment.recentEnforcementActions || riskAssessment.recent_enforcement_actions || [],
              
              // Assessment metadata
              assessmentDate: riskAssessment.assessmentDate || riskAssessment.assessment_date || new Date().toISOString(),
              assessmentVersion: riskAssessment.assessmentVersion || riskAssessment.assessment_version || '1.0',
              isPreliminary: riskAssessment.isPreliminary || riskAssessment.is_preliminary || false
            } : null,
            
            // LOVV Validation Level
            lovvLevel: regulationContent.lovvLevel || regulationContent.lovv_level || null
          };
          
          console.log(`   📋 Sending ${hierarchicalTasks.length} tasks (hierarchy preserved)`);

          const headers = { 'Content-Type': 'application/json' };
          if (customer.auth?.method === 'basic') {
            const authString = Buffer.from(`${customer.auth.username}:${customer.auth.password}`).toString('base64');
            headers['Authorization'] = `Basic ${authString}`;
          }

          const response = await fetch(`${customer.url}${customer.apiEndpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          let responseData;
          try {
            responseData = await response.json();
          } catch {
            const rawText = await response.text();
            responseData = { raw: rawText };
          }

          results.push({
            customerId: customer.id,
            customerName: customer.name,
            success: response.ok,
            statusCode: response.status,
            response: responseData,
            timestamp: new Date().toISOString()
          });

          console.log(`   ${response.ok ? '✅' : '❌'} ${customer.name}: ${response.status}`);
        } catch (error) {
          results.push({
            customerId: customer.id,
            customerName: customer.name,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          console.error(`   ❌ ${customer.name}: ${error.message}`);
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        success: successCount > 0,
        regulationId,
        totalCustomers: targetCustomers.length,
        successCount,
        failedCount: targetCustomers.length - successCount,
        results,
        timestamp: new Date().toISOString()
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // EXISTING ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════════════

    // Trigger manual regulation check and EdSteward delivery
    this.app.post('/api/trigger-check/:regulationId', async (req, res) => {
      const { regulationId } = req.params;
      const { customerId, customerName, deliveryId } = req.body;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ 
          error: 'Delivery engine not ready',
          timestamp: new Date().toISOString()
        });
      }

      if (!this.edstewardIntegration) {
        return res.status(503).json({ 
          error: 'EdSteward integration not ready',
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Manually trigger a regulation check
        await this.deliveryEngine.cdc.monitorRegulation(regulationId);
        
        // Create regulation update for EdSteward
        const regulationUpdate = {
          regulationId: regulationId,
          data: {
            before: { content: `Previous ${regulationId} content` },
            after: { 
              content: `Updated ${regulationId} content from MCP Engine`,
              impact: 'medium',
              message: `Bulk delivery update for ${customerName}`,
              timestamp: new Date().toISOString()
            }
          },
          metadata: {
            customerId,
            customerName,
            deliveryId,
            bulkDelivery: true,
            mcpEngineTriggered: true
          }
        };

        // Send to EdSteward
        const edstewardResult = await this.edstewardIntegration.sendRegulationUpdate(regulationUpdate);
        
        res.json({
          success: true,
          message: `Manual check triggered for ${regulationId}`,
          edstewardDelivery: edstewardResult,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`❌ Error in trigger-check for ${regulationId}:`, error);
        res.status(500).json({
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Get event history for a regulation
    this.app.get('/api/events/:regulationId', (req, res) => {
      const { regulationId } = req.params;
      const { fromVersion = 0 } = req.query;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      const events = this.deliveryEngine.eventStore.getEvents(regulationId, parseInt(fromVersion));
      
      res.json({
        regulationId,
        events,
        total: events.length,
        timestamp: new Date().toISOString()
      });
    });

    // Get current state of a regulation
    this.app.get('/api/state/:regulationId', (req, res) => {
      const { regulationId } = req.params;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      const state = this.deliveryEngine.eventStore.getCurrentState(regulationId);
      
      res.json({
        regulationId,
        state,
        timestamp: new Date().toISOString()
      });
    });

    // WebSocket connection info endpoint
    this.app.get('/api/websocket-info', (req, res) => {
      res.json({
        websocketUrl: `ws://localhost:${this.port}/regulation-updates`,
        protocols: {
          subscribe: {
            type: 'subscribe',
            regulationIds: ['array of regulation IDs']
          },
          unsubscribe: {
            type: 'unsubscribe', 
            regulationIds: ['array of regulation IDs']
          },
          ping: { type: 'ping' }
        },
        events: {
          connected: 'Connection established',
          regulation_updated: 'Regulation content changed',
          subscription_confirmed: 'Subscription successful'
        }
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CONNECTED CLIENTS MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    // List all connected WebSocket clients
    this.app.get('/api/clients', (req, res) => {
      if (!this.deliveryEngine || !this.deliveryEngine.pushService) {
        return res.status(503).json({ 
          error: 'Delivery engine not ready',
          clients: [],
          timestamp: new Date().toISOString()
        });
      }

      const clients = this.deliveryEngine.pushService.getConnectedClients();
      const stats = this.deliveryEngine.pushService.getConnectionStats();

      res.json({
        clients,
        totalConnected: clients.length,
        subscriptionStats: stats.subscriptions,
        timestamp: new Date().toISOString()
      });
    });

    // Push update to specific WebSocket client(s)
    this.app.post('/api/clients/push', async (req, res) => {
      const { clientIds, regulationId, message, pushToAll = false } = req.body;

      if (!this.deliveryEngine || !this.deliveryEngine.pushService) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      if (!regulationId) {
        return res.status(400).json({ error: 'regulationId is required' });
      }

      // Build notification payload
      let regulationContent = {};
      try {
        regulationContent = await this.deliveryEngine.cdc.fetchRegulationState(regulationId);
      } catch (error) {
        console.error(`Failed to fetch regulation state: ${error.message}`);
      }

      const notification = {
        type: 'regulation_updated',
        regulationId,
        timestamp: new Date().toISOString(),
        message: message || 'Manual update from MCP Engine console',
        data: {
          name: regulationContent.name || regulationId,
          summary: regulationContent.summary || '',
          changeType: 'TARGETED_PUSH',
          version: regulationContent.version || 'unknown'
        }
      };

      try {
        let results;
        if (pushToAll) {
          // Push to all subscribed clients
          await this.deliveryEngine.pushService.pushRegulationUpdate(regulationId, notification.data);
          const connectedClients = this.deliveryEngine.pushService.getConnectedClients();
          results = {
            success: connectedClients.map(c => c.id),
            failed: []
          };
        } else if (clientIds && clientIds.length > 0) {
          // Push to specific clients
          results = await this.deliveryEngine.pushService.pushToSpecificClients(clientIds, notification);
        } else {
          return res.status(400).json({ error: 'Either clientIds array or pushToAll=true is required' });
        }

        res.json({
          success: true,
          regulationId,
          notification,
          delivered: results.success.length,
          failed: results.failed.length,
          results,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // EdSteward integration endpoints
    this.app.get('/api/edsteward/status', async (req, res) => {
      if (!this.edstewardIntegration) {
        return res.status(503).json({ error: 'EdSteward integration not initialized' });
      }

      const isConnected = await this.edstewardIntegration.testConnection();
      const mappings = this.edstewardIntegration.getMappings();

      res.json({
        connected: isConnected,
        edstewardUrl: this.edstewardIntegration.edstewardUrl,
        mappings,
        timestamp: new Date().toISOString()
      });
    });

    this.app.post('/api/edsteward/test-update', async (req, res) => {
      if (!this.edstewardIntegration) {
        return res.status(503).json({ error: 'EdSteward integration not initialized' });
      }

      const testUpdate = {
        regulationId: 'REG-66',
        version: 'TEST',
        timestamp: new Date().toISOString(),
        data: {
          changeType: 'MANUAL_TEST',
          before: { content: 'Previous TEACH Act content...' },
          after: { 
            content: 'Updated TEACH Act content with new requirements...',
            impact: 'high',
            message: 'Manual test update from MCP Engine'
          },
          contentHash: 'test_hash_' + Date.now()
        }
      };

      try {
        const result = await this.edstewardIntegration.sendRegulationUpdate(testUpdate);
        res.json({
          success: true,
          testUpdate,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          testUpdate,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Send regulation to EdSteward - PRODUCTION ENDPOINT (fetches real data from DB)
    this.app.post('/api/send-to-edsteward', async (req, res) => {
      const { regulationSlug, regKey, name } = req.body;
      
      console.log('📤 Sending regulation to EdSteward:', regKey || regulationSlug);
      
      try {
        // Fetch regulation from database
        const regResult = await this.pool.query(`
          SELECT id, reg_key, name, statute, cfr, summary, effective_date, item_id, category, topic
          FROM regulations 
          WHERE (reg_key = $1 OR item_id = $2) AND is_current = true
          LIMIT 1
        `, [regKey, regulationSlug]);
        
        if (regResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Regulation not found' });
        }
        
        const regulation = regResult.rows[0];
        
        // Fetch tasks from database
        const tasksResult = await this.pool.query(`
          SELECT task_id, title, description, priority, requirement_type, sort_order
          FROM regulation_tasks 
          WHERE regulation_id = $1
          ORDER BY sort_order
        `, [regulation.id]);
        
        // Fetch deadlines from database
        const deadlinesResult = await this.pool.query(`
          SELECT deadline_id, name, description, frequency, recurring_month, recurring_day
          FROM regulation_deadlines 
          WHERE regulation_id = $1
        `, [regulation.id]);
        
        // Format compliance tasks for EdSteward
        const complianceTasks = tasksResult.rows.map((task, index) => ({
          taskId: task.task_id || `task-${regulation.reg_key}-${index}`,
          title: task.title,
          description: task.description || task.title,
          priority: task.priority || 'medium',
          requirementType: task.requirement_type || 'requirement'
        }));
        
        // Build payload with real data
        const payload = {
          regulationId: regulation.id,
          mcpRegKey: regulation.reg_key,
          name: regulation.name,
          statute: regulation.statute,
          cfr: regulation.cfr,
          category: regulation.category,
          topic: regulation.topic,
          summary: regulation.summary,
          effectiveDate: regulation.effective_date,
          complianceTasks,
          deadlines: deadlinesResult.rows.map(d => ({
            name: d.name,
            description: d.description,
            frequency: d.frequency,
            recurringMonth: d.recurring_month,
            recurringDay: d.recurring_day
          })),
          taskStats: {
            total: tasksResult.rows.length,
            requirements: tasksResult.rows.filter(t => t.requirement_type === 'requirement').length,
            bestPractices: tasksResult.rows.filter(t => t.requirement_type === 'best_practice').length
          },
          status: 'pending',
          metadata: {
            source: 'MCP_ENGINE_GOLD_CERTIFIED',
            timestamp: new Date().toISOString(),
            mcpEngineId: regulationSlug,
            syncType: 'gold-certified-push'
          }
        };
        
        console.log(`📋 Sending ${regulation.reg_key}: ${complianceTasks.length} tasks (${payload.taskStats.requirements} req, ${payload.taskStats.bestPractices} best)`);
        
        // Use local EdSteward for dev, production URL for prod
        const edstewardUrl = process.env.EDSTEWARD_URL || 'http://localhost:3000';
        const syncUrl = `${edstewardUrl}/api/mcp/regulations/sync`;
        console.log(`📡 POST to: ${syncUrl}`);
        console.log(`📡 Payload keys: ${Object.keys(payload).join(', ')}`);
        console.log(`📡 Payload size: ${JSON.stringify(payload).length} bytes`);
        const response = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from('dvdbrnds:gabadh').toString('base64'),
            'X-MCP-Source': 'mcp-engine',
            'X-Sync-Type': 'gold-certified'
          },
          body: JSON.stringify(payload)
        });
        
        console.log(`📡 Response status: ${response.status} ${response.statusText}`);
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.log(`📡 Response body (not JSON): ${responseText.substring(0, 200)}`);
          throw new Error(`EdSteward returned non-JSON: ${responseText.substring(0, 100)}`);
        }
        
        if (response.ok) {
          console.log(`✅ Successfully sent ${regulation.reg_key} to EdSteward (${complianceTasks.length} tasks)`);
          res.json({ 
            success: true, 
            regKey: regulation.reg_key,
            tasksCount: complianceTasks.length,
            taskStats: payload.taskStats,
            result 
          });
        } else {
          console.log('❌ EdSteward error:', result);
          res.status(response.status).json({ success: false, error: result });
        }
      } catch (error) {
        console.error('❌ Error sending to EdSteward:', error.message);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Simulate regulation change (for testing)
    this.app.post('/api/simulate-change/:regulationId', async (req, res) => {
      const { regulationId } = req.params;
      const { changeType = 'content_update', mockData = {} } = req.body;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ error: 'Delivery engine not ready' });
      }

      try {
        // Create a simulated change event
        const simulatedChange = {
          regulationId,
          before: { version: '1.0', content: 'Original content' },
          after: { version: '1.1', content: 'Updated content', ...mockData },
          changeType,
          timestamp: new Date().toISOString(),
          contentHash: 'simulated_hash_' + Date.now()
        };

        // Emit the change event
        await this.deliveryEngine.cdc.emit(REGULATION_EVENTS.CONTENT_CHANGED, simulatedChange);
        
        res.json({
          success: true,
          message: `Simulated ${changeType} for ${regulationId}`,
          changeData: simulatedChange,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Manual trigger for regulation updates (from console)
    // WebSocket subscription management
    this.app.post('/api/subscribe/:regulationId', (req, res) => {
      const { regulationId } = req.params;
      const { clientId } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: 'clientId required' });
      }

      try {
        if (this.deliveryEngine) {
          this.deliveryEngine.addSubscription(regulationId, clientId);
          res.json({
            success: true,
            message: `Subscribed client ${clientId} to ${regulationId}`,
            regulationId,
            clientId,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({ error: 'Delivery engine not ready' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.delete('/api/subscribe/:regulationId/:clientId', (req, res) => {
      const { regulationId, clientId } = req.params;
      
      try {
        if (this.deliveryEngine) {
          this.deliveryEngine.removeSubscription(regulationId, clientId);
          res.json({
            success: true,
            message: `Unsubscribed client ${clientId} from ${regulationId}`,
            regulationId,
            clientId,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(503).json({ error: 'Delivery engine not ready' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/trigger-update', async (req, res) => {
      const { regulationId = 'REG-66', changeType = 'MANUAL_PUSH', message = 'Manual update triggered' } = req.body;
      
      if (!this.deliveryEngine) {
        return res.status(503).json({ 
          error: 'Delivery engine not ready',
          timestamp: new Date().toISOString()
        });
      }

      try {
        console.log(`📤 Manual update triggered for ${regulationId} via console`);
        
        // ✅ CRITICAL: Use CDC's fetchRegulationState which includes FULL structured field extraction
        // This ensures we get: updatedContent, summary, requirements, filingDeadlines
        const regulationContent = await this.deliveryEngine.cdc.fetchRegulationState(regulationId);
        
        // Create a manual update event with COMPLETE USC TEXT for differential view
        const uscFullText = regulationContent.fullText || regulationContent.content || '';
        
        // For EdSteward differential view, we need COMPLETE text in both fields
        // originalContent = current USC text, updatedContent = same text with simulated changes
        const simulatedUpdate = uscFullText.replace(
          'Notwithstanding the provisions of section 106',
          'Notwithstanding the provisions of section 106 and the enhanced digital learning provisions'
        );
        
        const updateData = {
          regulationId,
          changeType,
          message,
          timestamp: new Date().toISOString(),
          source: 'console_manual_trigger',
          data: {
            before: { 
              content: regulationContent.fullText || regulationContent.content, // ✅ CRITICAL: Prioritize fullText (13K+ chars) over content (86 chars)
              fullText: regulationContent.fullText || regulationContent.content, // Alias for compatibility
              version: (regulationContent.version || 'unknown').replace(/\.\d+$/, '.0') // Previous version
            },
            after: {
              ...regulationContent,
              content: regulationContent.fullText || regulationContent.content, // ✅ CRITICAL: Prioritize fullText for complete regulation text
              fullText: regulationContent.fullText || regulationContent.content, // Alias for compatibility
              message: `${message} - Updated via MCP Engine with complete regulation text`
            },
            contentHash: 'manual_' + Date.now()
          }
        };

        // Trigger the delivery engine by emitting a content change event through the CDC
        await this.deliveryEngine.cdc.emit(REGULATION_EVENTS.CONTENT_CHANGED, updateData);
        
        // Get current status for response
        const status = this.deliveryEngine.getStatus();
        const realVersion = regulationContent.version || 'unknown';
        
        // ✅ NEW: Also send to EdSteward directly for moravian.edsteward.ai
        let edstewardResult = null;
        if (this.edstewardIntegration) {
          try {
            console.log(`📤 Sending update to EdSteward for ${regulationId}...`);
            edstewardResult = await this.edstewardIntegration.sendRegulationUpdate({
              regulationId,
              name: regulationContent.name || regulationId,
              data: {
                content: regulationContent.fullText || regulationContent.content,
                summary: regulationContent.summary,
                requirements: regulationContent.requirements,
                filingDeadlines: regulationContent.filingDeadlines
              },
              changeType: changeType,
              timestamp: new Date().toISOString()
            });
            console.log(`✅ EdSteward delivery result:`, edstewardResult.success ? 'SUCCESS' : 'FAILED');
          } catch (edstewardError) {
            console.error(`⚠️ EdSteward delivery failed (non-blocking):`, edstewardError.message);
            edstewardResult = { success: false, error: edstewardError.message };
          }
        }
        
        // ✅ CRITICAL: Return COMPLETE regulation data for validation
        res.json({
          success: true,
          message: `Manual update triggered for ${regulationId}`,
          regulationId,
          version: realVersion,
          updateId: updateData.data.contentHash,
          clientsNotified: status?.regulations?.[regulationId]?.connectedClients || 0,
          timestamp: new Date().toISOString(),
          // ✅ NEW: Include complete regulation data for validation and inspection
          regulationData: updateData.data.after,
          // ✅ NEW: Include EdSteward delivery result
          edstewardDelivery: edstewardResult
        });
        
      } catch (error) {
        console.error('❌ Manual trigger error:', error);
        res.status(500).json({
          error: error.message,
          regulationId,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  async start() {
    try {
      // Create EdSteward integration (optional)
      this.edstewardIntegration = new EdStewardIntegration({
        edstewardUrl: process.env.EDSTEWARD_URL || 'http://localhost:3000',
        apiKey: process.env.EDSTEWARD_API_KEY,
        username: process.env.EDSTEWARD_USERNAME,
        password: process.env.EDSTEWARD_PASSWORD
      });
      console.log('✅ [START] EdSteward integration created (optional service)');

      // Test EdSteward connection in background (don't wait for it)
      setImmediate(async () => {
        console.log('🔧 [BACKGROUND] Testing EdSteward connection...');
      try {
          const connected = await this.edstewardIntegration.testConnection();
          if (connected) {
            console.log('✅ [BACKGROUND] EdSteward connection successful');
          } else {
            console.log('⚠️ [BACKGROUND] EdSteward not available - delivery system running independently');
          }
      } catch (error) {
          console.log('⚠️ [BACKGROUND] EdSteward connection failed - delivery system running independently');
      }
      });

      console.log('🔧 [START] Creating delivery engine...');
      // Initialize delivery engine
      this.deliveryEngine = new RegulationDeliveryEngine(this.server);
      console.log('✅ [START] Delivery engine created');
      
      console.log('🔧 [START] Setting up event handlers...');
      // Set up delivery engine event handlers
      this.deliveryEngine.on(REGULATION_EVENTS.SYSTEM_READY, (data) => {
        console.log('🎯 Delivery system ready:', data);
      });

      this.deliveryEngine.on(REGULATION_EVENTS.DELIVERY_CONFIRMED, async (data) => {
        console.log(`✅ Delivery confirmed for ${data.regulationId} (${data.clientsNotified} clients)`);
        
        // Send update to EdSteward when delivery is confirmed
        if (data.updateData) {
          try {
            const result = await this.edstewardIntegration.sendRegulationUpdate(data.updateData);
            if (result.success) {
              console.log(`📤 EdSteward notified: Update ID ${result.updateId}`);
            } else {
              console.error(`❌ EdSteward notification failed: ${result.error}`);
            }
          } catch (error) {
            console.error('❌ EdSteward integration error:', error.message);
          }
        }
      });

      this.deliveryEngine.on(REGULATION_EVENTS.PERFORMANCE_ALERT, (data) => {
        console.warn('⚠️ Performance alert:', data);
      });
      console.log('✅ [START] Event handlers set up');

      console.log('🔧 [START] Starting delivery engine...');
      // Start the delivery engine
      await this.deliveryEngine.start();
      console.log('✅ [START] Delivery engine started');
      
      console.log('🔧 [START] Starting HTTP server...');
      // Start HTTP server
      await new Promise((resolve, reject) => {
        const server = this.server.listen(this.port, (error) => {
          if (error) {
            reject(error);
          } else {
            console.log(`🚀 Regulation Delivery Server running on port ${this.port}`);
            console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}/regulation-updates`);
            console.log(`🔍 Health check: http://localhost:${this.port}/health`);
            console.log(`📋 WebSocket info: http://localhost:${this.port}/api/websocket-info`);
            resolve();
          }
        });
        
        server.on('error', (error) => {
          console.error('❌ [START] HTTP server error:', error);
          reject(error);
        });
      });
      
      console.log('✅ [START] HTTP server started successfully');

    } catch (error) {
      console.error('❌ [START] Failed to start delivery server:', error);
      console.error('❌ [START] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Fetch complete regulation content from MCP Engine
   */
  async fetchFullRegulationContent(regulationId) {
    try {
      console.log(`🔍 Fetching full content for ${regulationId} from MCP Engine...`);
      
      // Determine correct endpoints based on regulation type
      let uscEndpoint, cfrEndpoint, complianceEndpoint;
      
      // Endpoint mapping for REAL regulations that exist in the system
      if (regulationId.includes('osha') || regulationId.includes('emergency-action-plan') || regulationId.includes('safety') || regulationId.includes('REG-4580') || regulationId.includes('REG-1813')) {
        // OSHA regulations use BOTH USC (predominant) and CFR endpoints
        uscEndpoint = 'http://localhost:3004/api/llm/usc/29/651'; // Occupational Safety and Health Act
        cfrEndpoint = `http://localhost:3004/api/llm/cfr/${regulationId}`;
        complianceEndpoint = `http://localhost:3004/api/llm/compliance/${regulationId}`;
      } else if (regulationId.includes('REG-66') || regulationId.includes('reg-66') || regulationId.includes('teach') || regulationId.includes('technology-education-and-copyright-harmonization')) {
        // TEACH Act uses enhanced CFR endpoint with Federal Register integration
        uscEndpoint = 'http://localhost:3004/api/llm/usc/17/110';
        cfrEndpoint = 'http://localhost:3004/api/llm/cfr/enhanced/teach-act?federal_register=true';
        complianceEndpoint = 'http://localhost:3004/api/llm/compliance/teach-act';
      } else if (regulationId.includes('drug-free-schools') || regulationId.includes('REG-1807')) {
        // Drug-Free Schools and Communities Act (Item ID 1807)
        uscEndpoint = 'http://localhost:3004/api/llm/usc/20/1011i'; // Drug-Free Schools USC
        cfrEndpoint = `http://localhost:3004/api/llm/cfr/drug-free-schools`;
        complianceEndpoint = `http://localhost:3004/api/llm/compliance/drug-free-schools`;
      } else if (regulationId.includes('age-discrimination') || regulationId.includes('REG-1785')) {
        // Age Discrimination Act of 1975 (Item ID 1785)
        uscEndpoint = 'http://localhost:3004/api/llm/usc/42/6101'; // Age Discrimination USC
        cfrEndpoint = `http://localhost:3004/api/llm/cfr/age-discrimination`;
        complianceEndpoint = `http://localhost:3004/api/llm/compliance/age-discrimination`;
      } else if (regulationId.includes('americans-with-disabilities') || regulationId.includes('REG-1786')) {
        // Americans with Disabilities Act of 1990 (Item ID 1786)
        uscEndpoint = 'http://localhost:3004/api/llm/usc/42/12101'; // ADA USC
        cfrEndpoint = `http://localhost:3004/api/llm/cfr/ada`;
        complianceEndpoint = `http://localhost:3004/api/llm/compliance/ada`;
      } else if (regulationId.includes('higher-education-act-institutional') || regulationId.includes('REG-1982')) {
        // Higher Education Act: Institutional Information (Item ID 1982)
        uscEndpoint = 'http://localhost:3004/api/llm/usc/20/1092'; // HEA USC
        cfrEndpoint = `http://localhost:3004/api/llm/cfr/hea-institutional`;
        complianceEndpoint = `http://localhost:3004/api/llm/compliance/hea-institutional`;
      } else {
        // Generic fallback for unknown regulations
        uscEndpoint = null;
        cfrEndpoint = `http://localhost:3004/api/llm/cfr/${regulationId}`;
        complianceEndpoint = `http://localhost:3004/api/llm/compliance/${regulationId}`;
      }
      
      console.log(`🔍 Using endpoints - USC: ${uscEndpoint}, CFR: ${cfrEndpoint}, Compliance: ${complianceEndpoint}`);
      
      // Build fetch promises based on available endpoints
      const fetchPromises = [];
      
      if (uscEndpoint) {
        fetchPromises.push(fetch(uscEndpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }));
      } else {
        fetchPromises.push(Promise.resolve(null)); // No USC data
      }
      
      fetchPromises.push(fetch(cfrEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }));
      
      fetchPromises.push(fetch(complianceEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }));
      
      // Fetch all the regulation data components
      const [uscResponse, cfrResponse, complianceResponse, versioningResponse] = await Promise.all([
        ...fetchPromises,
        // Versioning Data
        fetch('http://localhost:3004/api/llm/versioning/system-info', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      // Parse all responses (handle null USC response)
      const [uscData, cfrData, complianceData, versioningData] = await Promise.all([
        uscResponse ? (uscResponse.ok ? uscResponse.json() : { error: 'USC fetch failed' }) : { data: null },
        cfrResponse.ok ? cfrResponse.json() : { error: 'CFR fetch failed' },
        complianceResponse.ok ? complianceResponse.json() : { error: 'Compliance fetch failed' },
        versioningResponse.ok ? versioningResponse.json() : { error: 'Versioning fetch failed' }
      ]);

      // Also run the LinearEngine workflow for comprehensive analysis
      const workflowResponse = await fetch('http://localhost:3004/api/llm/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Get comprehensive analysis for ${regulationId}`,
          options: { regulation: regulationId, realExecution: true }
        })
      });

      const workflowData = workflowResponse.ok ? await workflowResponse.json() : { error: 'Workflow fetch failed' };

      // Extract the appropriate regulation text based on regulation type
      let regulationFullText;
      
      if (regulationId.includes('osha') || regulationId.includes('emergency-action-plan') || regulationId.includes('safety') || regulationId.includes('REG-4580') || regulationId.includes('REG-1813')) {
        // For OSHA regulations, USC is predominant with CFR implementation details
        const uscContent = uscData?.data?.content || uscData?.content || uscData?.fullText || '';
        const cfrContent = cfrData?.data?.sections?.map(section => 
          `${section.section} ${section.title}: ${section.content}`
        ).join('\n\n') || cfrData?.content || cfrData?.fullText || '';
        
        // Combine with USC predominant
        if (uscContent && cfrContent) {
          regulationFullText = `${uscContent}\n\n--- IMPLEMENTATION DETAILS (CFR) ---\n\n${cfrContent}`;
        } else {
          regulationFullText = uscContent || cfrContent || complianceData?.content || 'OSHA regulation text not available';
        }
      } else if (regulationId.includes('REG-66') || regulationId.includes('reg-66') || regulationId.includes('teach') || regulationId.includes('technology-education-and-copyright-harmonization')) {
        // ✅ CRITICAL FIX: For TEACH Act, prioritize fullText field (13K+ chars) over content field (86 chars)
        regulationFullText = uscData?.data?.fullText || uscData?.fullText || uscData?.data?.content || uscData?.content || 'USC 17 Section 110 text not available';
      } else if (regulationId.includes('gdpr') || regulationId.includes('GDPR')) {
        // For GDPR, use compliance data (EU regulation)
        regulationFullText = complianceData?.content || complianceData?.data?.content || 'GDPR regulation text not available';
      } else if (regulationId.includes('hipaa') || regulationId.includes('HIPAA')) {
        // For HIPAA, combine USC and CFR with compliance
        const uscContent = uscData?.data?.content || uscData?.content || uscData?.fullText || '';
        const cfrContent = cfrData?.data?.sections?.map(section => 
          `${section.section} ${section.title}: ${section.content}`
        ).join('\n\n') || cfrData?.content || cfrData?.fullText || '';
        const complianceContent = complianceData?.content || complianceData?.data?.content || '';
        
        regulationFullText = [uscContent, cfrContent, complianceContent].filter(Boolean).join('\n\n--- SECTION BREAK ---\n\n') || 'HIPAA regulation text not available';
      } else if (regulationId.includes('ccpa') || regulationId.includes('CCPA')) {
        // For CCPA, use compliance data (state law)
        regulationFullText = complianceData?.content || complianceData?.data?.content || 'CCPA regulation text not available';
      } else if (regulationId.includes('title-ix') || regulationId.includes('REG-4001') || 
                 regulationId.includes('ferpa') || regulationId.includes('REG-4004') ||
                 regulationId.includes('ada') || regulationId.includes('REG-4003') || regulationId.includes('Acade-1701') ||
                 regulationId.includes('clery') || regulationId.includes('REG-4002')) {
        // For educational and civil rights regulations, combine USC and CFR
        const uscContent = uscData?.data?.content || uscData?.content || uscData?.fullText || '';
        const cfrContent = cfrData?.data?.sections?.map(section => 
          `${section.section} ${section.title}: ${section.content}`
        ).join('\n\n') || cfrData?.content || cfrData?.fullText || '';
        
        if (uscContent && cfrContent) {
          regulationFullText = `${uscContent}\n\n--- REGULATORY IMPLEMENTATION (CFR) ---\n\n${cfrContent}`;
        } else {
          regulationFullText = uscContent || cfrContent || complianceData?.content || `${regulationId} regulation text not available`;
        }
      } else if (regulationId.includes('Acade-1605') || regulationId.includes('REG-4007') ||
                 regulationId.includes('Acade-1636') || regulationId.includes('REG-4008') ||
                 regulationId.includes('Acade-1692') || regulationId.includes('REG-4006')) {
        // For Higher Education Act provisions, use USC with CFR implementation
        const uscContent = uscData?.data?.content || uscData?.content || uscData?.fullText || '';
        const cfrContent = cfrData?.data?.sections?.map(section => 
          `${section.section} ${section.title}: ${section.content}`
        ).join('\n\n') || cfrData?.content || cfrData?.fullText || '';
        
        regulationFullText = [uscContent, cfrContent].filter(Boolean).join('\n\n--- IMPLEMENTATION DETAILS ---\n\n') || complianceData?.content || `${regulationId} regulation text not available`;
      } else if (regulationId.includes('TEST-GDPR-DEMO')) {
        // For test regulations, use compliance data
        regulationFullText = complianceData?.content || complianceData?.data?.content || 'Test regulation content not available';
      } else {
        // Generic fallback for unknown regulations
        const cfrContent = cfrData?.data?.sections?.map(section => 
          `${section.section} ${section.title}: ${section.content}`
        ).join('\n\n') || cfrData?.content || cfrData?.fullText;
        regulationFullText = cfrContent || complianceData?.content || complianceData?.data?.content || `${regulationId} regulation text not available`;
      }
      
      console.log(`📋 Extracted regulation text (${regulationFullText.length} chars): ${regulationFullText.substring(0, 100)}...`);
      
      // Construct the complete regulation payload
      const fullContent = {
        regulationId,
        timestamp: new Date().toISOString(),
        version: versioningData?.data?.currentRegulation?.version || versioningData?.currentVersion || 'unknown',
        // Add fullText field for EdSteward differential view
        fullText: regulationFullText,
        content: regulationFullText, // Alias for compatibility
        components: {
          uscText: uscData,
          cfrGuidance: cfrData,
          complianceGuide: complianceData,
          versioningInfo: versioningData,
          workflowAnalysis: workflowData
        },
        summary: {
          title: `${regulationId} - TEACH Act Compliance Update`,
          impact: 'high',
          changeType: 'comprehensive_update',
          affectedAreas: ['copyright', 'fair_use', 'educational_exemptions'],
          message: 'Complete USC 17 Section 110 regulation text with real-time analysis'
        }
      };

      console.log(`✅ Successfully fetched full content for ${regulationId}`);
      return fullContent;

    } catch (error) {
      console.error(`❌ Failed to fetch full content for ${regulationId}:`, error.message);
      
      // Return a fallback payload with error information
      return {
        regulationId,
        timestamp: new Date().toISOString(),
        version: 'error',
        error: error.message,
        components: {},
        summary: {
          title: `${regulationId} - Content Fetch Error`,
          impact: 'low',
          changeType: 'error',
          message: `Failed to fetch regulation content: ${error.message}`
        }
      };
    }
  }

  async stop() {
    console.log('⏹️ Stopping delivery server...');
    
    if (this.deliveryEngine) {
      await this.deliveryEngine.stop();
    }
    
    this.server.close();
    console.log('✅ Delivery server stopped');
  }
}

export { DeliveryServer };

// Add comprehensive error handling
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION in delivery system:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION in delivery system:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

// Start the server if this file is run directly
// Check for PM2 environment OR direct execution
const isPM2 = process.env.PM2_HOME || process.env.pm_id !== undefined;
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('delivery-server.js') || 
  process.argv[1].includes('delivery-server.js')
);
const shouldStart = isPM2 || isDirectRun;

console.log('🔧 [DEBUG] Module check:');
console.log('  isPM2:', isPM2);
console.log('  isDirectRun:', isDirectRun);
console.log('  shouldStart:', shouldStart);

if (shouldStart) {
  console.log('🚀 [STARTUP] Delivery server starting...');
  console.log('🔧 [STARTUP] Process arguments:', process.argv);
  console.log('🔧 [STARTUP] Working directory:', process.cwd());
  console.log('🔧 [STARTUP] Node version:', process.version);
  
  const server = new DeliveryServer({
    port: process.env.DELIVERY_PORT || 3003  // EdSteward expects MCP WebSocket on 3003
  });
  
  console.log('🔧 [STARTUP] Server instance created, calling start()...');
  
  server.start().then(() => {
    console.log('✅ [STARTUP] Server started successfully, keeping process alive...');
    
    // Keep the process alive
    setInterval(() => {
      console.log('💚 [HEARTBEAT] Delivery system alive');
    }, 30000);
    
  }).catch(error => {
    console.error('❌ [STARTUP] Server startup failed:', error);
    console.error('❌ [STARTUP] Stack:', error.stack);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 [SHUTDOWN] Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 [SHUTDOWN] Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}
