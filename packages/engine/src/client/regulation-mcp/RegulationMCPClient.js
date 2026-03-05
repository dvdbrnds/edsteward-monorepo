/**
 * RegulationMCPClient
 * 
 * Client-side module for interacting with Regulation MCP servers
 * through the registry
 */

import axios from 'axios';

/**
 * Client for interacting with the Regulation Registry API
 */
class RegulationMCPClient {
  constructor(baseURL = 'http://localhost:3010') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch all regulations from the registry
   * @returns {Promise<Array>} Array of regulation objects
   */
  async getRegulations() {
    try {
      const response = await this.client.get('/api/regulations');
      return response.data;
    } catch (error) {
      console.error('Error fetching regulations:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific regulation by ID
   * @param {string} regulationId - The ID of the regulation to fetch
   * @returns {Promise<Object>} The regulation object
   */
  async getRegulation(regulationId) {
    try {
      const response = await this.client.get(`/api/regulations/${regulationId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching regulation ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new regulation or update existing ones
   * @param {Object|Array} regulations - Single regulation object or array of regulations
   * @returns {Promise<Object>} Response with IDs of added/updated regulations
   */
  async addRegulations(regulations) {
    try {
      const response = await this.client.post('/api/regulations', regulations);
      return response.data;
    } catch (error) {
      console.error('Error adding regulations:', error);
      throw error;
    }
  }

  /**
   * Update an existing regulation
   * @param {string} regulationId - The ID of the regulation to update
   * @param {Object} regulationData - Updated regulation data
   * @returns {Promise<Object>} The updated regulation
   */
  async updateRegulation(regulationId, regulationData) {
    try {
      const response = await this.client.put(`/api/regulations/${regulationId}`, regulationData);
      return response.data;
    } catch (error) {
      console.error(`Error updating regulation ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a regulation
   * @param {string} regulationId - The ID of the regulation to delete
   * @returns {Promise<Object>} Confirmation message
   */
  async deleteRegulation(regulationId) {
    try {
      const response = await this.client.delete(`/api/regulations/${regulationId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting regulation ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Query a regulation
   * @param {string} regulationId - The ID of the regulation to query
   * @param {string} query - The query text
   * @returns {Promise<Object>} The query response
   */
  async queryRegulation(regulationId, query) {
    try {
      const response = await this.client.post(`/api/regulations/${regulationId}/query`, { query });
      return response.data;
    } catch (error) {
      console.error(`Error querying regulation ${regulationId}:`, error);
      throw error;
    }
  }

  /**
   * Collect data for a regulation
   * @param {string} regulationId - The ID of the regulation to collect data for
   * @param {Array<string>} urls - Array of source URLs
   * @returns {Promise<Object>} Status of the data collection job
   */
  async collectData(regulationId, urls) {
    try {
      // This would be implemented in a real system
      // For now, we'll simulate a successful response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update the regulation status to show data collection is in progress
      await this.updateRegulation(regulationId, { status: 'Collecting' });
      
      // After some time, update to completed
      setTimeout(async () => {
        try {
          await this.updateRegulation(regulationId, { status: 'Active' });
        } catch (err) {
          console.error('Error updating regulation status after collection:', err);
        }
      }, 5000);
      
      return {
        message: 'Data collection started successfully',
        regulationId,
        urls,
        jobId: `job_${Date.now()}`
      };
    } catch (error) {
      console.error(`Error collecting data for regulation ${regulationId}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
const regulationClient = new RegulationMCPClient();
export default regulationClient; 