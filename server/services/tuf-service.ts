import { TUFClient, RegulationTarget, TUFClientConfig } from '../tuf-client';
import WebSocket from 'ws';

export interface TUFServiceConfig extends TUFClientConfig {
  websocketUrl?: string;
  pollInterval?: number;
  autoConnect?: boolean;
}

export interface TUFRegulationUpdate {
  regulationId: string;
  content: any;
  metadata: any;
  hash: string;
  updateTime: string;
  verified: boolean;
  tufPath: string;
}

export class TUFService {
  private tufClient: TUFClient;
  private websocket: WebSocket | null = null;
  private websocketUrl: string;
  private pollInterval: number;
  private isPolling: boolean = false;
  private knownRegulations: Map<string, string> = new Map(); // regulationId -> hash
  
  constructor(config: TUFServiceConfig) {
    this.tufClient = new TUFClient(config);
    this.websocketUrl = config.websocketUrl || config.repositoryUrl.replace('http', 'ws').replace(':3052', ':3053');
    this.pollInterval = config.pollInterval || 30000; // 30 seconds default
    
    if (config.autoConnect) {
      this.initialize();
    }
  }

  /**
   * Initialize TUF service with trusted root metadata
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔒 Initializing TUF service...');
      
      // Get trusted root metadata from TUF repository
      const rootUrl = `${this.tufClient['repositoryUrl']}/metadata/root.json`;
      const response = await fetch(rootUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TUF root metadata: ${response.status}`);
      }

      const trustedRoot = await response.json();
      await this.tufClient.initialize(trustedRoot);
      
      // Initialize known regulations
      await this.updateKnownRegulations();
      
      // Set up WebSocket connection
      this.connectWebSocket();
      
      // Start polling for updates
      this.startPolling();
      
      console.log('✅ TUF service initialized successfully');
      
    } catch (error) {
      console.error('❌ TUF service initialization failed:', error);
      // Don't throw error - make it non-blocking so server can start
      console.log('⚠️  TUF service will be disabled - EdSteward will continue without MCP Engine integration');
    }
  }

  /**
   * Get all available regulations from TUF repository
   */
  async getAvailableRegulations(): Promise<RegulationTarget[]> {
    try {
      return await this.tufClient.checkForRegulationUpdates();
    } catch (error) {
      console.error('❌ Failed to get available regulations:', error);
      throw error;
    }
  }

  /**
   * Download and verify a specific regulation
   */
  async downloadRegulation(regulationId: string): Promise<TUFRegulationUpdate> {
    try {
      const regulation = await this.tufClient.downloadRegulation(regulationId);
      
      return {
        regulationId: regulation.regulationId,
        content: regulation.content,
        metadata: regulation.metadata,
        hash: regulation.hash,
        updateTime: regulation.updateTime,
        verified: regulation.verified || false,
        tufPath: regulation.path
      };
      
    } catch (error) {
      console.error(`❌ Failed to download regulation ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Check for regulation updates and return new/changed regulations
   */
  async checkForUpdates(): Promise<TUFRegulationUpdate[]> {
    try {
      const availableRegulations = await this.getAvailableRegulations();
      const updates: TUFRegulationUpdate[] = [];
      
      for (const regulation of availableRegulations) {
        const knownHash = this.knownRegulations.get(regulation.regulationId);
        
        // If this is a new regulation or the hash has changed
        if (!knownHash || knownHash !== regulation.hash) {
          console.log(`🔄 Detected update for regulation ${regulation.regulationId}`);
          
          try {
            const update = await this.downloadRegulation(regulation.regulationId);
            updates.push(update);
            
            // Update known regulations
            this.knownRegulations.set(regulation.regulationId, regulation.hash);
            
          } catch (downloadError) {
            console.error(`❌ Failed to download updated regulation ${regulation.regulationId}:`, downloadError);
          }
        }
      }
      
      return updates;
      
    } catch (error) {
      console.error('❌ Failed to check for regulation updates:', error);
      return [];
    }
  }

  /**
   * Set up WebSocket connection for real-time notifications
   */
  private connectWebSocket(): void {
    try {
      console.log(`🔌 Connecting to TUF WebSocket: ${this.websocketUrl}`);
      
      this.websocket = new WebSocket(this.websocketUrl);
      
      this.websocket.on('open', () => {
        console.log('✅ TUF WebSocket connected');
        // Subscribe to all regulation updates
        this.websocket?.send(JSON.stringify({ type: 'subscribe' }));
      });
      
      this.websocket.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📡 TUF WebSocket message received:', message);
          
          if (message.type === 'regulation_updated') {
            await this.handleRegulationUpdate(message.regulationId);
          }
          
        } catch (error) {
          console.error('❌ Failed to process TUF WebSocket message:', error);
        }
      });
      
      this.websocket.on('close', () => {
        console.log('📴 TUF WebSocket disconnected, attempting to reconnect...');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      });
      
      this.websocket.on('error', (error) => {
        console.error('❌ TUF WebSocket error:', error);
      });
      
    } catch (error) {
      console.error('❌ Failed to connect TUF WebSocket:', error);
      // Retry connection after 10 seconds
      setTimeout(() => this.connectWebSocket(), 10000);
    }
  }

  /**
   * Handle regulation update notification
   */
  private async handleRegulationUpdate(regulationId: string): Promise<void> {
    try {
      console.log(`🔄 Processing TUF regulation update: ${regulationId}`);
      
      const update = await this.downloadRegulation(regulationId);
      
      // Update known regulations
      this.knownRegulations.set(regulationId, update.hash);
      
      // Emit update event (can be listened to by EdSteward)
      this.emit('regulation_updated', update);
      
      console.log(`✅ Processed TUF regulation update: ${regulationId}`);
      
    } catch (error) {
      console.error(`❌ Failed to handle regulation update ${regulationId}:`, error);
    }
  }

  /**
   * Start polling for regulation updates
   */
  private startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log(`🔄 Starting TUF polling every ${this.pollInterval}ms`);
    
    const poll = async () => {
      if (!this.isPolling) return;
      
      try {
        const updates = await this.checkForUpdates();
        
        for (const update of updates) {
          this.emit('regulation_updated', update);
        }
        
      } catch (error) {
        console.error('❌ TUF polling error:', error);
      }
      
      // Schedule next poll
      if (this.isPolling) {
        setTimeout(poll, this.pollInterval);
      }
    };
    
    // Start first poll
    setTimeout(poll, 1000);
  }

  /**
   * Stop polling for updates
   */
  stopPolling(): void {
    this.isPolling = false;
    console.log('⏹️ TUF polling stopped');
  }

  /**
   * Update known regulations baseline
   */
  private async updateKnownRegulations(): Promise<void> {
    try {
      const regulations = await this.getAvailableRegulations();
      
      for (const regulation of regulations) {
        this.knownRegulations.set(regulation.regulationId, regulation.hash);
      }
      
      console.log(`📋 Updated baseline: ${this.knownRegulations.size} known regulations`);
      
    } catch (error) {
      console.error('❌ Failed to update known regulations:', error);
    }
  }

  /**
   * Get TUF repository health
   */
  async getHealth(): Promise<any> {
    try {
      return await this.tufClient.getRepositoryHealth();
    } catch (error) {
      console.error('❌ TUF health check failed:', error);
      throw error;
    }
  }

  /**
   * Simple event emitter for regulation updates
   */
  private listeners: { [event: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  private emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      for (const listener of this.listeners[event]) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`❌ Event listener error for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPolling();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.listeners = {};
    console.log('🧹 TUF service destroyed');
  }
}

// Singleton TUF service instance
let tufServiceInstance: TUFService | null = null;

/**
 * Get or create TUF service instance
 */
export function getTUFService(): TUFService {
  if (!tufServiceInstance) {
    const mcpEngineUrl = process.env.MCP_ENGINE_TUF_URL || 'http://localhost:3052';
    const websocketUrl = process.env.TUF_WEBSOCKET_URL || 'ws://localhost:3053';
    
    tufServiceInstance = new TUFService({
      repositoryUrl: mcpEngineUrl,
      websocketUrl: websocketUrl,
      autoConnect: true,
      pollInterval: 30000 // 30 seconds
    });
  }
  
  return tufServiceInstance;
}
