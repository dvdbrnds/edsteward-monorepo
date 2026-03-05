const SourceCollector = require('./SourceCollector');
const axios = require('axios');

/**
 * Collector for regulations from the Federal Register
 * Uses the official API to get authoritative regulation content
 */
class FederalRegisterCollector extends SourceCollector {
  constructor(config = {}) {
    super({
      name: 'Federal Register Collector',
      baseUrl: 'https://www.federalregister.gov/api/v1',
      sourceAuthority: 'Office of the Federal Register',
      refreshInterval: 24 * 60 * 60 * 1000, // Daily
      ...config
    });
    
    this.apiKey = config.apiKey || process.env.FEDERAL_REGISTER_API_KEY;
    this.documentTypes = config.documentTypes || ['RULE', 'NOTICE'];
    this.agencies = config.agencies || [];
    this.fields = [
      'title',
      'document_number',
      'publication_date',
      'agencies',
      'regulation_id_numbers',
      'docket_ids',
      'effective_on',
      'abstract',
      'action',
      'dates',
      'full_text_xml_url',
      'html_url',
      'pdf_url'
    ];
  }

  /**
   * Initialize the collector
   */
  async initialize() {
    await super.initialize();
    
    if (!this.apiKey && process.env.NODE_ENV === 'production') {
      console.warn('No Federal Register API key provided. Rate limits may apply.');
    }
    
    // Test connection to the Federal Register API
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      console.error('Failed to initialize Federal Register collector:', error);
      return false;
    }
  }

  /**
   * Test the connection to the Federal Register API
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/documents.json`, {
        params: {
          per_page: 1
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Federal Register API returned status ${response.status}`);
      }
      
      console.log('Successfully connected to Federal Register API');
      return true;
    } catch (error) {
      console.error('Error connecting to Federal Register API:', error);
      throw error;
    }
  }

  /**
   * Fetch regulations from the Federal Register
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Regulations
   */
  async fetchRegulations(options = {}) {
    try {
      const params = {
        per_page: options.perPage || 20,
        page: options.page || 1,
        order: options.order || 'newest',
        fields: this.fields.join(','),
        document_type: this.documentTypes.join(',')
      };
      
      // Add agencies filter if specified
      if (this.agencies.length > 0) {
        params.agencies = this.agencies.join(',');
      }
      
      // Add date range if specified
      if (options.startDate) {
        params.publication_date_gte = options.startDate;
      }
      
      if (options.endDate) {
        params.publication_date_lte = options.endDate;
      }
      
      // Add API key if available
      if (this.apiKey) {
        params.api_key = this.apiKey;
      }
      
      // Add additional query parameters
      if (options.query) {
        params.conditions_term = options.query;
      }
      
      // Add RIN filter if specified
      if (options.regulationIdNumber) {
        params.regulation_id_number = options.regulationIdNumber;
      }
      
      const response = await axios.get(`${this.baseUrl}/documents.json`, {
        params
      });
      
      if (response.status !== 200) {
        throw new Error(`Federal Register API returned status ${response.status}`);
      }
      
      const regulations = response.data.results.map(result => this.processRegulation(result));
      
      this.lastFetchTime = new Date().toISOString();
      
      return regulations;
    } catch (error) {
      console.error('Error fetching regulations from Federal Register:', error);
      throw error;
    }
  }

  /**
   * Process a regulation from the Federal Register
   * @param {Object} rawRegulation - Raw regulation data
   * @returns {Object} Processed regulation
   */
  processRegulation(rawRegulation) {
    // Map Federal Register fields to our standard format
    return {
      regulationId: rawRegulation.document_number,
      name: rawRegulation.title,
      description: rawRegulation.abstract || '',
      version: rawRegulation.publication_date,
      effectiveDate: rawRegulation.effective_on,
      publishDate: rawRegulation.publication_date,
      agencies: rawRegulation.agencies.map(agency => agency.name),
      regulationIdNumbers: rawRegulation.regulation_id_numbers || [],
      docketIds: rawRegulation.docket_ids || [],
      documentType: rawRegulation.type,
      action: rawRegulation.action || '',
      dates: rawRegulation.dates || '',
      content: {
        fullTextXmlUrl: rawRegulation.full_text_xml_url,
        htmlUrl: rawRegulation.html_url,
        pdfUrl: rawRegulation.pdf_url
      },
      sourceAuthority: this.sourceAuthority,
      sourceUrl: rawRegulation.html_url,
      fetchTime: new Date().toISOString(),
      collector: this.name
    };
  }

  /**
   * Fetch a specific regulation by document number
   * @param {string} documentNumber - The document number to fetch
   * @returns {Promise<Object>} The regulation
   */
  async fetchRegulationByDocumentNumber(documentNumber) {
    try {
      const response = await axios.get(`${this.baseUrl}/documents/${documentNumber}.json`, {
        params: {
          fields: this.fields.join(',')
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Federal Register API returned status ${response.status}`);
      }
      
      return this.processRegulation(response.data);
    } catch (error) {
      console.error(`Error fetching regulation ${documentNumber} from Federal Register:`, error);
      throw error;
    }
  }

  /**
   * Fetch the full text of a regulation
   * @param {string} documentNumber - The document number
   * @param {string} format - The format to fetch (xml, html, pdf)
   * @returns {Promise<string>} The full text
   */
  async fetchFullText(documentNumber, format = 'html') {
    try {
      const regulation = await this.fetchRegulationByDocumentNumber(documentNumber);
      
      let url;
      switch (format.toLowerCase()) {
        case 'xml':
          url = regulation.content.fullTextXmlUrl;
          break;
        case 'pdf':
          url = regulation.content.pdfUrl;
          break;
        case 'html':
        default:
          url = regulation.content.htmlUrl;
          break;
      }
      
      if (!url) {
        throw new Error(`No ${format} URL available for document ${documentNumber}`);
      }
      
      const response = await axios.get(url);
      
      if (response.status !== 200) {
        throw new Error(`Failed to fetch full text: status ${response.status}`);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching full text for ${documentNumber}:`, error);
      throw error;
    }
  }
}

module.exports = FederalRegisterCollector; 