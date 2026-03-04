/**
 * MCP Engine Real-Time Regulation Updates - Client Integration
 * Add this to your EdSteward frontend to receive regulation updates
 */

class MCPRegulationClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://localhost:3003/regulation-updates';
    this.regulations = options.regulations || ['REG-66'];
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    
    // Callbacks
    this.onUpdate = options.onUpdate || this.defaultUpdateHandler;
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || console.error;
  }

  connect() {
    try {
      console.log('🔗 Connecting to MCP regulation updates...');
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to MCP regulation delivery system');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to regulations
        this.subscribe(this.regulations);
        this.onConnect();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('📴 Disconnected from MCP regulation updates');
        this.isConnected = false;
        this.onDisconnect();
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ MCP regulation connection error:', error);
        this.onError(error);
      };
      
    } catch (error) {
      console.error('❌ Failed to connect to MCP regulation system:', error);
      this.onError(error);
    }
  }

  subscribe(regulationIds) {
    if (!this.isConnected) return;
    
    const message = {
      type: 'subscribe',
      regulationIds: Array.isArray(regulationIds) ? regulationIds : [regulationIds]
    };
    
    this.ws.send(JSON.stringify(message));
    console.log(`📋 Subscribed to regulations: ${message.regulationIds.join(', ')}`);
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log(`🔌 Connection confirmed, ID: ${message.clientId}`);
        break;
        
      case 'subscription_confirmed':
        console.log(`✅ Subscription confirmed: ${message.regulationIds.join(', ')}`);
        break;
        
      case 'regulation_updated':
        console.log('📋 Regulation update received:', message);
        this.onUpdate(message);
        break;
        
      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  defaultUpdateHandler(updateData) {
    // Default handler - customize this for your application
    console.log(`🚨 REGULATION UPDATE: ${updateData.regulationId}`);
    console.log(`   Version: ${updateData.version}`);
    console.log(`   Type: ${updateData.data.changeType}`);
    console.log(`   Impact: ${updateData.data.summary?.impactLevel || 'unknown'}`);
    
    // Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${updateData.regulationId} Updated`, {
        body: `New compliance requirements (${updateData.data.changeType})`,
        icon: '/favicon.ico'
      });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.isConnected = false;
  }
}

// Export for use in your application
if (typeof window !== 'undefined') {
  window.MCPRegulationClient = MCPRegulationClient;
}

// Example usage for EdSteward
function initializeMCPRegulations() {
  const regulationClient = new MCPRegulationClient({
    wsUrl: 'ws://localhost:3003/regulation-updates',
    regulations: ['REG-66'], // TEACH Act for educational institutions
    
    onUpdate: (updateData) => {
      // Custom handler for your EdSteward application
      handleRegulationUpdate(updateData);
    },
    
    onConnect: () => {
      console.log('🎯 EdSteward connected to MCP regulation system');
      showSystemNotification('Connected to regulation updates', 'success');
    },
    
    onDisconnect: () => {
      console.log('⚠️ EdSteward disconnected from regulation system');
      showSystemNotification('Regulation updates disconnected', 'warning');
    }
  });
  
  // Connect to the system
  regulationClient.connect();
  
  // Store globally for debugging
  window.regulationClient = regulationClient;
  
  return regulationClient;
}

function handleRegulationUpdate(updateData) {
  console.log('🏛️ Processing regulation update for institution...');
  
  // Extract update details
  const {
    regulationId,
    version,
    timestamp,
    data: { changeType, summary, after }
  } = updateData;
  
  // Show notification to compliance officers
  showComplianceAlert({
    title: `${regulationId} Regulation Updated`,
    message: after.message || `New ${changeType} requirements`,
    impact: after.impact || 'medium',
    institution: after.institution || 'ALL_INSTITUTIONS',
    effectiveDate: after.effectiveDate,
    timestamp: timestamp
  });
  
  // Update compliance dashboard
  updateComplianceDashboard(regulationId, {
    version,
    lastUpdate: timestamp,
    status: 'requires_review',
    impact: after.impact
  });
  
  // Trigger compliance workflow if high/critical impact
  if (after.impact === 'high' || after.impact === 'critical') {
    triggerComplianceWorkflow(regulationId, updateData);
  }
  
  // Log for audit trail
  logComplianceEvent({
    type: 'regulation_update_received',
    regulationId,
    version,
    changeType,
    impact: after.impact,
    timestamp
  });
}

function showComplianceAlert(alertData) {
  // Customize this for your EdSteward UI framework
  console.log('🚨 COMPLIANCE ALERT:', alertData);
  
  // Example: Show toast notification
  if (typeof showToast === 'function') {
    showToast({
      type: alertData.impact === 'critical' ? 'error' : 'warning',
      title: alertData.title,
      message: alertData.message,
      duration: alertData.impact === 'critical' ? 0 : 5000 // Critical alerts stay visible
    });
  }
  
  // Example: Update notification badge
  if (typeof updateNotificationBadge === 'function') {
    updateNotificationBadge('compliance', 1);
  }
}

function updateComplianceDashboard(regulationId, updateInfo) {
  // Update your compliance dashboard with new regulation status
  console.log(`📊 Updating dashboard for ${regulationId}:`, updateInfo);
  
  // Example implementation
  const dashboardElement = document.querySelector(`[data-regulation="${regulationId}"]`);
  if (dashboardElement) {
    dashboardElement.classList.add('requires-review');
    dashboardElement.querySelector('.last-update').textContent = 
      new Date(updateInfo.lastUpdate).toLocaleDateString();
    dashboardElement.querySelector('.status').textContent = 'Requires Review';
  }
}

function triggerComplianceWorkflow(regulationId, updateData) {
  console.log(`🔄 Triggering compliance workflow for ${regulationId}`);
  
  // Example: Create compliance task
  if (typeof createComplianceTask === 'function') {
    createComplianceTask({
      title: `Review ${regulationId} Updates`,
      description: updateData.data.after.message,
      priority: updateData.data.after.impact === 'critical' ? 'urgent' : 'high',
      dueDate: updateData.data.after.effectiveDate,
      assignedTo: 'compliance_team'
    });
  }
}

function logComplianceEvent(eventData) {
  // Log to your audit system
  console.log('📝 Compliance audit log:', eventData);
  
  // Example: Send to audit API
  if (typeof logAuditEvent === 'function') {
    logAuditEvent(eventData);
  }
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize MCP regulation client
    initializeMCPRegulations();
  });
}
