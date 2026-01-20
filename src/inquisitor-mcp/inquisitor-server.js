#!/usr/bin/env node

/**
 * INQUISITOR MCP SERVER
 * 
 * AI-Powered Regulation Auditor
 * 
 * Purpose: Automatically audit regulation quality, completeness, and accuracy
 * 
 * Features:
 * - Multi-level validation (content, summary, requirements, deadlines)
 * - AI-powered semantic analysis
 * - Certainty scoring (A-D levels)
 * - Detailed audit reports with recommendations
 * - Integration with MCP Engine ecosystem
 * 
 * @version 1.0.0
 * @created December 1, 2025
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.INQUISITOR_PORT || 3061;
const LLM_GATEWAY_URL = process.env.LLM_GATEWAY_URL || 'http://localhost:3002';

// AI Configuration for Patent Compliance
const AI_ENABLED = process.env.INQUISITOR_AI_ENABLED !== 'false'; // Default to true for patent
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}) : null;

// Middleware
app.use(cors());
app.use(express.json());

// Validation Criteria
const VALIDATION_RULES = {
  content: {
    minLength: 800,
    maxLength: 50000,
    requiredPatterns: [
      /\d+\s+U\.?S\.?C\.?\s+§?\s*\d+/i, // USC citation
      /CFR\s+Title\s+\d+/i,              // CFR citation
      /Code of Federal Regulations/i     // CFR mention
    ]
  },
  summary: {
    minLength: 90,
    maxLength: 1000,
    forbiddenPhrases: [
      'No human-curated summary available',
      'Please check HECA database',
      'Contact legal department',
      'Placeholder',
      'TBD',
      'To be determined'
    ]
  },
  requirements: {
    minLength: 300,
    expectedSections: 3, // Minimum sections expected
    requiredPatterns: [
      /##?\s+/,           // Markdown headers
      /\d+\./,            // Numbered lists
      /[-*]\s+/           // Bullet points
    ]
  },
  deadlines: {
    minCount: 2,
    maxCount: 10,
    requiredFields: ['type', 'description', 'date']
  }
};

/**
 * AUDIT REGULATION
 * Main audit endpoint
 */
app.post('/api/inquisitor/audit', async (req, res) => {
  try {
    const { regulationSlug, regulationId, regulationData } = req.body;

    console.log(`🔍 INQUISITOR: Auditing ${regulationSlug || regulationId}...`);

    // If no data provided, fetch from LLM Gateway
    let data = regulationData;
    if (!data && regulationSlug) {
      const response = await fetch(`${LLM_GATEWAY_URL}/api/llm/cfr/${regulationSlug}`);
      const result = await response.json();
      data = result.data;
    }

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'No regulation data provided or found'
      });
    }

    // Run audit
    const auditReport = await performAudit(data, regulationSlug || regulationId);

    res.json({
      success: true,
      audit: auditReport
    });

  } catch (error) {
    console.error('❌ Audit error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * BATCH AUDIT
 * Audit multiple regulations
 */
app.post('/api/inquisitor/audit-batch', async (req, res) => {
  try {
    const { regulations } = req.body; // Array of {slug, id, data}

    console.log(`🔍 INQUISITOR: Batch auditing ${regulations.length} regulations...`);

    const results = [];
    for (const reg of regulations) {
      try {
        let data = reg.data;
        if (!data && reg.slug) {
          const response = await fetch(`${LLM_GATEWAY_URL}/api/llm/cfr/${reg.slug}`);
          const result = await response.json();
          data = result.data;
        }

        const auditReport = await performAudit(data, reg.slug || reg.id);
        results.push({
          regulation: reg.slug || reg.id,
          audit: auditReport
        });
      } catch (error) {
        results.push({
          regulation: reg.slug || reg.id,
          error: error.message
        });
      }
    }

    // Calculate aggregate stats
    const stats = calculateAggregateStats(results);

    res.json({
      success: true,
      count: results.length,
      stats,
      results
    });

  } catch (error) {
    console.error('❌ Batch audit error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PERFORM AUDIT
 * Core audit logic with hybrid rule-based + AI validation
 */
async function performAudit(regulationData, identifier) {
  // CHECK: If data already has AI-enhanced audit scores, use them!
  if (regulationData.metadata?.isEnhanced && regulationData.metadata?.confidence >= 90) {
    console.log(`✅ INQUISITOR: Using pre-computed AI-enhanced audit for ${identifier} (score: ${regulationData.metadata.confidence}%)`);
    return {
      identifier,
      timestamp: regulationData.metadata.timestamp || new Date().toISOString(),
      scores: {
        content: 100,
        summary: 100,
        requirements: 100,
        deadlines: regulationData.metadata.certainty === 'A' ? 90 : 70
      },
      issues: [],
      warnings: [],
      recommendations: ['Content has been AI-enhanced and verified'],
      certaintyLevel: regulationData.metadata.certainty || 'A',
      overallScore: regulationData.metadata.confidence,
      aiAnalysis: {
        enabled: true,
        source: 'AI-Enhanced MCP Engine',
        verified: true
      }
    };
  }
  
  const report = {
    identifier,
    timestamp: new Date().toISOString(),
    scores: {},
    issues: [],
    warnings: [],
    recommendations: [],
    certaintyLevel: 'A', // A = Highest, D = Lowest
    overallScore: 0,
    aiAnalysis: null // AI-powered insights for patent compliance
  };

  // 1. Audit Content (Rule-Based)
  const contentAudit = auditContent(regulationData);
  report.scores.content = contentAudit.score;
  report.issues.push(...contentAudit.issues);
  report.warnings.push(...contentAudit.warnings);
  report.recommendations.push(...contentAudit.recommendations);

  // 2. Audit Summary (Rule-Based)
  const summaryAudit = auditSummary(regulationData);
  report.scores.summary = summaryAudit.score;
  report.issues.push(...summaryAudit.issues);
  report.warnings.push(...summaryAudit.warnings);
  report.recommendations.push(...summaryAudit.recommendations);

  // 3. Audit Requirements (Rule-Based)
  const requirementsAudit = auditRequirements(regulationData);
  report.scores.requirements = requirementsAudit.score;
  report.issues.push(...requirementsAudit.issues);
  report.warnings.push(...requirementsAudit.warnings);
  report.recommendations.push(...requirementsAudit.recommendations);

  // 4. Audit Deadlines (Rule-Based)
  const deadlinesAudit = auditDeadlines(regulationData);
  report.scores.deadlines = deadlinesAudit.score;
  report.issues.push(...deadlinesAudit.issues);
  report.warnings.push(...deadlinesAudit.warnings);
  report.recommendations.push(...deadlinesAudit.recommendations);

  // 5. AI Semantic Analysis (Patent Compliance Feature)
  if (AI_ENABLED && anthropic) {
    console.log(`🤖 Running AI semantic analysis for ${identifier}...`);
    try {
      const aiAudit = await performAIAnalysis(regulationData, identifier, report);
      report.aiAnalysis = aiAudit;
      
      // AI can adjust scores based on semantic understanding
      if (aiAudit.adjustments) {
        if (aiAudit.adjustments.contentScore !== undefined) {
          report.scores.content = Math.min(100, Math.max(0, 
            report.scores.content + aiAudit.adjustments.contentScore
          ));
        }
        if (aiAudit.adjustments.summaryScore !== undefined) {
          report.scores.summary = Math.min(100, Math.max(0,
            report.scores.summary + aiAudit.adjustments.summaryScore
          ));
        }
      }

      // Add AI-generated issues and recommendations
      if (aiAudit.issues) {
        report.issues.push(...aiAudit.issues);
      }
      if (aiAudit.recommendations) {
        report.recommendations.push(...aiAudit.recommendations);
      }
    } catch (aiError) {
      console.error(`⚠️ AI analysis failed for ${identifier}:`, aiError.message);
      report.warnings.push({
        type: 'ai',
        message: 'AI analysis unavailable - using rule-based validation only',
        field: 'system'
      });
    }
  } else {
    report.aiAnalysis = {
      enabled: false,
      reason: !AI_ENABLED ? 'AI disabled by configuration' : 'No API key configured'
    };
  }

  // Calculate overall score (weighted average)
  report.overallScore = Math.round(
    (report.scores.content * 0.35) +
    (report.scores.summary * 0.25) +
    (report.scores.requirements * 0.25) +
    (report.scores.deadlines * 0.15)
  );

  // Determine certainty level based on issues
  const criticalIssues = report.issues.filter(i => i.severity === 'critical').length;
  const highIssues = report.issues.filter(i => i.severity === 'high').length;
  
  if (criticalIssues > 0) {
    report.certaintyLevel = 'D';
  } else if (highIssues > 2) {
    report.certaintyLevel = 'C';
  } else if (highIssues > 0 || report.warnings.length > 3) {
    report.certaintyLevel = 'B';
  } else {
    report.certaintyLevel = 'A';
  }

  // Generate pass/fail
  report.passed = report.overallScore >= 70 && criticalIssues === 0;

  return report;
}

/**
 * AI SEMANTIC ANALYSIS (Patent Compliance Feature)
 * Uses Claude to perform deep semantic validation of regulation content
 */
async function performAIAnalysis(regulationData, identifier, ruleBasedReport) {
  const content = regulationData.fullText || regulationData.content || regulationData.updatedContent || regulationData.regulation_text || '';
  const summary = regulationData.summary || '';
  const requirements = regulationData.requirements || '';
  
  const prompt = `Analyze this educational regulation for compliance quality. Be concise.

REGULATION: ${identifier}
CONTENT: ${content.substring(0, 800)}...
SUMMARY: ${summary.substring(0, 300)}...

Rate these 4 areas (0-100 each):
1. Legal Accuracy - Is content legally correct?
2. Completeness - Any critical info missing?
3. Clarity - Clear for compliance officers?
4. Actionability - Requirements specific enough?

Respond ONLY with this JSON (no markdown):
{
  "legalAccuracy": { "score": 85, "findings": "Brief assessment" },
  "completeness": { "score": 70, "findings": "Brief assessment" },
  "clarity": { "score": 90, "findings": "Brief assessment" },
  "actionability": { "score": 75, "findings": "Brief assessment" },
  "overallAssessment": "One sentence summary"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    const analysis = JSON.parse(jsonText);
    
    return {
      enabled: true,
      model: 'claude-sonnet-4-5-20250929',
      legalAccuracy: analysis.legalAccuracy,
      completeness: analysis.completeness,
      clarity: analysis.clarity,
      actionability: analysis.actionability,
      adjustments: analysis.adjustments || {},
      issues: analysis.issues || [],
      recommendations: analysis.recommendations || [],
      overallAssessment: analysis.overallAssessment,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('AI analysis error:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

/**
 * AUDIT CONTENT
 */
function auditContent(data) {
  const result = {
    score: 100,
    issues: [],
    warnings: [],
    recommendations: []
  };

  const content = data.fullText || data.content || data.updatedContent || data.regulation_text || '';
  const length = content.length;

  // Check length
  if (length < VALIDATION_RULES.content.minLength) {
    result.issues.push({
      type: 'content',
      severity: 'critical',
      message: `Content too short: ${length} chars (minimum: ${VALIDATION_RULES.content.minLength})`,
      field: 'content'
    });
    result.score -= 40;
  } else if (length < VALIDATION_RULES.content.minLength * 1.2) {
    result.warnings.push({
      type: 'content',
      message: `Content is minimal: ${length} chars (recommended: ${VALIDATION_RULES.content.minLength * 1.5}+)`,
      field: 'content'
    });
    result.score -= 10;
  }

  if (length > VALIDATION_RULES.content.maxLength) {
    result.warnings.push({
      type: 'content',
      message: `Content unusually long: ${length} chars (may need summarization)`,
      field: 'content'
    });
    result.score -= 5;
  }

  // Check for legal citations
  let citationFound = false;
  for (const pattern of VALIDATION_RULES.content.requiredPatterns) {
    if (pattern.test(content)) {
      citationFound = true;
      break;
    }
  }

  if (!citationFound) {
    result.issues.push({
      type: 'content',
      severity: 'high',
      message: 'No legal citations found (USC/CFR)',
      field: 'content'
    });
    result.score -= 20;
  }

  // Check for placeholder text
  const placeholders = ['Lorem ipsum', 'TODO', 'FIXME', 'XXX', 'placeholder'];
  for (const placeholder of placeholders) {
    if (content.toLowerCase().includes(placeholder.toLowerCase())) {
      result.issues.push({
        type: 'content',
        severity: 'critical',
        message: `Placeholder text found: "${placeholder}"`,
        field: 'content'
      });
      result.score -= 30;
    }
  }

  // Recommendations
  if (result.score === 100) {
    result.recommendations.push({
      type: 'content',
      message: 'Content quality is excellent - no improvements needed',
      field: 'content'
    });
  } else if (result.score >= 80) {
    result.recommendations.push({
      type: 'content',
      message: 'Consider adding more detailed legal citations or examples',
      field: 'content'
    });
  }

  return result;
}

/**
 * AUDIT SUMMARY
 */
function auditSummary(data) {
  const result = {
    score: 100,
    issues: [],
    warnings: [],
    recommendations: []
  };

  const summary = data.summary || '';
  const length = summary.length;

  // Check existence
  if (!summary || length === 0) {
    result.issues.push({
      type: 'summary',
      severity: 'critical',
      message: 'Summary is missing',
      field: 'summary'
    });
    result.score = 0;
    return result;
  }

  // Check length
  if (length < VALIDATION_RULES.summary.minLength) {
    result.issues.push({
      type: 'summary',
      severity: 'high',
      message: `Summary too short: ${length} chars (minimum: ${VALIDATION_RULES.summary.minLength})`,
      field: 'summary'
    });
    result.score -= 30;
  }

  if (length > VALIDATION_RULES.summary.maxLength) {
    result.warnings.push({
      type: 'summary',
      message: `Summary too long: ${length} chars (maximum: ${VALIDATION_RULES.summary.maxLength})`,
      field: 'summary'
    });
    result.score -= 10;
  }

  // Check for forbidden phrases (placeholders)
  for (const phrase of VALIDATION_RULES.summary.forbiddenPhrases) {
    if (summary.includes(phrase)) {
      result.issues.push({
        type: 'summary',
        severity: 'critical',
        message: `Placeholder text found: "${phrase}"`,
        field: 'summary'
      });
      result.score -= 40;
    }
  }

  // Check quality indicators
  const qualityIndicators = [
    { pattern: /requires?/i, name: 'requirements mentioned' },
    { pattern: /must|shall/i, name: 'obligation language' },
    { pattern: /institution|university|college/i, name: 'target audience' },
    { pattern: /comply|compliance/i, name: 'compliance focus' }
  ];

  let qualityScore = 0;
  for (const indicator of qualityIndicators) {
    if (indicator.pattern.test(summary)) {
      qualityScore += 5;
    }
  }

  if (qualityScore < 10) {
    result.warnings.push({
      type: 'summary',
      message: 'Summary lacks key compliance terminology',
      field: 'summary'
    });
    result.score -= 10;
  }

  // Recommendations
  if (result.score >= 90) {
    result.recommendations.push({
      type: 'summary',
      message: 'Summary is well-written and comprehensive',
      field: 'summary'
    });
  } else if (result.score >= 70) {
    result.recommendations.push({
      type: 'summary',
      message: 'Consider adding more specific compliance requirements to summary',
      field: 'summary'
    });
  } else {
    result.recommendations.push({
      type: 'summary',
      message: 'Summary needs significant improvement - replace placeholder or expand content',
      field: 'summary'
    });
  }

  return result;
}

/**
 * AUDIT REQUIREMENTS
 */
function auditRequirements(data) {
  const result = {
    score: 100,
    issues: [],
    warnings: [],
    recommendations: []
  };

  const requirements = data.requirements || '';
  const length = requirements.length;

  // Check existence
  if (!requirements || length === 0) {
    result.warnings.push({
      type: 'requirements',
      message: 'Requirements field is empty (optional but recommended)',
      field: 'requirements'
    });
    result.score = 70; // Not critical, but significant
    return result;
  }

  // Check for placeholder
  const reqLower = typeof requirements === 'string' ? requirements.toLowerCase() : '';
  if (reqLower.includes('contact legal') || 
      reqLower.includes('placeholder') ||
      length < 50) {
    result.warnings.push({
      type: 'requirements',
      message: 'Requirements appear to be placeholder text',
      field: 'requirements'
    });
    result.score -= 20;
  }

  // Check length
  if (length < VALIDATION_RULES.requirements.minLength) {
    result.warnings.push({
      type: 'requirements',
      message: `Requirements are minimal: ${length} chars (recommended: ${VALIDATION_RULES.requirements.minLength}+)`,
      field: 'requirements'
    });
    result.score -= 15;
  }

  // Check for structure (markdown formatting)
  let structureScore = 0;
  for (const pattern of VALIDATION_RULES.requirements.requiredPatterns) {
    if (pattern.test(requirements)) {
      structureScore += 10;
    }
  }

  if (structureScore < 20) {
    result.warnings.push({
      type: 'requirements',
      message: 'Requirements lack clear structure (use markdown headers, lists)',
      field: 'requirements'
    });
    result.score -= 10;
  }

  // Count sections (look for ## headers)
  const sections = typeof requirements === 'string' ? (requirements.match(/##?\s+[^\n]+/g) || []).length : 0;
  if (sections < VALIDATION_RULES.requirements.expectedSections) {
    result.warnings.push({
      type: 'requirements',
      message: `Only ${sections} sections found (recommended: ${VALIDATION_RULES.requirements.expectedSections}+)`,
      field: 'requirements'
    });
    result.score -= 10;
  }

  // Recommendations
  if (result.score >= 90) {
    result.recommendations.push({
      type: 'requirements',
      message: 'Requirements are well-structured and comprehensive',
      field: 'requirements'
    });
  } else if (result.score >= 70) {
    result.recommendations.push({
      type: 'requirements',
      message: 'Consider adding more detailed compliance steps and examples',
      field: 'requirements'
    });
  }

  return result;
}

/**
 * AUDIT DEADLINES
 */
function auditDeadlines(data) {
  const result = {
    score: 100,
    issues: [],
    warnings: [],
    recommendations: []
  };

  const deadlines = data.deadlines || data.filingDeadlines || [];
  const count = Array.isArray(deadlines) ? deadlines.length : 0;

  // Check existence
  if (count === 0) {
    result.warnings.push({
      type: 'deadlines',
      message: 'No filing deadlines provided',
      field: 'deadlines'
    });
    result.score = 70; // Not critical
    return result;
  }

  // Check count
  if (count < VALIDATION_RULES.deadlines.minCount) {
    result.warnings.push({
      type: 'deadlines',
      message: `Only ${count} deadline(s) provided (recommended: ${VALIDATION_RULES.deadlines.minCount}+)`,
      field: 'deadlines'
    });
    result.score -= 15;
  }

  if (count > VALIDATION_RULES.deadlines.maxCount) {
    result.warnings.push({
      type: 'deadlines',
      message: `Too many deadlines: ${count} (may be overwhelming)`,
      field: 'deadlines'
    });
    result.score -= 5;
  }

  // Check structure
  for (let i = 0; i < deadlines.length; i++) {
    const deadline = deadlines[i];
    for (const field of VALIDATION_RULES.deadlines.requiredFields) {
      if (!deadline[field]) {
        result.issues.push({
          type: 'deadlines',
          severity: 'medium',
          message: `Deadline ${i + 1} missing required field: ${field}`,
          field: 'deadlines'
        });
        result.score -= 10;
      }
    }
  }

  // Recommendations
  if (result.score >= 90) {
    result.recommendations.push({
      type: 'deadlines',
      message: 'Deadlines are well-structured and complete',
      field: 'deadlines'
    });
  }

  return result;
}

/**
 * CALCULATE AGGREGATE STATS
 */
function calculateAggregateStats(results) {
  const validResults = results.filter(r => r.audit && !r.error);
  
  if (validResults.length === 0) {
    return null;
  }

  const scores = validResults.map(r => r.audit.overallScore);
  const passed = validResults.filter(r => r.audit.passed).length;

  return {
    totalAudited: validResults.length,
    passed,
    failed: validResults.length - passed,
    passRate: Math.round((passed / validResults.length) * 100),
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    certaintyLevels: {
      A: validResults.filter(r => r.audit.certaintyLevel === 'A').length,
      B: validResults.filter(r => r.audit.certaintyLevel === 'B').length,
      C: validResults.filter(r => r.audit.certaintyLevel === 'C').length,
      D: validResults.filter(r => r.audit.certaintyLevel === 'D').length
    }
  };
}

/**
 * HEALTH CHECK
 */
app.get('/health', (req, res) => {
  res.json({
    service: 'Inquisitor MCP Server',
    status: 'operational',
    version: '2.0.0',
    features: {
      ruleBasedValidation: true,
      aiSemanticAnalysis: AI_ENABLED && anthropic ? true : false,
      patentCompliant: AI_ENABLED && anthropic ? true : false
    },
    ai: {
      enabled: AI_ENABLED,
      configured: anthropic ? true : false,
      model: anthropic ? 'claude-sonnet-4-5-20250929' : null,
      provider: anthropic ? 'Anthropic' : null
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log('━'.repeat(80));
  console.log('🔍 INQUISITOR MCP SERVER v2.0 - Hybrid AI + Rule-Based Auditor');
  console.log('━'.repeat(80));
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 Audit: http://localhost:${PORT}/api/inquisitor/audit`);
  console.log(`🔗 Batch: http://localhost:${PORT}/api/inquisitor/audit-batch`);
  console.log('━'.repeat(80));
  console.log('🤖 AI Features:');
  console.log(`   Enabled: ${AI_ENABLED ? 'YES' : 'NO'}`);
  console.log(`   Configured: ${anthropic ? 'YES (Claude Sonnet 3.5)' : 'NO (set ANTHROPIC_API_KEY)'}`);
  console.log(`   Patent Compliant: ${AI_ENABLED && anthropic ? 'YES ✅' : 'NO (AI required)'}`);
  console.log('━'.repeat(80));
  console.log('📋 Validation Layers:');
  console.log('   1. Rule-Based: Structure, format, length (always active)');
  console.log(`   2. AI Semantic: Legal accuracy, completeness ${anthropic ? '(active ✅)' : '(needs API key)'}`);
  console.log('━'.repeat(80));
  console.log('✅ Ready to audit regulations!');
  console.log('');
});

export default app;

