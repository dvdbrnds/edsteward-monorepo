// Browser-compatible TUF client for EdSteward frontend
import { BrowserTUFClient, RegulationTarget } from '../../../server/tuf-client';

export interface TUFClientConfig {
  repositoryUrl: string;
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

export class EdStewardTUFClient {
  private client: BrowserTUFClient;
  private initialized: boolean = false;

  constructor(config: TUFClientConfig) {
    this.client = new BrowserTUFClient(config);
  }

  /**
   * Initialize TUF client with trusted root metadata
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🔒 Initializing browser TUF client...');
      
      // Get trusted root metadata from TUF repository
      const rootUrl = `${this.client['repositoryUrl']}/metadata/root.json`;
      const response = await fetch(rootUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TUF root metadata: ${response.status}`);
      }

      const trustedRoot = await response.json();
      await this.client.initialize(trustedRoot);
      
      this.initialized = true;
      console.log('✅ Browser TUF client initialized successfully');
      
    } catch (error) {
      console.error('❌ Browser TUF client initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get all available regulations from TUF repository
   */
  async getAvailableRegulations(): Promise<RegulationTarget[]> {
    await this.ensureInitialized();
    return await this.client.checkForRegulationUpdates();
  }

  /**
   * Download and verify a specific regulation
   */
  async downloadRegulation(regulationId: string): Promise<TUFRegulationUpdate> {
    await this.ensureInitialized();
    
    const regulation = await this.client.downloadRegulation(regulationId);
    
    return {
      regulationId: regulation.regulationId,
      content: regulation.content,
      metadata: regulation.metadata,
      hash: regulation.hash,
      updateTime: regulation.updateTime,
      verified: regulation.verified || false,
      tufPath: regulation.path
    };
  }

  /**
   * Get TUF repository health
   */
  async getHealth(): Promise<any> {
    return await this.client.getRepositoryHealth();
  }

  /**
   * Ensure client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Singleton instance for the frontend
let tufClientInstance: EdStewardTUFClient | null = null;

/**
 * Get or create TUF client instance for frontend
 */
export function getTUFClient(): EdStewardTUFClient {
  if (!tufClientInstance) {
    const repositoryUrl = import.meta.env.VITE_TUF_REPOSITORY_URL || 'https://localhost:3052';
    
    tufClientInstance = new EdStewardTUFClient({
      repositoryUrl
    });
  }
  
  return tufClientInstance;
}

/**
 * React hook for TUF operations
 */
export function useTUF() {
  const client = getTUFClient();

  const getAvailableRegulations = async () => {
    try {
      return await client.getAvailableRegulations();
    } catch (error) {
      console.error('❌ Failed to get available regulations:', error);
      throw error;
    }
  };

  const downloadRegulation = async (regulationId: string) => {
    try {
      return await client.downloadRegulation(regulationId);
    } catch (error) {
      console.error(`❌ Failed to download regulation ${regulationId}:`, error);
      throw error;
    }
  };

  const getHealth = async () => {
    try {
      return await client.getHealth();
    } catch (error) {
      console.error('❌ TUF health check failed:', error);
      throw error;
    }
  };

  return {
    getAvailableRegulations,
    downloadRegulation,
    getHealth,
    client
  };
}
