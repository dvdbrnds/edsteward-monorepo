/**
 * LLM Service
 * Handles interactions with Language Learning Models
 */
import { LLMServiceInterface } from '../interfaces/service.js';
import { setupLogger } from '../../utils/logger.js';
import { ExternalServiceError } from '../../core/error-types.js';

export class LLMService extends LLMServiceInterface {
  constructor(dependencies = {}) {
    super(dependencies);
    this.logger = setupLogger('llm-service');
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.mockMode = !this.openaiApiKey;
    
    if (this.mockMode) {
      this.logger.warn('No OpenAI API key found, using mock responses');
    }
  }

  /**
   * Send query to LLM
   */
  async query(prompt, options = {}) {
    try {
      if (this.mockMode) {
        return this._generateMockResponse(prompt, options);
      }
      
      return await this._callOpenAI(prompt, options);
    } catch (error) {
      this.handleError(error, 'query', { promptLength: prompt.length, options });
    }
  }

  /**
   * Analyze text for compliance
   */
  async analyzeCompliance(text, regulations) {
    try {
      const prompt = this._createCompliancePrompt(text, regulations);
      const response = await this.query(prompt, { temperature: 0.3 });
      
      return this._parseComplianceResponse(response);
    } catch (error) {
      this.handleError(error, 'analyzeCompliance', { 
        textLength: text.length, 
        regulationsCount: regulations.length 
      });
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(analysisData) {
    try {
      const prompt = this._createReportPrompt(analysisData);
      const response = await this.query(prompt, { temperature: 0.2 });
      
      return this._formatReport(response);
    } catch (error) {
      this.handleError(error, 'generateReport', { analysisData });
    }
  }

  /**
   * Check if LLM service is available
   */
  async isAvailable() {
    try {
      if (this.mockMode) {
        return true; // Mock is always available
      }
      
      // Test with a simple query
      const testResponse = await this.query('Test connection', { maxTokens: 10 });
      return !!testResponse;
    } catch (error) {
      this.logger.error('LLM service availability check failed:', error.message);
      return false;
    }
  }

  // Private methods

  async _callOpenAI(prompt, options = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert compliance assistant for educational institutions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0
        })
      });

      if (!response.ok) {
        throw new ExternalServiceError('OpenAI', `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new ExternalServiceError('OpenAI', 'No response choices returned');
      }

      return data.choices[0].message.content;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('OpenAI', error.message);
    }
  }

  _generateMockResponse(prompt, options = {}) {
    // Analyze prompt to generate contextual mock response
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('ferpa')) {
      return this._getMockFERPAResponse();
    }
    
    if (promptLower.includes('ada') || promptLower.includes('accessibility')) {
      return this._getMockADAResponse();
    }
    
    if (promptLower.includes('hipaa') || promptLower.includes('health')) {
      return this._getMockHIPAAResponse();
    }
    
    if (promptLower.includes('compliant')) {
      return this._getMockComplianceAnalysis();
    }
    
    // Default mock response
    return this._getDefaultMockResponse(prompt);
  }

  _getMockFERPAResponse() {
    return `Based on FERPA (Family Educational Rights and Privacy Act) requirements:

**Compliance Analysis:**
- COMPLIANT: Partially
- CONFIDENCE: 0.75

**Key Requirements:**
1. Student records must be protected and not disclosed without consent
2. Parents/eligible students have right to inspect records
3. Directory information disclosure requires proper notice
4. Education officials need legitimate educational interest

**Issues Identified:**
- Privacy policy may need strengthening for student data protection
- Consent mechanisms should be more explicit
- Data retention policies need clarification

**Recommendations:**
1. Implement explicit FERPA consent forms
2. Update privacy policy to clearly address student records
3. Establish clear data retention and deletion procedures
4. Train staff on FERPA compliance requirements`;
  }

  _getMockADAResponse() {
    return `Based on ADA (Americans with Disabilities Act) requirements:

**Compliance Analysis:**
- COMPLIANT: Yes
- CONFIDENCE: 0.85

**Key Requirements Met:**
1. Physical accessibility accommodations
2. Digital accessibility standards (WCAG 2.1 AA)
3. Reasonable accommodations process
4. Non-discrimination policies

**Recommendations:**
1. Regular accessibility audits
2. Staff training on accommodation procedures
3. Continuous monitoring of digital accessibility`;
  }

  _getMockHIPAAResponse() {
    return `Based on HIPAA (Health Insurance Portability and Accountability Act):

**Compliance Analysis:**
- COMPLIANT: No
- CONFIDENCE: 0.90

**Critical Issues:**
- Health information handling procedures insufficient
- Missing business associate agreements
- Inadequate security safeguards

**Required Actions:**
1. Implement HIPAA-compliant data handling procedures
2. Execute business associate agreements with vendors
3. Establish physical and technical safeguards
4. Provide HIPAA training to all staff handling health information`;
  }

  _getMockComplianceAnalysis() {
    return `**Compliance Analysis Results:**

COMPLIANT: Partially
CONFIDENCE: 0.78

**Areas of Compliance:**
- Basic privacy protections in place
- Some data handling procedures established
- General non-discrimination policies present

**Issues Identified:**
- Data retention policies need refinement
- Third-party vendor agreements require review
- Staff training documentation incomplete

**Recommendations:**
1. Conduct comprehensive compliance audit
2. Update vendor agreements with compliance clauses
3. Implement regular staff training program
4. Establish compliance monitoring procedures`;
  }

  _getDefaultMockResponse(prompt) {
    const topics = ['privacy', 'accessibility', 'data protection', 'non-discrimination'];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    
    return `I've analyzed your query regarding ${randomTopic} compliance.

**Analysis Summary:**
- Overall compliance status: Needs attention
- Confidence level: 0.72
- Priority areas identified: 3

**Key Findings:**
1. Current policies provide basic framework
2. Implementation procedures need strengthening
3. Documentation could be more comprehensive

**Next Steps:**
1. Review and update relevant policies
2. Implement monitoring procedures
3. Provide staff training
4. Schedule regular compliance reviews

Note: This is a mock response for testing purposes. Please consult with compliance experts for actual regulatory guidance.`;
  }

  _createCompliancePrompt(text, regulations) {
    const regulationContext = regulations.map(reg => 
      `${reg.name} (${reg.category}): ${reg.description}`
    ).join('\n');

    return `Analyze the following content for compliance with these regulations:

REGULATIONS:
${regulationContext}

CONTENT TO ANALYZE:
${text}

Please provide a detailed compliance analysis including:
1. Overall compliance status (Compliant/Non-compliant/Partially compliant)
2. Confidence level (0.0-1.0)
3. Specific issues identified
4. Actionable recommendations
5. Priority level for any required changes

Format your response clearly with sections for each element.`;
  }

  _createReportPrompt(analysisData) {
    return `Generate a comprehensive compliance report based on this analysis data:

${JSON.stringify(analysisData, null, 2)}

The report should include:
1. Executive Summary
2. Detailed Findings
3. Risk Assessment
4. Recommendations with timelines
5. Implementation priorities

Format the report professionally for institutional review.`;
  }

  _parseComplianceResponse(response) {
    try {
      // Extract structured data from LLM response
      const analysis = response;
      
      // Parse compliance status
      const complianceMatch = response.match(/compliant[:\s]*(yes|no|partially)/i);
      const compliant = complianceMatch ? complianceMatch[1].toLowerCase() : 'unknown';
      
      // Parse confidence
      const confidenceMatch = response.match(/confidence[:\s]*([\d.]+)/i);
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;
      
      // Extract key points (simple implementation)
      const keyPoints = this._extractKeyPoints(response);
      
      // Extract action items
      const actionItems = this._extractActionItems(response);
      
      return {
        analysis: response,
        compliant: compliant === 'yes',
        partiallyCompliant: compliant === 'partially',
        confidence,
        keyPoints,
        actionItems
      };
    } catch (error) {
      this.logger.error('Error parsing compliance response:', error.message);
      return {
        analysis: response,
        compliant: false,
        confidence: 0.5,
        keyPoints: [],
        actionItems: []
      };
    }
  }

  _extractKeyPoints(text) {
    // Simple extraction of bullet points or numbered items
    const lines = text.split('\n');
    const keyPoints = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[•\-\*\d+\.]/)) {
        keyPoints.push(trimmed.replace(/^[•\-\*\d+\.\s]+/, ''));
      }
    }
    
    return keyPoints.slice(0, 10); // Limit to 10 key points
  }

  _extractActionItems(text) {
    // Look for recommendation sections
    const recommendationSection = text.match(/recommendations?:(.*?)(?:\n\n|\n[A-Z]|$)/is);
    if (!recommendationSection) return [];
    
    const recommendations = recommendationSection[1];
    return this._extractKeyPoints(recommendations);
  }

  _formatReport(response) {
    return {
      reportContent: response,
      generatedAt: new Date().toISOString(),
      format: 'markdown',
      sections: this._identifyReportSections(response)
    };
  }

  _identifyReportSections(text) {
    const sections = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.match(/^#{1,3}\s+/)) {
        sections.push({
          title: line.replace(/^#{1,3}\s+/, ''),
          level: (line.match(/^#{1,3}/) || [''])[0].length
        });
      }
    }
    
    return sections;
  }
} 