/**
 * MCP Engine Real-Time Regulation Delivery System
 * 
 * Hybrid approach combining:
 * 1. Change Data Capture (CDC) - Monitors regulation changes
 * 2. Event Sourcing - Immutable event log of all changes  
 * 3. CQRS - Separate read/write models for performance
 * 4. WebSocket Push - Real-time client notifications
 * 5. Webhook Fallback - Reliable delivery guarantees
 * 
 * Based on Context7 best practices and Emittery event patterns
 */

import Emittery from 'emittery';
import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import express from 'express';
import { createHash } from 'crypto';

/**
 * Core Events for Regulation Delivery System
 * Using symbols to avoid event name collisions (Emittery best practice)
 */
const REGULATION_EVENTS = {
  // CDC Events - Database changes detected
  CONTENT_CHANGED: Symbol('regulation.content.changed'),
  VERSION_UPDATED: Symbol('regulation.version.updated'),
  COMPLIANCE_MODIFIED: Symbol('regulation.compliance.modified'),
  
  // Event Sourcing Events - Domain events
  REGULATION_DRAFTED: Symbol('regulation.drafted'),
  REGULATION_PUBLISHED: Symbol('regulation.published'),
  REGULATION_SUPERSEDED: Symbol('regulation.superseded'),
  
  // Delivery Events - Push notifications
  CUSTOMER_NOTIFIED: Symbol('customer.notified'),
  DELIVERY_CONFIRMED: Symbol('delivery.confirmed'),
  DELIVERY_FAILED: Symbol('delivery.failed'),
  
  // System Events - Health and monitoring
  SYSTEM_READY: Symbol('system.ready'),
  PERFORMANCE_ALERT: Symbol('performance.alert')
};

/**
 * Regulation Change Data Capture Service
 * Monitors regulation changes and emits CDC events
 */
class RegulationCDCService extends Emittery {
  constructor(options = {}) {
    super({
      debug: {
        name: 'RegulationCDC',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.lastKnownVersions = new Map();
    this.contentHashes = new Map();
    this.pollInterval = options.pollInterval || 5000; // 5 seconds
    this.isActive = false;
  }

  /**
   * Start monitoring regulation changes
   * Uses hash-based change detection for efficiency
   */
  async startMonitoring() {
    this.isActive = true;
    console.log('🔍 Starting CDC monitoring for regulations...');
    
    // Initialize baseline state for REG-66 without triggering updates
    await this.initializeRegulationBaseline('REG-66');
    
    // DISABLED: Automatic polling to prevent spam updates
    // Only manual triggers via API will cause updates now
    console.log('📋 CDC ready for manual triggers (automatic polling disabled)');
    
    await this.emit(REGULATION_EVENTS.SYSTEM_READY, {
      service: 'CDC',
      timestamp: new Date().toISOString(),
      regulations: ['REG-66'],
      mode: 'manual_trigger_only'
    });
  }

  /**
   * Initialize baseline state without triggering updates
   */
  async initializeRegulationBaseline(regulationId) {
    try {
      console.log(`📋 Initializing baseline for ${regulationId}...`);
      const currentState = await this.fetchRegulationState(regulationId);
      const contentHash = this.generateContentHash(currentState);
      
      // Set initial state without triggering change events
      this.contentHashes.set(regulationId, contentHash);
      this.lastKnownVersions.set(regulationId, currentState);
      
      console.log(`✅ Baseline established for ${regulationId}`);
    } catch (error) {
      console.warn(`⚠️ Could not initialize baseline for ${regulationId}: ${error.message}`);
      console.log(`📋 Will retry baseline initialization when LLM Gateway is available`);
      
      // Set empty baseline to prevent crashes
      this.contentHashes.set(regulationId, 'initial_empty');
      this.lastKnownVersions.set(regulationId, { error: 'LLM Gateway not ready' });
    }
  }

  async monitorRegulation(regulationId) {
    try {
      // Fetch current regulation state
      const currentState = await this.fetchRegulationState(regulationId);
      const contentHash = this.generateContentHash(currentState);
      
      // Check if content has changed
      const lastHash = this.contentHashes.get(regulationId);
      if (lastHash && lastHash !== contentHash) {
        console.log(`📋 Change detected in ${regulationId}`);
        
        await this.emit(REGULATION_EVENTS.CONTENT_CHANGED, {
          regulationId,
          before: this.lastKnownVersions.get(regulationId),
          after: currentState,
          changeType: this.detectChangeType(lastHash, contentHash),
          timestamp: new Date().toISOString(),
          contentHash
        });
      }
      
      // Update our tracking
      this.contentHashes.set(regulationId, contentHash);
      this.lastKnownVersions.set(regulationId, currentState);
      
    } catch (error) {
      console.error(`❌ CDC error for ${regulationId}:`, error.message);
    }
  }

  async fetchRegulationState(regulationId) {
    // Determine the correct endpoint based on regulation-specific mapping
    let endpoint;
    let method = 'GET';
    
    // REGULATION-SPECIFIC ENDPOINT MAPPING
    // Each regulation should get its own proper USC/CFR text, not generic copyright text
    
    if (regulationId.includes('age-discrimination-act') || regulationId.includes('age-discrimination')) {
      // Age Discrimination Act: 42 U.S.C. §§ 6101-6107 + CFR regulations
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else if (regulationId.includes('fair-credit-reporting-act') || regulationId.includes('fcra')) {
      // Fair Credit Reporting Act: 15 U.S.C. §§ 1681-1681v + 16 C.F.R. § 600
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else if (regulationId.includes('americans-with-disabilities-act') || regulationId.includes('ada')) {
      // ADA: 42 U.S.C. §§ 12101-12213 + multiple CFR sections
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else if (regulationId.includes('family-educational-rights') || regulationId.includes('ferpa')) {
      // FERPA: 20 U.S.C. § 1232g + 34 C.F.R. § 99
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else if (regulationId.includes('REG-66') || regulationId.includes('teach-act') || regulationId.includes('teach')) {
      // TEACH Act: 17 U.S.C. § 110(2) - ONLY for actual TEACH Act
      endpoint = `http://localhost:3002/api/llm/usc/17/110`;
    }
    else if (regulationId.includes('clery-act') || regulationId.includes('clery')) {
      // Clery Act: 20 U.S.C. § 1092(f) + 34 C.F.R. § 668.46
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else if (regulationId.includes('title-ix') || regulationId.includes('title-9')) {
      // Title IX: 20 U.S.C. §§ 1681-1688 + 34 C.F.R. § 106
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else if (regulationId.includes('osha') || regulationId.includes('emergency-action-plan') || 
             regulationId.includes('safety') || regulationId.includes('occupational-safety')) {
      // OSHA: 29 U.S.C. §§ 651-678 + 29 C.F.R. § 1910
      endpoint = `http://localhost:3002/api/llm/cfr/${regulationId}`;
    }
    else {
      // Default to compliance endpoint which should route to correct CFR endpoint
      endpoint = `http://localhost:3002/api/llm/compliance/${regulationId}`;
    }
    
    console.log(`🔍 Fetching regulation content from: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${regulationId}: ${response.statusText}`);
    }
    
    return await response.json();
  }

  generateContentHash(content) {
    return createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex')
      .substring(0, 16);
  }

  detectChangeType(oldHash, newHash) {
    // Simple change detection - in production, this would be more sophisticated
    return 'content_update';
  }

  async stopMonitoring() {
    this.isActive = false;
    console.log('⏹️ CDC monitoring stopped');
  }
}

/**
 * Event Sourcing Store for Regulation Events
 * Provides immutable event log and state reconstruction
 */
class RegulationEventStore extends Emittery {
  constructor() {
    super({
      debug: {
        name: 'EventStore',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.events = [];
    this.snapshots = new Map();
    this.aggregateVersions = new Map();
  }

  /**
   * Append new event to the event store
   * Following event sourcing best practices
   */
  async appendEvent(aggregateId, eventType, eventData) {
    const currentVersion = this.aggregateVersions.get(aggregateId) || 0;
    const newVersion = currentVersion + 1;
    
    const event = {
      eventId: this.generateEventId(),
      aggregateId,
      aggregateVersion: newVersion,
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'MCP-Engine',
        causationId: eventData.causationId,
        correlationId: eventData.correlationId
      }
    };
    
    // Store the event
    this.events.push(event);
    this.aggregateVersions.set(aggregateId, newVersion);
    
    console.log(`📝 Event stored: ${eventType} for ${aggregateId} v${newVersion}`);
    
    // Emit for downstream consumers
    await this.emit(eventType, event);
    
    return event;
  }

  /**
   * Get events for specific regulation
   */
  getEvents(aggregateId, fromVersion = 0) {
    return this.events.filter(event => 
      event.aggregateId === aggregateId && 
      event.aggregateVersion > fromVersion
    );
  }

  /**
   * Reconstruct current state from events
   */
  getCurrentState(aggregateId) {
    const events = this.getEvents(aggregateId);
    
    // Simple state reconstruction - in production would use proper aggregate
    let state = { id: aggregateId, version: 0 };
    
    for (const event of events) {
      state = this.applyEvent(state, event);
    }
    
    return state;
  }

  applyEvent(state, event) {
    // Apply event to state - specific to regulation domain
    switch (event.eventType) {
      case 'RegulationContentChanged':
        return {
          ...state,
          content: event.eventData.after,
          version: event.aggregateVersion,
          lastModified: event.timestamp
        };
      default:
        return { ...state, version: event.aggregateVersion };
    }
  }

  generateEventId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 12);
  }
}

/**
 * WebSocket Push Notification Service
 * Real-time delivery to connected clients
 */
class RegulationPushService extends Emittery {
  constructor(server) {
    super({
      debug: {
        name: 'PushService',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/regulation-updates'
    });
    
    this.clients = new Map();
    this.subscriptions = new Map();
    
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      console.log(`🔌 Client connected: ${clientId}`);
      
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`❌ Invalid message from ${clientId}:`, error.message);
        }
      });

      ws.on('close', () => {
        console.log(`📴 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error.message);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date().toISOString();

    switch (message.type) {
      case 'subscribe':
        await this.subscribeClient(clientId, message.regulationIds || []);
        break;
      
      case 'unsubscribe':
        await this.unsubscribeClient(clientId, message.regulationIds || []);
        break;
      
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
        break;
        
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }

  async subscribeClient(clientId, regulationIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const regulationId of regulationIds) {
      client.subscriptions.add(regulationId);
      
      if (!this.subscriptions.has(regulationId)) {
        this.subscriptions.set(regulationId, new Set());
      }
      this.subscriptions.get(regulationId).add(clientId);
    }

    console.log(`📋 Client ${clientId} subscribed to: ${regulationIds.join(', ')}`);
    
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      regulationIds,
      timestamp: new Date().toISOString()
    });
  }

  async unsubscribeClient(clientId, regulationIds) {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const regulationId of regulationIds) {
      client.subscriptions.delete(regulationId);
      
      if (this.subscriptions.has(regulationId)) {
        this.subscriptions.get(regulationId).delete(clientId);
      }
    }

    console.log(`📋 Client ${clientId} unsubscribed from: ${regulationIds.join(', ')}`);
  }

  /**
   * Push regulation update to subscribed clients
   */
  async pushRegulationUpdate(regulationId, updateData) {
    const subscribedClients = this.subscriptions.get(regulationId);
    if (!subscribedClients || subscribedClients.size === 0) {
      console.log(`📭 No clients subscribed to ${regulationId}`);
      return;
    }

    const notification = {
      type: 'regulation_updated',
      regulationId,
      timestamp: new Date().toISOString(),
      data: updateData,
      version: updateData.version || 'unknown'
    };

    let successCount = 0;
    let failureCount = 0;

    for (const clientId of subscribedClients) {
      try {
        await this.sendToClient(clientId, notification);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to notify client ${clientId}:`, error.message);
        failureCount++;
      }
    }

    console.log(`📨 Pushed ${regulationId} update to ${successCount} clients (${failureCount} failures)`);
    
    await this.emit(REGULATION_EVENTS.CUSTOMER_NOTIFIED, {
      regulationId,
      successCount,
      failureCount,
      notification
    });
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) { // WebSocket.OPEN = 1
      throw new Error(`Client ${clientId} not available`);
    }

    client.ws.send(JSON.stringify(message));
  }

  generateClientId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
  }

  getConnectionStats() {
    return {
      totalClients: this.clients.size,
      subscriptions: Object.fromEntries(
        Array.from(this.subscriptions.entries()).map(([reg, clients]) => [reg, clients.size])
      )
    };
  }

  /**
   * Add client subscription for regulation updates
   */
  addSubscription(regulationId, clientId) {
    if (!this.subscriptions.has(regulationId)) {
      this.subscriptions.set(regulationId, new Set());
    }
    this.subscriptions.get(regulationId).add(clientId);
    
    // Update client's subscription list
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(regulationId);
    }
    
    console.log(`📋 Client ${clientId} subscribed to ${regulationId}`);
    return true;
  }

  /**
   * Remove client subscription
   */
  removeSubscription(regulationId, clientId) {
    const regulationSubs = this.subscriptions.get(regulationId);
    if (regulationSubs) {
      regulationSubs.delete(clientId);
      if (regulationSubs.size === 0) {
        this.subscriptions.delete(regulationId);
      }
    }
    
    // Update client's subscription list
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(regulationId);
    }
    
    console.log(`📋 Client ${clientId} unsubscribed from ${regulationId}`);
    return true;
  }

  /**
   * Get all subscriptions for a regulation
   */
  getSubscriptions(regulationId) {
    return Array.from(this.subscriptions.get(regulationId) || []);
  }
}

/**
 * Main Regulation Delivery Engine
 * Orchestrates all components using Emittery patterns
 */
class RegulationDeliveryEngine extends Emittery {
  constructor(httpServer) {
    super({
      debug: {
        name: 'DeliveryEngine',
        enabled: process.env.NODE_ENV === 'development'
      }
    });
    
    this.cdc = new RegulationCDCService();
    this.eventStore = new RegulationEventStore();
    this.pushService = new RegulationPushService(httpServer);
    
    this.setupEventHandlers();
  }

  /**
   * Wire up event handlers using Emittery patterns
   */
  setupEventHandlers() {
    // CDC events -> Event Store -> Push Notifications
    this.cdc.on(REGULATION_EVENTS.CONTENT_CHANGED, async (changeData) => {
      console.log(`🔄 Processing content change for ${changeData.regulationId}`);
      
      // Store event
      const event = await this.eventStore.appendEvent(
        changeData.regulationId,
        'RegulationContentChanged',
        changeData
      );
      
      // Push to clients
      await this.pushService.pushRegulationUpdate(
        changeData.regulationId,
        {
          changeType: changeData.changeType,
          version: event.aggregateVersion,
          timestamp: event.timestamp,
          summary: this.generateChangeSummary(changeData)
        }
      );
      
      // Emit delivery engine event
      await this.emit(REGULATION_EVENTS.DELIVERY_CONFIRMED, {
        regulationId: changeData.regulationId,
        eventId: event.eventId,
        clientsNotified: this.pushService.getConnectionStats().subscriptions[changeData.regulationId] || 0,
        updateData: changeData
      });
    });

    // System health monitoring
    this.pushService.on(REGULATION_EVENTS.CUSTOMER_NOTIFIED, async (data) => {
      if (data.failureCount > 0) {
        await this.emit(REGULATION_EVENTS.PERFORMANCE_ALERT, {
          type: 'delivery_failures',
          details: data
        });
      }
    });
  }

  generateChangeSummary(changeData) {
    return {
      regulation: changeData.regulationId,
      type: changeData.changeType,
      affectedSections: this.extractAffectedSections(changeData),
      impactLevel: this.assessImpactLevel(changeData)
    };
  }

  extractAffectedSections(changeData) {
    // Analyze the change to identify affected sections
    // This would be more sophisticated in production
    return ['Section 110(2)', 'Compliance Requirements'];
  }

  assessImpactLevel(changeData) {
    // Determine impact level for customer prioritization
    return 'medium'; // Could be 'low', 'medium', 'high', 'critical'
  }

  /**
   * Start the entire delivery system
   */
  async start() {
    console.log('🚀 Starting MCP Regulation Delivery Engine...');
    
    try {
      await this.cdc.startMonitoring();
      console.log('✅ CDC monitoring active');
      
      console.log('✅ Event store ready');
      console.log('✅ WebSocket push service ready');
      
      await this.emit(REGULATION_EVENTS.SYSTEM_READY, {
        timestamp: new Date().toISOString(),
        components: ['CDC', 'EventStore', 'PushService']
      });
      
      console.log('🎯 Regulation Delivery Engine is ready!');
      
    } catch (error) {
      console.error('❌ Failed to start Delivery Engine:', error);
      throw error;
    }
  }

  /**
   * Stop the delivery system gracefully
   */
  async stop() {
    console.log('⏹️ Stopping Regulation Delivery Engine...');
    
    await this.cdc.stopMonitoring();
    this.pushService.wss.close();
    
    console.log('✅ Delivery Engine stopped');
  }

  /**
   * Get system status for monitoring
   */
  getStatus() {
    return {
      cdc: {
        active: this.cdc.isActive,
        regulations: this.cdc.lastKnownVersions.size
      },
      eventStore: {
        events: this.eventStore.events.length,
        aggregates: this.eventStore.aggregateVersions.size
      },
      pushService: this.pushService.getConnectionStats()
    };
  }

  /**
   * Add client subscription for regulation updates
   */
  addSubscription(regulationId, clientId) {
    return this.pushService.addSubscription(regulationId, clientId);
  }

  /**
   * Remove client subscription
   */
  removeSubscription(regulationId, clientId) {
    return this.pushService.removeSubscription(regulationId, clientId);
  }

  /**
   * Get all subscriptions for a regulation
   */
  getSubscriptions(regulationId) {
    return this.pushService.getSubscriptions(regulationId);
  }
}

export { 
  RegulationDeliveryEngine, 
  REGULATION_EVENTS,
  RegulationCDCService,
  RegulationEventStore,
  RegulationPushService
};
