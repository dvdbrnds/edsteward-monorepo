/**
 * Executive Order Impact Summarizer
 * 
 * Uses AI (Claude) to generate meaningful summaries of how Executive Orders
 * impact specific regulations for higher education institutions.
 */

import fetch from 'node-fetch';
import pg from 'pg';

const { Pool } = pg;

class EOImpactSummarizer {
  constructor(options = {}) {
    this.pool = options.pool || new Pool({
      host: 'localhost',
      port: 5432,
      database: 'mcp_engine',
      user: process.env.PGUSER || process.env.USER,
    });
    
    // Accept API key from options or environment
    this.anthropicApiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    
    if (!this.anthropicApiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set - AI summarization will use fallback mode');
    } else {
      console.log('🤖 AI summarization enabled with Claude');
    }
  }

  /**
   * Generate AI-powered impact summary for an EO-regulation pair
   */
  async summarizeImpact(eoId, regulationId) {
    console.log(`🤖 Generating AI impact summary for EO ${eoId} → Regulation ${regulationId}`);
    
    // Fetch EO details
    const eoResult = await this.pool.query(
      'SELECT * FROM executive_orders WHERE id = $1',
      [eoId]
    );
    
    if (eoResult.rows.length === 0) {
      throw new Error(`Executive Order ${eoId} not found`);
    }
    const eo = eoResult.rows[0];
    
    // Fetch regulation details
    const regResult = await this.pool.query(
      'SELECT * FROM regulations WHERE id = $1',
      [regulationId]
    );
    
    if (regResult.rows.length === 0) {
      throw new Error(`Regulation ${regulationId} not found`);
    }
    const regulation = regResult.rows[0];
    
    // Generate the summary using AI
    const summary = await this._generateImpactSummary(eo, regulation);
    
    // Update the database with the AI-generated summary
    await this._updateImpactSummary(eoId, regulationId, summary);
    
    return summary;
  }

  /**
   * Batch summarize all unsummarized EO-regulation impacts
   */
  async summarizeAllPending(options = {}) {
    const { limit = 50, forceRefresh = false } = options;
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     AI EXECUTIVE ORDER IMPACT SUMMARIZATION                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    // Find impacts that need AI summarization
    let query = `
      SELECT eori.eo_id, eori.regulation_id, eo.eo_number, eo.title as eo_title,
             r.name as reg_name, eori.impact_summary
      FROM eo_regulation_impacts eori
      JOIN executive_orders eo ON eo.id = eori.eo_id
      JOIN regulations r ON r.id = eori.regulation_id
      WHERE r.is_current = true
    `;
    
    if (!forceRefresh) {
      query += ` AND (eori.impact_summary IS NULL OR eori.impact_summary LIKE 'Auto-detected%')`;
    }
    
    query += ` ORDER BY eo.signed_date DESC LIMIT $1`;
    
    const result = await this.pool.query(query, [limit]);
    
    console.log(`📋 Found ${result.rows.length} EO-regulation impacts to summarize`);
    
    const results = {
      total: result.rows.length,
      summarized: 0,
      errors: []
    };
    
    for (const row of result.rows) {
      try {
        console.log(`\n🔄 Processing: ${row.eo_number} → ${row.reg_name}`);
        await this.summarizeImpact(row.eo_id, row.regulation_id);
        results.summarized++;
        console.log(`   ✅ Summary generated`);
        
        // Rate limiting - wait 1 second between API calls
        await this._delay(1000);
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        results.errors.push({
          eo: row.eo_number,
          regulation: row.reg_name,
          error: error.message
        });
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Summarized: ${results.summarized}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    return results;
  }

  /**
   * Generate impact summary using Claude AI
   */
  async _generateImpactSummary(eo, regulation) {
    if (!this.anthropicApiKey) {
      return this._generateFallbackSummary(eo, regulation);
    }
    
    const prompt = await this._buildPrompt(eo, regulation);
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          temperature: 0.3,
          system: `You are a higher education compliance expert. You analyze how Presidential Executive Orders impact federal regulations that apply to colleges and universities. Be concise, specific, and actionable.`,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      if (!data.content || data.content.length === 0) {
        throw new Error('No response content from AI');
      }

      const summary = data.content[0].text.trim();
      return summary;
      
    } catch (error) {
      console.error(`   ⚠️  AI error, using fallback: ${error.message}`);
      return this._generateFallbackSummary(eo, regulation);
    }
  }

  /**
   * Fetch full EO text from Federal Register
   */
  async _fetchEOFullText(eo) {
    if (!eo.full_text_url) {
      console.log('   ⚠️  No full_text_url available for', eo.eo_number);
      return null;
    }

    try {
      // Extract document number from URL or use federal_register_doc_number
      const docNumber = eo.federal_register_doc_number || 
                        eo.full_text_url.match(/\/(\d{4}-\d+)\//)?.[1];
      
      if (!docNumber) {
        console.log('   ⚠️  Could not extract document number');
        return null;
      }

      // Fetch from Federal Register API
      const apiUrl = `https://www.federalregister.gov/api/v1/documents/${docNumber}.json?fields[]=body_html_url&fields[]=abstract&fields[]=full_text_xml_url&fields[]=raw_text_url`;
      
      console.log(`   📡 Fetching EO text from Federal Register...`);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.log(`   ⚠️  Federal Register API returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      // Try to get the raw text URL and fetch it
      if (data.raw_text_url) {
        const textResponse = await fetch(data.raw_text_url);
        if (textResponse.ok) {
          const fullText = await textResponse.text();
          // Limit to first 8000 chars to fit in context
          return fullText.substring(0, 8000);
        }
      }

      // Fallback to abstract if available
      if (data.abstract) {
        return data.abstract;
      }

      return null;
    } catch (error) {
      console.log(`   ⚠️  Error fetching EO text: ${error.message}`);
      return null;
    }
  }

  /**
   * Build the prompt for AI summarization
   */
  async _buildPrompt(eo, regulation, fullText = null) {
    // Fetch full text if not provided
    if (!fullText && !eo.summary) {
      fullText = await this._fetchEOFullText(eo);
    }

    const eoContent = fullText || eo.summary || 'Summary not available - analysis based on title only';
    
    return `Analyze how this Executive Order impacts the following federal regulation for higher education institutions.

EXECUTIVE ORDER:
- Number: ${eo.eo_number}
- Title: ${eo.title}
- Signed: ${eo.signed_date}
- President: ${eo.president} (${eo.term})
- Full Text/Summary:
${eoContent}

REGULATION:
- Name: ${regulation.name}
- Category: ${regulation.category || 'N/A'}
- Statute: ${regulation.statute || 'N/A'}
- Summary: ${regulation.summary || regulation.description || 'Not available'}

Please provide a 2-3 sentence summary that explains:
1. How this Executive Order specifically affects this regulation
2. What compliance implications this has for higher education institutions
3. Whether this creates new requirements, modifies existing ones, or potentially conflicts

Be direct and specific. Focus on actionable information for compliance officers.`;
  }

  /**
   * Generate a fallback summary when AI is unavailable
   */
  _generateFallbackSummary(eo, regulation) {
    const eoTopics = eo.topics || [];
    const regCategory = regulation.category || 'compliance';
    
    // Keyword-based impact analysis
    const eoText = `${eo.title} ${eo.summary || ''}`.toLowerCase();
    const regText = `${regulation.name} ${regulation.summary || ''}`.toLowerCase();
    
    let impactType = 'may affect';
    let actionRequired = 'Review required';
    
    // Detect specific impact patterns
    if (eoText.includes('revoke') || eoText.includes('terminate') || eoText.includes('rescind')) {
      impactType = 'may rescind or modify';
      actionRequired = 'Immediate review recommended';
    } else if (eoText.includes('strengthen') || eoText.includes('enforce') || eoText.includes('increase')) {
      impactType = 'may strengthen enforcement of';
      actionRequired = 'Enhanced compliance measures may be needed';
    } else if (eoText.includes('prohibit') || eoText.includes('restrict') || eoText.includes('ban')) {
      impactType = 'may restrict application of';
      actionRequired = 'Policy review urgently recommended';
    }
    
    return `${eo.eo_number} (${eo.title}) ${impactType} ${regulation.name}. ` +
           `Signed by President ${eo.president} on ${new Date(eo.signed_date).toLocaleDateString()}. ` +
           `${actionRequired} to assess institutional compliance implications.`;
  }

  /**
   * Update the impact summary in the database
   */
  async _updateImpactSummary(eoId, regulationId, summary) {
    await this.pool.query(`
      UPDATE eo_regulation_impacts 
      SET impact_summary = $1,
          assessed_by = 'MCP Engine AI',
          assessment_date = CURRENT_DATE,
          confidence_score = CASE WHEN $1 LIKE 'Auto-detected%' THEN 0.7 ELSE 0.9 END
      WHERE eo_id = $2 AND regulation_id = $3
    `, [summary, eoId, regulationId]);
  }

  /**
   * Get all EO impacts for a regulation with AI summaries
   */
  async getRegulationEOImpacts(regulationId) {
    const result = await this.pool.query(`
      SELECT 
        eo.eo_number,
        eo.title,
        eo.signed_date,
        eo.president,
        eo.term,
        eo.status,
        eo.full_text_url,
        eori.impact_type,
        eori.impact_severity,
        eori.impact_summary,
        eori.confidence_score,
        eori.assessed_by
      FROM eo_regulation_impacts eori
      JOIN executive_orders eo ON eo.id = eori.eo_id
      WHERE eori.regulation_id = $1
      ORDER BY eo.signed_date DESC
    `, [regulationId]);
    
    return result.rows;
  }

  /**
   * Regenerate summary for a specific impact
   */
  async regenerateSummary(eoId, regulationId) {
    console.log(`🔄 Regenerating AI summary for EO ${eoId} → Regulation ${regulationId}`);
    return await this.summarizeImpact(eoId, regulationId);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    await this.pool.end();
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const summarizer = new EOImpactSummarizer();
  
  try {
    if (args[0] === '--all') {
      // Summarize all pending
      const limit = parseInt(args[1]) || 50;
      await summarizer.summarizeAllPending({ limit });
    } else if (args[0] === '--eo' && args[1] && args[2]) {
      // Summarize specific EO-regulation pair
      const eoId = parseInt(args[1]);
      const regId = parseInt(args[2]);
      const summary = await summarizer.summarizeImpact(eoId, regId);
      console.log('\n📝 Generated Summary:');
      console.log(summary);
    } else if (args[0] === '--regulation' && args[1]) {
      // Get all EO impacts for a regulation
      const regId = parseInt(args[1]);
      const impacts = await summarizer.getRegulationEOImpacts(regId);
      console.log(`\n📋 ${impacts.length} Executive Order impacts:`);
      for (const impact of impacts) {
        console.log(`\n${impact.eo_number}: ${impact.title}`);
        console.log(`   Impact: ${impact.impact_type} (${impact.impact_severity})`);
        console.log(`   Summary: ${impact.impact_summary}`);
      }
    } else {
      console.log('Usage:');
      console.log('  node eo-impact-summarizer.js --all [limit]           Summarize all pending impacts');
      console.log('  node eo-impact-summarizer.js --eo <eoId> <regId>     Summarize specific EO-regulation pair');
      console.log('  node eo-impact-summarizer.js --regulation <regId>   Get all EO impacts for a regulation');
    }
  } finally {
    await summarizer.close();
  }
}

// Run if executed directly
const isMainModule = process.argv[1] && process.argv[1].includes('eo-impact-summarizer');
if (isMainModule) {
  main().catch(console.error);
}

export { EOImpactSummarizer };
export default EOImpactSummarizer;
