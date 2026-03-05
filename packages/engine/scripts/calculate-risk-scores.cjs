/**
 * MCP Engine: Institutional Risk Score (IRS) Calculator
 * 
 * Calculates and stores risk assessments for all regulations using
 * the five-factor scoring framework:
 *   - Financial Penalty Potential (0-30)
 *   - Federal Funding Risk (0-25)
 *   - Accreditation Impact (0-20)
 *   - Reputational/Legal Exposure (0-15)
 *   - Operational Disruption (0-10)
 * 
 * Run with: node scripts/calculate-risk-scores.cjs
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.MCP_DB_HOST || 'localhost',
  port: process.env.MCP_DB_PORT || 5432,
  database: process.env.MCP_DB_NAME || 'mcp_engine',
  user: process.env.MCP_DB_USER || process.env.USER,
  password: process.env.MCP_DB_PASSWORD || '',
});

// Risk level thresholds
function getRiskLevel(score) {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'SEVERE';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

// Reference risk scores for key regulations (from system prompt calibration)
const REFERENCE_SCORES = {
  // CRITICAL (90-100)
  'clery': {
    score: 96,
    factors: {
      financial: { score: 30, rationale: 'Maximum penalty $69,733 per violation with no cap. Liberty University fined $14M in 2024.', maxPenalty: '$69,733 per violation (2024)' },
      funding: { score: 25, rationale: 'Systemic violations can result in Title IV eligibility termination.', typesAtRisk: ['Title IV', 'Pell Grants', 'Direct Loans'] },
      accreditation: { score: 18, rationale: 'Major violations trigger show-cause orders from accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 15, rationale: 'National headlines, congressional scrutiny. Penn State, Michigan State, Liberty faced massive damage.', cases: ['Liberty $14M (2024)', 'Michigan State $4.5M (2019)', 'Penn State $2.4M (2016)'] },
      operations: { score: 8, rationale: 'Campus-wide coordination required: security, student affairs, HR, athletics.', affected: ['Campus Security', 'Student Affairs', 'Title IX', 'Athletics'] }
    },
    trend: 'INCREASING',
    enforcement: [{ institution: 'Liberty University', date: '2024-03-01', penalty: '$14,000,000', summary: 'Largest fine in higher education history' }]
  },
  
  'title iv|financial aid eligibility|title iv eligibility': {
    score: 96,
    factors: {
      financial: { score: 28, rationale: 'Loss of eligibility = loss of most tuition revenue for many institutions.', maxPenalty: 'Complete revenue loss' },
      funding: { score: 25, rationale: 'Direct pathway to complete loss of federal student aid.', typesAtRisk: ['All Title IV', 'Pell', 'Direct Loans', 'SEOG', 'Work-Study'] },
      accreditation: { score: 20, rationale: 'Loss of Title IV triggers accreditation review and likely loss.', accreditors: ['All accreditors'] },
      reputation: { score: 13, rationale: 'School closure coverage, student displacement stories.', cases: ['Corinthian Colleges', 'ITT Tech'] },
      operations: { score: 10, rationale: 'Institution-wide shutdown if eligibility lost.', affected: ['All operations'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'title ix': {
    score: 88,
    factors: {
      financial: { score: 25, rationale: 'Multi-million dollar settlements common. Michigan State $500M for Nassar case.', maxPenalty: 'Unlimited settlements' },
      funding: { score: 22, rationale: 'OCR can withhold federal funds. Rarely exercised but existential threat.', typesAtRisk: ['All federal funding'] },
      accreditation: { score: 18, rationale: 'Accreditors increasingly reviewing Title IX compliance.', accreditors: ['All regional accreditors'] },
      reputation: { score: 15, rationale: 'Sexual misconduct cases generate sustained national coverage.', cases: ['Michigan State $500M', 'USC $1.1B', 'Ohio State settlements'] },
      operations: { score: 8, rationale: 'Requires Title IX office, training, investigation procedures.', affected: ['Title IX Office', 'HR', 'Student Affairs', 'Athletics'] }
    },
    trend: 'INCREASING',
    enforcement: [{ institution: 'Michigan State', date: '2018-05-16', penalty: '$500,000,000', summary: 'Larry Nassar case settlement' }]
  },

  'ferpa|family educational rights': {
    score: 85,
    factors: {
      financial: { score: 22, rationale: 'Per-violation fines can compound. Systemic violations = significant exposure.', maxPenalty: 'Per-violation fines' },
      funding: { score: 25, rationale: 'Willful violations can result in complete funding termination.', typesAtRisk: ['All federal funding'] },
      accreditation: { score: 16, rationale: 'Data privacy increasingly scrutinized by accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 14, rationale: 'Data breaches generate significant media coverage.', cases: ['Various institutional breaches'] },
      operations: { score: 8, rationale: 'Requires training, systems, policies across institution.', affected: ['Registrar', 'IT', 'All departments'] }
    },
    trend: 'INCREASING',
    enforcement: []
  },

  // SEVERE (70-89)
  'title vi|civil rights act of 1964': {
    score: 77,
    factors: {
      financial: { score: 20, rationale: 'Settlements can reach millions. Pattern violations = DOJ involvement.', maxPenalty: 'Multi-million settlements' },
      funding: { score: 22, rationale: 'Can result in federal funding termination.', typesAtRisk: ['All federal funding'] },
      accreditation: { score: 15, rationale: 'Civil rights compliance reviewed by accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 14, rationale: 'Discrimination cases generate significant coverage.', cases: ['Various settlements'] },
      operations: { score: 6, rationale: 'Requires non-discrimination policies and enforcement.', affected: ['HR', 'Admissions', 'All departments'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'ada|americans with disabilities|section 504|rehabilitation act': {
    score: 74,
    factors: {
      financial: { score: 22, rationale: 'Settlements and remediation costs can be substantial.', maxPenalty: 'Multi-million remediation' },
      funding: { score: 18, rationale: 'Section 504 tied to federal funding.', typesAtRisk: ['All federal funding'] },
      accreditation: { score: 14, rationale: 'Accessibility compliance increasingly reviewed.', accreditors: ['All regional accreditors'] },
      reputation: { score: 13, rationale: 'Accessibility failures generate negative coverage.', cases: ['Various web accessibility settlements'] },
      operations: { score: 7, rationale: 'Requires accommodations infrastructure.', affected: ['Disability Services', 'Facilities', 'IT'] }
    },
    trend: 'INCREASING',
    enforcement: []
  },

  'vawa|violence against women': {
    score: 77,
    factors: {
      financial: { score: 24, rationale: 'Often combined with Clery violations for compounded fines.', maxPenalty: 'Combined with Clery fines' },
      funding: { score: 20, rationale: 'Tied to Title IV compliance.', typesAtRisk: ['Title IV'] },
      accreditation: { score: 14, rationale: 'Campus safety reviewed by accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 13, rationale: 'Sexual violence cases generate significant coverage.', cases: ['Combined with Title IX cases'] },
      operations: { score: 6, rationale: 'Requires prevention programs and response procedures.', affected: ['Title IX Office', 'Campus Safety', 'Student Affairs'] }
    },
    trend: 'INCREASING',
    enforcement: []
  },

  'false claims act': {
    score: 75,
    factors: {
      financial: { score: 28, rationale: 'Treble damages plus per-claim penalties. Qui tam relators.', maxPenalty: 'Treble damages + $11,665/claim' },
      funding: { score: 15, rationale: 'Fraud findings can affect funding eligibility.', typesAtRisk: ['Research grants', 'Medicare/Medicaid'] },
      accreditation: { score: 12, rationale: 'Fraud findings reviewed by accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 14, rationale: 'Fraud cases generate significant coverage.', cases: ['Duke $112M (2019)', 'Various settlements'] },
      operations: { score: 6, rationale: 'Requires compliance programs and monitoring.', affected: ['Research', 'Billing', 'Compliance'] }
    },
    trend: 'STABLE',
    enforcement: [{ institution: 'Duke University', date: '2019-03-25', penalty: '$112,500,000', summary: 'Research misconduct settlement' }]
  },

  'hipaa|health insurance portability': {
    score: 72,
    factors: {
      financial: { score: 24, rationale: 'Tiered penalties up to $1.5M per violation category per year.', maxPenalty: '$1.5M per category per year' },
      funding: { score: 16, rationale: 'Healthcare funding at risk for covered entities.', typesAtRisk: ['Medicare', 'Medicaid', 'Research grants'] },
      accreditation: { score: 12, rationale: 'Healthcare program accreditors review HIPAA.', accreditors: ['Healthcare accreditors'] },
      reputation: { score: 12, rationale: 'Health data breaches generate significant coverage.', cases: ['Various health system breaches'] },
      operations: { score: 8, rationale: 'Requires security infrastructure and training.', affected: ['Health Services', 'IT', 'Research'] }
    },
    trend: 'INCREASING',
    enforcement: []
  },

  // HIGH (50-69)
  'heoa|higher education opportunity': {
    score: 52,
    factors: {
      financial: { score: 12, rationale: 'Fines for disclosure failures.', maxPenalty: 'Per-violation fines' },
      funding: { score: 15, rationale: 'Tied to Title IV program participation.', typesAtRisk: ['Title IV'] },
      accreditation: { score: 12, rationale: 'Consumer information reviewed by accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 8, rationale: 'Disclosure failures can generate negative coverage.', cases: [] },
      operations: { score: 5, rationale: 'Requires disclosure coordination.', affected: ['Financial Aid', 'Registrar', 'Marketing'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'drug.?free schools|drug.?free workplace': {
    score: 52,
    factors: {
      financial: { score: 12, rationale: 'Fines for program failures.', maxPenalty: 'Per-violation fines' },
      funding: { score: 15, rationale: 'Required for federal funding eligibility.', typesAtRisk: ['All federal funding'] },
      accreditation: { score: 10, rationale: 'Safety programs reviewed by accreditors.', accreditors: ['All regional accreditors'] },
      reputation: { score: 10, rationale: 'Drug-related incidents can generate coverage.', cases: [] },
      operations: { score: 5, rationale: 'Requires prevention programs.', affected: ['Student Affairs', 'HR'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'gainful employment': {
    score: 60,
    factors: {
      financial: { score: 15, rationale: 'Program-level penalties.', maxPenalty: 'Program eligibility loss' },
      funding: { score: 18, rationale: 'Programs can lose Title IV eligibility.', typesAtRisk: ['Title IV for specific programs'] },
      accreditation: { score: 10, rationale: 'Outcomes data reviewed by accreditors.', accreditors: ['Programmatic accreditors'] },
      reputation: { score: 10, rationale: 'Poor outcomes can affect enrollment.', cases: [] },
      operations: { score: 7, rationale: 'Requires outcomes tracking.', affected: ['Career Services', 'IR', 'Registrar'] }
    },
    trend: 'INCREASING',
    enforcement: []
  },

  'osha|occupational safety': {
    score: 58,
    factors: {
      financial: { score: 18, rationale: 'Penalties up to $156,259 per willful violation.', maxPenalty: '$156,259 per willful violation' },
      funding: { score: 8, rationale: 'Indirect funding impact.', typesAtRisk: ['State grants potentially'] },
      accreditation: { score: 10, rationale: 'Safety reviewed by accreditors.', accreditors: ['Professional program accreditors'] },
      reputation: { score: 12, rationale: 'Workplace injuries generate coverage.', cases: [] },
      operations: { score: 10, rationale: 'Can shut down facilities.', affected: ['Facilities', 'Labs', 'All workplaces'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'export control|itar|ear': {
    score: 65,
    factors: {
      financial: { score: 22, rationale: 'Criminal penalties up to $1M per violation.', maxPenalty: '$1M per violation, criminal' },
      funding: { score: 15, rationale: 'Can lose defense research contracts.', typesAtRisk: ['DOD contracts', 'Research grants'] },
      accreditation: { score: 8, rationale: 'Limited direct impact.', accreditors: [] },
      reputation: { score: 12, rationale: 'National security violations generate coverage.', cases: [] },
      operations: { score: 8, rationale: 'Requires export control program.', affected: ['Research', 'International Programs', 'IT'] }
    },
    trend: 'INCREASING',
    enforcement: []
  },

  'irb|human subjects|common rule': {
    score: 55,
    factors: {
      financial: { score: 15, rationale: 'Can lose research funding.', maxPenalty: 'Funding termination' },
      funding: { score: 18, rationale: 'Research funding at risk.', typesAtRisk: ['NIH', 'NSF', 'All federal research'] },
      accreditation: { score: 8, rationale: 'Research programs reviewed.', accreditors: ['Research-focused accreditors'] },
      reputation: { score: 10, rationale: 'Research misconduct generates coverage.', cases: [] },
      operations: { score: 4, rationale: 'Requires IRB infrastructure.', affected: ['Research Compliance', 'IRB'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  // MODERATE (30-49)
  'age discrimination': {
    score: 40,
    factors: {
      financial: { score: 10, rationale: 'Individual settlements typically modest.', maxPenalty: 'Back pay, compensatory damages' },
      funding: { score: 10, rationale: 'Federal funding implications.', typesAtRisk: ['Federal funding'] },
      accreditation: { score: 8, rationale: 'Non-discrimination reviewed.', accreditors: ['All regional accreditors'] },
      reputation: { score: 8, rationale: 'Discrimination cases can generate coverage.', cases: [] },
      operations: { score: 4, rationale: 'Policy and training requirements.', affected: ['HR', 'Admissions'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'textbook information': {
    score: 29,
    factors: {
      financial: { score: 8, rationale: 'Minor administrative penalties.', maxPenalty: 'Administrative fines' },
      funding: { score: 8, rationale: 'Part of program participation requirements.', typesAtRisk: ['Title IV'] },
      accreditation: { score: 6, rationale: 'Consumer information reviewed.', accreditors: ['All regional accreditors'] },
      reputation: { score: 4, rationale: 'Limited coverage potential.', cases: [] },
      operations: { score: 3, rationale: 'Requires bookstore coordination.', affected: ['Bookstore', 'Academic Affairs'] }
    },
    trend: 'STABLE',
    enforcement: []
  },

  'copyright|dmca': {
    score: 45,
    factors: {
      financial: { score: 15, rationale: 'Statutory damages up to $150K per willful infringement.', maxPenalty: '$150,000 per willful infringement' },
      funding: { score: 5, rationale: 'Limited direct funding impact.', typesAtRisk: [] },
      accreditation: { score: 5, rationale: 'Limited accreditation impact.', accreditors: [] },
      reputation: { score: 12, rationale: 'Copyright lawsuits can generate coverage.', cases: ['Georgia State e-reserves case'] },
      operations: { score: 8, rationale: 'Requires copyright policies and DMCA agent.', affected: ['Library', 'IT', 'General Counsel'] }
    },
    trend: 'STABLE',
    enforcement: []
  }
};

// Category-based default scores for regulations without specific scores
const CATEGORY_DEFAULTS = {
  'Financial Aid': { score: 65, trend: 'STABLE', factors: { financial: 15, funding: 20, accreditation: 12, reputation: 10, operations: 8 } },
  'Campus Safety': { score: 72, trend: 'INCREASING', factors: { financial: 20, funding: 18, accreditation: 14, reputation: 12, operations: 8 } },
  'Privacy & Information Security': { score: 68, trend: 'INCREASING', factors: { financial: 18, funding: 18, accreditation: 12, reputation: 12, operations: 8 } },
  'Sexual Misconduct': { score: 78, trend: 'INCREASING', factors: { financial: 22, funding: 20, accreditation: 14, reputation: 14, operations: 8 } },
  'Discrimination': { score: 60, trend: 'STABLE', factors: { financial: 15, funding: 15, accreditation: 12, reputation: 12, operations: 6 } },
  'Diversity/Affirmative Action': { score: 55, trend: 'STABLE', factors: { financial: 12, funding: 15, accreditation: 10, reputation: 12, operations: 6 } },
  'Research': { score: 58, trend: 'STABLE', factors: { financial: 15, funding: 18, accreditation: 10, reputation: 10, operations: 5 } },
  'Environmental Health and Safety': { score: 52, trend: 'STABLE', factors: { financial: 16, funding: 8, accreditation: 8, reputation: 10, operations: 10 } },
  'Tax': { score: 48, trend: 'STABLE', factors: { financial: 18, funding: 10, accreditation: 6, reputation: 8, operations: 6 } },
  'Accounting': { score: 50, trend: 'STABLE', factors: { financial: 16, funding: 12, accreditation: 8, reputation: 8, operations: 6 } },
  'Grants Management': { score: 55, trend: 'STABLE', factors: { financial: 14, funding: 18, accreditation: 8, reputation: 8, operations: 7 } },
  'Information Technology': { score: 55, trend: 'INCREASING', factors: { financial: 14, funding: 12, accreditation: 8, reputation: 12, operations: 9 } },
  'Employee Benefits': { score: 42, trend: 'STABLE', factors: { financial: 14, funding: 8, accreditation: 6, reputation: 8, operations: 6 } },
  'Ethics': { score: 48, trend: 'STABLE', factors: { financial: 12, funding: 12, accreditation: 8, reputation: 10, operations: 6 } },
  'Contracts & Procurement': { score: 45, trend: 'STABLE', factors: { financial: 14, funding: 12, accreditation: 6, reputation: 8, operations: 5 } },
  'Copyright & Trademark': { score: 45, trend: 'STABLE', factors: { financial: 15, funding: 5, accreditation: 5, reputation: 12, operations: 8 } },
  'Export Controls': { score: 65, trend: 'INCREASING', factors: { financial: 22, funding: 15, accreditation: 8, reputation: 12, operations: 8 } },
  'Lobbying and Political Activities': { score: 48, trend: 'STABLE', factors: { financial: 15, funding: 12, accreditation: 6, reputation: 10, operations: 5 } },
  'Recruitment Hiring & Termination': { score: 45, trend: 'STABLE', factors: { financial: 12, funding: 10, accreditation: 8, reputation: 10, operations: 5 } },
  'Wages': { score: 48, trend: 'STABLE', factors: { financial: 16, funding: 8, accreditation: 6, reputation: 10, operations: 8 } },
  'Accreditation': { score: 75, trend: 'STABLE', factors: { financial: 15, funding: 22, accreditation: 20, reputation: 10, operations: 8 } },
  'Academic Programs': { score: 45, trend: 'STABLE', factors: { financial: 10, funding: 12, accreditation: 10, reputation: 8, operations: 5 } },
  'Admissions': { score: 50, trend: 'STABLE', factors: { financial: 10, funding: 15, accreditation: 10, reputation: 10, operations: 5 } },
  'Governance': { score: 48, trend: 'STABLE', factors: { financial: 12, funding: 12, accreditation: 10, reputation: 8, operations: 6 } },
  'Intellectual Property and Technology Transfer': { score: 45, trend: 'STABLE', factors: { financial: 14, funding: 10, accreditation: 5, reputation: 10, operations: 6 } },
  'Fundraising & Development': { score: 38, trend: 'STABLE', factors: { financial: 10, funding: 8, accreditation: 6, reputation: 10, operations: 4 } },
  'Housing': { score: 42, trend: 'STABLE', factors: { financial: 10, funding: 10, accreditation: 8, reputation: 10, operations: 4 } },
  'Athletics': { score: 55, trend: 'STABLE', factors: { financial: 12, funding: 15, accreditation: 10, reputation: 12, operations: 6 } },
  'Disabilities': { score: 62, trend: 'INCREASING', factors: { financial: 18, funding: 15, accreditation: 12, reputation: 12, operations: 5 } },
  'Immigration': { score: 50, trend: 'STABLE', factors: { financial: 14, funding: 12, accreditation: 8, reputation: 10, operations: 6 } },
  'Human Resources': { score: 45, trend: 'STABLE', factors: { financial: 12, funding: 10, accreditation: 8, reputation: 10, operations: 5 } },
  'Unions': { score: 40, trend: 'STABLE', factors: { financial: 10, funding: 8, accreditation: 6, reputation: 10, operations: 6 } },
  'Program Integrity Rules': { score: 58, trend: 'STABLE', factors: { financial: 14, funding: 18, accreditation: 10, reputation: 8, operations: 8 } },
  'Student Services': { score: 40, trend: 'STABLE', factors: { financial: 8, funding: 12, accreditation: 8, reputation: 8, operations: 4 } },
  'Auxiliary Services': { score: 35, trend: 'STABLE', factors: { financial: 8, funding: 8, accreditation: 6, reputation: 8, operations: 5 } },
  'Health Care and Insurance': { score: 55, trend: 'STABLE', factors: { financial: 16, funding: 12, accreditation: 10, reputation: 10, operations: 7 } },
  'Retirement': { score: 42, trend: 'STABLE', factors: { financial: 14, funding: 8, accreditation: 6, reputation: 8, operations: 6 } },
  'International Activities and Programs': { score: 45, trend: 'STABLE', factors: { financial: 12, funding: 12, accreditation: 8, reputation: 8, operations: 5 } }
};

// Default for unknown categories
const DEFAULT_SCORE = {
  score: 40,
  trend: 'STABLE',
  factors: { financial: 10, funding: 10, accreditation: 8, reputation: 8, operations: 4 }
};

/**
 * Find the best matching reference score for a regulation
 */
function findReferenceScore(regulation) {
  const nameLower = regulation.name.toLowerCase();
  const statuteLower = (regulation.statute || '').toLowerCase();
  
  for (const [pattern, scoreData] of Object.entries(REFERENCE_SCORES)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(nameLower) || regex.test(statuteLower)) {
      return scoreData;
    }
  }
  return null;
}

/**
 * Calculate risk assessment for a regulation
 */
function calculateRiskAssessment(regulation) {
  const refScore = findReferenceScore(regulation);
  
  if (refScore) {
    // Use reference score
    return {
      score: refScore.score,
      level: getRiskLevel(refScore.score),
      isPreliminary: false,
      factors: {
        financial: {
          score: refScore.factors.financial.score,
          rationale: refScore.factors.financial.rationale,
          maxPenaltyReference: refScore.factors.financial.maxPenalty || null
        },
        funding: {
          score: refScore.factors.funding.score,
          rationale: refScore.factors.funding.rationale,
          fundingTypesAtRisk: refScore.factors.funding.typesAtRisk || []
        },
        accreditation: {
          score: refScore.factors.accreditation.score,
          rationale: refScore.factors.accreditation.rationale,
          accreditorRelevance: refScore.factors.accreditation.accreditors || []
        },
        reputation: {
          score: refScore.factors.reputation.score,
          rationale: refScore.factors.reputation.rationale,
          precedentCases: refScore.factors.reputation.cases || []
        },
        operations: {
          score: refScore.factors.operations.score,
          rationale: refScore.factors.operations.rationale,
          affectedOperations: refScore.factors.operations.affected || []
        }
      },
      trend: refScore.trend,
      enforcement: refScore.enforcement || []
    };
  }
  
  // Use category-based default
  const category = (regulation.category || '').split(',')[0].trim();
  const catDefault = CATEGORY_DEFAULTS[category] || DEFAULT_SCORE;
  
  return {
    score: catDefault.score,
    level: getRiskLevel(catDefault.score),
    isPreliminary: true,
    factors: {
      financial: {
        score: catDefault.factors.financial,
        rationale: `Category-based assessment for ${category} regulations.`,
        maxPenaltyReference: null
      },
      funding: {
        score: catDefault.factors.funding,
        rationale: `Federal funding implications typical for ${category}.`,
        fundingTypesAtRisk: []
      },
      accreditation: {
        score: catDefault.factors.accreditation,
        rationale: `Accreditation relevance typical for ${category}.`,
        accreditorRelevance: []
      },
      reputation: {
        score: catDefault.factors.reputation,
        rationale: `Reputational exposure typical for ${category}.`,
        precedentCases: []
      },
      operations: {
        score: catDefault.factors.operations,
        rationale: `Operational impact typical for ${category}.`,
        affectedOperations: []
      }
    },
    trend: catDefault.trend,
    enforcement: []
  };
}

/**
 * Main function to calculate and store risk scores
 */
async function calculateAllRiskScores() {
  console.log('═'.repeat(70));
  console.log('    MCP ENGINE: Institutional Risk Score Calculator');
  console.log('═'.repeat(70));
  console.log('');
  
  // Get all regulations
  const regulations = await pool.query(`
    SELECT id, item_id, name, statute, category 
    FROM regulations 
    WHERE is_current = TRUE 
    ORDER BY name
  `);
  
  console.log(`Found ${regulations.rows.length} regulations to score\n`);
  
  let scored = 0;
  let updated = 0;
  let critical = 0, severe = 0, high = 0, moderate = 0, low = 0;
  
  for (const reg of regulations.rows) {
    const assessment = calculateRiskAssessment(reg);
    
    // Count by level
    switch (assessment.level) {
      case 'CRITICAL': critical++; break;
      case 'SEVERE': severe++; break;
      case 'HIGH': high++; break;
      case 'MODERATE': moderate++; break;
      case 'LOW': low++; break;
    }
    
    // Upsert risk assessment
    const result = await pool.query(`
      INSERT INTO risk_assessments (
        regulation_id, risk_score, risk_level,
        financial_penalty, federal_funding, accreditation_impact,
        reputational_legal, operational_disruption,
        enforcement_trend, recent_enforcement_actions,
        data_sources, is_preliminary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (regulation_id) DO UPDATE SET
        risk_score = EXCLUDED.risk_score,
        risk_level = EXCLUDED.risk_level,
        financial_penalty = EXCLUDED.financial_penalty,
        federal_funding = EXCLUDED.federal_funding,
        accreditation_impact = EXCLUDED.accreditation_impact,
        reputational_legal = EXCLUDED.reputational_legal,
        operational_disruption = EXCLUDED.operational_disruption,
        enforcement_trend = EXCLUDED.enforcement_trend,
        recent_enforcement_actions = EXCLUDED.recent_enforcement_actions,
        is_preliminary = EXCLUDED.is_preliminary,
        updated_at = NOW()
      RETURNING (xmax = 0) as was_inserted
    `, [
      reg.id,
      assessment.score,
      assessment.level,
      JSON.stringify(assessment.factors.financial),
      JSON.stringify(assessment.factors.funding),
      JSON.stringify(assessment.factors.accreditation),
      JSON.stringify(assessment.factors.reputation),
      JSON.stringify(assessment.factors.operations),
      assessment.trend,
      JSON.stringify(assessment.enforcement),
      ['MCP Engine Risk Framework v1.0', 'ED FSA Data', 'Chronicle of Higher Education'],
      assessment.isPreliminary
    ]);
    
    if (result.rows[0].was_inserted) {
      scored++;
    } else {
      updated++;
    }
  }
  
  console.log('─'.repeat(70));
  console.log('RISK SCORE DISTRIBUTION');
  console.log('─'.repeat(70));
  console.log(`  CRITICAL (90-100): ${critical} regulations`);
  console.log(`  SEVERE (70-89):    ${severe} regulations`);
  console.log(`  HIGH (50-69):      ${high} regulations`);
  console.log(`  MODERATE (30-49):  ${moderate} regulations`);
  console.log(`  LOW (1-29):        ${low} regulations`);
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`New scores created: ${scored}`);
  console.log(`Existing scores updated: ${updated}`);
  console.log(`Total: ${scored + updated}`);
  
  // Show top 10 highest risk
  const topRisk = await pool.query(`
    SELECT r.name, ra.risk_score, ra.risk_level
    FROM risk_assessments ra
    JOIN regulations r ON r.id = ra.regulation_id
    ORDER BY ra.risk_score DESC
    LIMIT 10
  `);
  
  console.log('\n─'.repeat(70));
  console.log('TOP 10 HIGHEST RISK REGULATIONS');
  console.log('─'.repeat(70));
  topRisk.rows.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name.substring(0, 50)}...`);
    console.log(`     Score: ${r.risk_score} (${r.risk_level})`);
  });
  
  await pool.end();
}

calculateAllRiskScores().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
