/**
 * Federal Register Executive Order Integration
 * 
 * Fetches and tracks Presidential Executive Orders from the Federal Register API
 * https://www.federalregister.gov/developers/documentation/api/v1
 */

import fetch from 'node-fetch';
import pg from 'pg';

const { Pool } = pg;

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

// Keywords that indicate higher education relevance
const HIGHER_ED_KEYWORDS = [
  'education', 'university', 'college', 'student', 'campus', 'title ix',
  'title vi', 'title vii', 'ferpa', 'clery', 'discrimination', 'civil rights',
  'dei', 'diversity', 'equity', 'inclusion', 'affirmative action', 'gender',
  'sex', 'transgender', 'immigration', 'visa', 'international student',
  'research', 'grants', 'federal funding', 'accreditation', 'financial aid',
  'hipaa', 'ada', 'disability', 'accessibility', 'free speech', 'first amendment'
];

class FederalRegisterEOService {
  constructor(options = {}) {
    this.pool = options.pool || new Pool({
      host: 'localhost',
      port: 5432,
      database: 'mcp_engine',
      user: process.env.PGUSER || process.env.USER,
    });
  }

  /**
   * Fetch recent executive orders from Federal Register
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Executive orders
   */
  async fetchRecentEOs(options = {}) {
    const {
      president = null,
      startDate = null,
      endDate = null,
      perPage = 100
    } = options;

    // Build URL with proper query string format for Federal Register API
    let url = `${FEDERAL_REGISTER_API}/documents.json?`;
    const params = [];
    
    params.push('conditions[type][]=PRESDOCU');
    params.push('conditions[presidential_document_type][]=executive_order');
    
    if (startDate) {
      params.push(`conditions[publication_date][gte]=${startDate}`);
    }
    if (endDate) {
      params.push(`conditions[publication_date][lte]=${endDate}`);
    }
    
    params.push(`per_page=${perPage}`);
    params.push('order=newest');
    params.push('fields[]=document_number');
    params.push('fields[]=title');
    params.push('fields[]=type');
    params.push('fields[]=abstract');
    params.push('fields[]=publication_date');
    params.push('fields[]=signing_date');
    params.push('fields[]=executive_order_number');
    params.push('fields[]=president');
    params.push('fields[]=html_url');
    params.push('fields[]=pdf_url');
    params.push('fields[]=citation');
    params.push('fields[]=executive_order_notes');
    
    url += params.join('&');
    
    console.log(`📡 Fetching EOs from Federal Register...`);

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Federal Register API error: ${response.status} - ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log(`   Found ${data.count} presidential documents`);
    
    // Filter to only actual executive orders (have EO number)
    const eos = data.results.filter(doc => doc.executive_order_number);
    console.log(`   ${eos.length} are numbered executive orders`);
    
    return eos;
  }

  /**
   * Fetch all Trump second term EOs (Jan 20, 2025 onwards)
   */
  async fetchTrumpSecondTermEOs() {
    return this.fetchRecentEOs({
      president: 'donald-trump',
      startDate: '2025-01-20',
      perPage: 200
    });
  }

  /**
   * Calculate relevance score for higher education
   */
  calculateRelevanceScore(eo) {
    const textToSearch = [
      eo.title || '',
      eo.abstract || '',
      eo.executive_order_notes || ''
    ].join(' ').toLowerCase();

    let score = 0;
    const matchedKeywords = [];

    for (const keyword of HIGHER_ED_KEYWORDS) {
      if (textToSearch.includes(keyword.toLowerCase())) {
        score += keyword.length > 10 ? 2 : 1; // Longer keywords worth more
        matchedKeywords.push(keyword);
      }
    }

    // Normalize to 0-1 scale
    const normalizedScore = Math.min(score / 10, 1);

    return {
      score: normalizedScore,
      matchedKeywords
    };
  }

  /**
   * Import EO into database
   */
  async importEO(eo) {
    const eoNumber = eo.executive_order_number 
      ? `EO ${eo.executive_order_number}`
      : eo.document_number;

    // Check if already exists
    const existing = await this.pool.query(
      'SELECT id FROM executive_orders WHERE eo_number = $1 OR federal_register_doc_number = $2',
      [eoNumber, eo.document_number]
    );

    if (existing.rows.length > 0) {
      console.log(`   ⏭️  ${eoNumber} already exists`);
      return { action: 'skipped', id: existing.rows[0].id };
    }

    // Calculate relevance
    const relevance = this.calculateRelevanceScore(eo);

    // Determine president/term
    let president = eo.president?.name || 'Unknown';
    let term = 'Unknown';
    
    const signingDate = new Date(eo.signing_date || eo.publication_date);
    if (president.toLowerCase().includes('trump')) {
      term = signingDate >= new Date('2025-01-20') ? 'Trump-2' : 'Trump-1';
    } else if (president.toLowerCase().includes('biden')) {
      term = 'Biden-1';
    }

    // Insert
    const result = await this.pool.query(`
      INSERT INTO executive_orders (
        eo_number, title, signed_date, published_date,
        federal_register_citation, federal_register_doc_number,
        summary, full_text_url, pdf_url,
        president, term, topics, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      eoNumber,
      eo.title,
      eo.signing_date || eo.publication_date,
      eo.publication_date,
      eo.citation,
      eo.document_number,
      eo.abstract,
      eo.html_url,
      eo.pdf_url,
      president,
      term,
      relevance.matchedKeywords.length > 0 ? relevance.matchedKeywords : null,
      'active'
    ]);

    console.log(`   ✅ Imported ${eoNumber}: ${eo.title.substring(0, 50)}...`);
    
    return { 
      action: 'imported', 
      id: result.rows[0].id,
      relevanceScore: relevance.score,
      matchedKeywords: relevance.matchedKeywords
    };
  }

  /**
   * Auto-link EO to potentially affected regulations
   */
  async autoLinkToRegulations(eoId) {
    // Get EO details
    const eoResult = await this.pool.query(
      'SELECT * FROM executive_orders WHERE id = $1',
      [eoId]
    );
    
    if (eoResult.rows.length === 0) return [];

    const eo = eoResult.rows[0];
    const searchText = [eo.title, eo.summary].join(' ').toLowerCase();

    // Find potentially affected regulations based on keywords
    const impacts = [];

    // Title IX related
    if (searchText.includes('title ix') || searchText.includes('sex') || 
        searchText.includes('gender') || searchText.includes('transgender') ||
        searchText.includes('women')) {
      const regs = await this.pool.query(
        "SELECT id, reg_key, name FROM regulations WHERE name ILIKE '%Title IX%' AND is_current = true"
      );
      for (const reg of regs.rows) {
        impacts.push({ regulation: reg, type: 'modifies', severity: 'high' });
      }
    }

    // Title VI/VII related  
    if (searchText.includes('civil rights') || searchText.includes('discrimination') ||
        searchText.includes('dei') || searchText.includes('diversity') ||
        searchText.includes('affirmative action')) {
      const regs = await this.pool.query(
        "SELECT id, reg_key, name FROM regulations WHERE (name ILIKE '%Title VI%' OR name ILIKE '%Title VII%' OR name ILIKE '%Civil Rights%') AND is_current = true"
      );
      for (const reg of regs.rows) {
        impacts.push({ regulation: reg, type: 'modifies', severity: 'high' });
      }
    }

    // Immigration/international students
    if (searchText.includes('immigration') || searchText.includes('visa') ||
        searchText.includes('international')) {
      const regs = await this.pool.query(
        "SELECT id, reg_key, name FROM regulations WHERE (name ILIKE '%SEVIS%' OR name ILIKE '%visa%' OR name ILIKE '%international%') AND is_current = true"
      );
      for (const reg of regs.rows) {
        impacts.push({ regulation: reg, type: 'modifies', severity: 'medium' });
      }
    }

    // FERPA/student records
    if (searchText.includes('student') || searchText.includes('education record') ||
        searchText.includes('privacy')) {
      const regs = await this.pool.query(
        "SELECT id, reg_key, name FROM regulations WHERE name ILIKE '%FERPA%' AND is_current = true"
      );
      for (const reg of regs.rows) {
        impacts.push({ regulation: reg, type: 'reinforces', severity: 'low' });
      }
    }

    // Insert impact records
    for (const impact of impacts) {
      try {
        await this.pool.query(`
          INSERT INTO eo_regulation_impacts (
            eo_id, regulation_id, impact_type, impact_severity,
            impact_summary, assessed_by, assessment_date, confidence_score
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7)
          ON CONFLICT (eo_id, regulation_id) DO NOTHING
        `, [
          eoId,
          impact.regulation.id,
          impact.type,
          impact.severity,
          `Auto-detected potential impact on ${impact.regulation.name}`,
          'MCP Engine Auto-Link',
          0.7
        ]);
      } catch (e) {
        // Ignore duplicates
      }
    }

    return impacts;
  }

  /**
   * Sync all recent EOs and auto-link
   */
  async syncRecentEOs(options = {}) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     FEDERAL REGISTER - EXECUTIVE ORDER SYNC                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const eos = await this.fetchRecentEOs(options);
    
    const results = {
      total: eos.length,
      imported: 0,
      skipped: 0,
      linked: 0,
      errors: []
    };

    for (const eo of eos) {
      try {
        const importResult = await this.importEO(eo);
        
        if (importResult.action === 'imported') {
          results.imported++;
          
          // Auto-link to regulations
          const impacts = await this.autoLinkToRegulations(importResult.id);
          results.linked += impacts.length;
          
          if (impacts.length > 0) {
            console.log(`      📎 Linked to ${impacts.length} regulations`);
          }
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.errors.push({ eo: eo.title, error: error.message });
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ Imported: ${results.imported}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`📎 Linked: ${results.linked} regulation impacts`);
    if (results.errors.length > 0) {
      console.log(`❌ Errors: ${results.errors.length}`);
    }

    return results;
  }

  /**
   * Get EOs affecting a specific regulation
   */
  async getEOsForRegulation(regulationId) {
    const result = await this.pool.query(`
      SELECT eo.*, eori.impact_type, eori.impact_severity, eori.impact_summary
      FROM executive_orders eo
      JOIN eo_regulation_impacts eori ON eo.id = eori.eo_id
      WHERE eori.regulation_id = $1
      ORDER BY eo.signed_date DESC
    `, [regulationId]);
    
    return result.rows;
  }

  /**
   * Get all active EOs with higher education impact
   */
  async getHigherEdEOs() {
    const result = await this.pool.query(`
      SELECT eo.*, 
             COUNT(eori.id) as affected_regulations,
             array_agg(DISTINCT r.name) as regulation_names
      FROM executive_orders eo
      LEFT JOIN eo_regulation_impacts eori ON eo.id = eori.eo_id
      LEFT JOIN regulations r ON eori.regulation_id = r.id
      WHERE eo.status = 'active'
        AND (eo.topics IS NOT NULL OR eori.id IS NOT NULL)
      GROUP BY eo.id
      ORDER BY eo.signed_date DESC
    `);
    
    return result.rows;
  }

  /**
   * Update EO status (e.g., when enjoined by court)
   */
  async updateEOStatus(eoId, newStatus, reason, sourceUrl = null) {
    // Get current status
    const current = await this.pool.query(
      'SELECT status FROM executive_orders WHERE id = $1',
      [eoId]
    );
    
    if (current.rows.length === 0) {
      throw new Error(`EO ${eoId} not found`);
    }

    const previousStatus = current.rows[0].status;

    // Update status
    await this.pool.query(`
      UPDATE executive_orders 
      SET status = $1, 
          updated_at = NOW(),
          enjoined_date = CASE WHEN $1 = 'enjoined' THEN CURRENT_DATE ELSE enjoined_date END,
          enjoined_by = CASE WHEN $1 = 'enjoined' THEN $2 ELSE enjoined_by END
      WHERE id = $3
    `, [newStatus, reason, eoId]);

    // Record history
    await this.pool.query(`
      INSERT INTO eo_status_history (eo_id, previous_status, new_status, change_date, change_reason, source_url)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)
    `, [eoId, previousStatus, newStatus, reason, sourceUrl]);

    return { previousStatus, newStatus };
  }

  async close() {
    await this.pool.end();
  }
}

export { FederalRegisterEOService, HIGHER_ED_KEYWORDS };
export default FederalRegisterEOService;
