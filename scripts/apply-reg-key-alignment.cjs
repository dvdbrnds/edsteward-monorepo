#!/usr/bin/env node

/**
 * EdSteward: Universal REG-KEY Alignment Script
 * Generated from MCP Engine master mapping (ordered by Institutional Risk Score)
 * REG-001 = Highest Risk (Clery Act, Score: 96)
 * REG-251 = Lowest Risk (Textbook Information, Score: 29)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

// Complete REG-KEY mapping from MCP Engine
const regKeyMapping = [
  { regKey: 'REG-001', itemId: 'jeanne-clery-disclosure-of-campus-security-policy-' },
  { regKey: 'REG-002', itemId: 'title-ix' },
  { regKey: 'REG-003', itemId: 'title-ix-of-the-education-amendment-of-1972' },
  { regKey: 'REG-004', itemId: 'family-educational-rights-and-privacy-act-ferpa' },
  { regKey: 'REG-005', itemId: 'new-jersey-campus-sex-assault-victim-bill-of-rights' },
  { regKey: 'REG-006', itemId: 'pennsylvania-sexual-violence-education-act' },
  { regKey: 'REG-007', itemId: 'campus-sex-crimes-prevention-act-1601-of-the-victi' },
  { regKey: 'REG-008', itemId: 'title-vi-of-the-civil-rights-act-of-1964' },
  { regKey: 'REG-009', itemId: 'title-vi-of-the-civil-rights-act-of-1964-42-u-s-c-' },
  { regKey: 'REG-010', itemId: 'title-vii-of-the-civil-rights-act-of-1964' },
  { regKey: 'REG-011', itemId: 'false-claims-act' },
  { regKey: 'REG-012', itemId: 'higher-education-act-recognition-of-accrediting-ag' },
  { regKey: 'REG-013', itemId: 'new-jersey-licensure-accreditation-standards' },
  { regKey: 'REG-014', itemId: 'pennsylvania-institutional-accreditation' },
  { regKey: 'REG-015', itemId: 'americans-with-disabilities-act' },
  { regKey: 'REG-016', itemId: 'americans-with-disabilities-act-of-1990' },
  { regKey: 'REG-017', itemId: 'equity-in-athletics-disclosure-act-eada' },
  { regKey: 'REG-018', itemId: 'section-504-of-the-rehabilitation-act-of-1973' },
  { regKey: 'REG-019', itemId: 'emergency-planning-and-community-right-to-know-act' },
  { regKey: 'REG-020', itemId: 'hipaa' },
  { regKey: 'REG-021', itemId: 'health-insurance-portability-and-accountability-act' },
  { regKey: 'REG-022', itemId: 'health-insurance-portability-and-accountability-ac' },
  { regKey: 'REG-023', itemId: 'higher-education-act-drug-and-alcohol-abuse-preven' },
  { regKey: 'REG-024', itemId: 'new-jersey-hazing-prevention' },
  { regKey: 'REG-025', itemId: 'new-jersey-uniform-crime-reporting' },
  { regKey: 'REG-026', itemId: 'pennsylvania-uniform-crime-reporting-act' },
  { regKey: 'REG-027', itemId: 'children-s-online-privacy-protection-act-of-1998-c' },
  { regKey: 'REG-028', itemId: 'electronic-communications-privacy-act' },
  { regKey: 'REG-029', itemId: 'fair-and-accurate-credit-transaction-act-facta' },
  { regKey: 'REG-030', itemId: 'federal-information-security-management-act-fisma' },
  { regKey: 'REG-031', itemId: 'freedom-of-information-act' },
  { regKey: 'REG-032', itemId: 'gramm-leach-bliley-act-glba' },
  { regKey: 'REG-033', itemId: 'health-information-technology-for-economic-and-cli' },
  { regKey: 'REG-034', itemId: 'arms-export-control-act-of-1976' },
  { regKey: 'REG-035', itemId: 'contracts-with-third-party-servicers' },
  { regKey: 'REG-036', itemId: 'cooperative-research-and-technology-enhancement-ac' },
  { regKey: 'REG-037', itemId: 'export-administration-act-of-1979' },
  { regKey: 'REG-038', itemId: 'export-administration-regulations' },
  { regKey: 'REG-039', itemId: 'foreign-assets-control-regulations' },
  { regKey: 'REG-040', itemId: 'higher-education-act-aid-application-verification' },
  { regKey: 'REG-041', itemId: 'higher-education-act-audits' },
  { regKey: 'REG-042', itemId: 'higher-education-act-borrower-defense-to-repayment' },
  { regKey: 'REG-043', itemId: 'higher-education-act-cash-management' },
  { regKey: 'REG-044', itemId: 'higher-education-act-cohort-default-rate' },
  { regKey: 'REG-045', itemId: 'higher-education-act-eligibility-and-certification' },
  { regKey: 'REG-046', itemId: 'higher-education-act-entrance-and-exit-counseling' },
  { regKey: 'REG-047', itemId: 'higher-education-act-federal-supplemental-educatio' },
  { regKey: 'REG-048', itemId: 'higher-education-act-federal-work-study' },
  { regKey: 'REG-049', itemId: 'higher-education-act-financial-responsibility-requ' },
  { regKey: 'REG-050', itemId: 'higher-education-act-information-distributed-to-st' },
  { regKey: 'REG-051', itemId: 'higher-education-act-net-price-calculator' },
  { regKey: 'REG-052', itemId: 'higher-education-act-plus-loans' },
  { regKey: 'REG-053', itemId: 'higher-education-act-penalties-for-drug-violations' },
  { regKey: 'REG-054', itemId: 'higher-education-act-perkins-loans' },
  { regKey: 'REG-055', itemId: 'higher-education-act-preferred-lenders' },
  { regKey: 'REG-056', itemId: 'higher-education-act-program-participation-agreeme' },
  { regKey: 'REG-057', itemId: 'higher-education-act-record-retention' },
  { regKey: 'REG-058', itemId: 'higher-education-act-standard-of-conduct' },
  { regKey: 'REG-059', itemId: 'international-emergency-economic-powers-act' },
  { regKey: 'REG-060', itemId: 'international-traffic-in-arms-regulations-itar' },
  { regKey: 'REG-061', itemId: 'national-science-foundation-research-misconduct-po' },
  { regKey: 'REG-062', itemId: 'new-jersey-tuition-aid-grant-program' },
  { regKey: 'REG-063', itemId: 'new-jersey-veterans-benefits-compliance' },
  { regKey: 'REG-064', itemId: 'outside-earned-income-and-activities' },
  { regKey: 'REG-065', itemId: 'public-health-service-policies-on-research-miscond' },
  { regKey: 'REG-066', itemId: 'responsibility-of-applicants-for-promoting-objecti' },
  { regKey: 'REG-067', itemId: 'student-loan-default-prevention-initiative-act-of-' },
  { regKey: 'REG-068', itemId: 'student-right-to-know-act' },
  { regKey: 'REG-069', itemId: 'teacher-preparation-programs' },
  { regKey: 'REG-070', itemId: 'trading-with-the-enemy-act-of-1917' },
  { regKey: 'REG-071', itemId: 'fair-housing-act-section-6' },
  { regKey: 'REG-072', itemId: 'patient-protection-and-affordable-care-act-section' },
  { regKey: 'REG-073', itemId: 'equal-employment-opportunity' },
  { regKey: 'REG-074', itemId: 'higher-education-act-financial-value-transparency-' },
  { regKey: 'REG-075', itemId: 'pregnant-workers-fairness-act-pwfa' },
  { regKey: 'REG-076', itemId: 'the-equal-pay-act-of-1963' },
  { regKey: 'REG-077', itemId: 'the-family-and-medical-leave-act-of-1993' },
  { regKey: 'REG-078', itemId: 'america-competes-act' },
  { regKey: 'REG-079', itemId: 'animal-welfare-act' },
  { regKey: 'REG-080', itemId: 'clinical-trials-financial-disclosures-by-investiga' },
  { regKey: 'REG-081', itemId: 'food-and-drug-administration-fda-amendments-act-of' },
  { regKey: 'REG-082', itemId: 'higher-education-act-credit-hour-definition' },
  { regKey: 'REG-083', itemId: 'higher-education-act-incentive-compensation-prohib' },
  { regKey: 'REG-084', itemId: 'higher-education-act-misrepresentation' },
  { regKey: 'REG-085', itemId: 'higher-education-act-state-authorization' },
  { regKey: 'REG-086', itemId: 'native-american-graves-protection-and-repatriation' },
  { regKey: 'REG-087', itemId: 'osha' },
  { regKey: 'REG-088', itemId: 'osha-asbestos-in-construction-standard' },
  { regKey: 'REG-089', itemId: 'osha-asbestos-in-general-industry-standard' },
  { regKey: 'REG-090', itemId: 'osha-enforcement-guidance-for-personal-protective-' },
  { regKey: 'REG-091', itemId: 'osha-lead-in-construction-standard' },
  { regKey: 'REG-092', itemId: 'osha-lead-in-general-industry-standard' },
  { regKey: 'REG-093', itemId: 'osha-welding-cutting-and-brazing' },
  { regKey: 'REG-094', itemId: 'osha-bloodborne-pathogens-standard' },
  { regKey: 'REG-095', itemId: 'osha-s-emergency-action-plan-standard' },
  { regKey: 'REG-096', itemId: 'osha-s-occupational-noise-exposure-standard' },
  { regKey: 'REG-097', itemId: 'osha-s-occupational-exposure-to-hazardous-chemical' },
  { regKey: 'REG-098', itemId: 'occupational-safety-and-health-act-of-1970' },
  { regKey: 'REG-099', itemId: 'small-unmanned-aircraft-systems' },
  { regKey: 'REG-100', itemId: 'affirmative-action-equal-employment-opportunity' },
  { regKey: 'REG-101', itemId: 'communications-assistance-for-law-enforcement-act-' },
  { regKey: 'REG-102', itemId: 'controlled-substances-act' },
  { regKey: 'REG-103', itemId: 'controlling-the-assault-of-non-solicited-pornograp' },
  { regKey: 'REG-104', itemId: 'department-of-education-general-administrative-reg' },
  { regKey: 'REG-105', itemId: 'electronic-communications-privacy-act-of-1986' },
  { regKey: 'REG-106', itemId: 'equal-employment-of-veterans' },
  { regKey: 'REG-107', itemId: 'equal-pay-act-of-1963' },
  { regKey: 'REG-108', itemId: 'fcc-cable-certification' },
  { regKey: 'REG-109', itemId: 'fcc-fixed-microwave-services-licensing' },
  { regKey: 'REG-110', itemId: 'fcc-wireless-communications-licensing' },
  { regKey: 'REG-111', itemId: 'federal-awardee-performance-and-integrity-informat' },
  { regKey: 'REG-112', itemId: 'federal-funding-accountability-and-transparency-ac' },
  { regKey: 'REG-113', itemId: 'fraud-enforcement-and-recovery-act-of-2009-fera' },
  { regKey: 'REG-114', itemId: 'genetic-information-non-discrimination-act-of-2008' },
  { regKey: 'REG-115', itemId: 'hazardous-materials-transportation-act' },
  { regKey: 'REG-116', itemId: 'homeland-security-act-of-2002' },
  { regKey: 'REG-117', itemId: 'junk-fax-prevention-act-of-2005' },
  { regKey: 'REG-118', itemId: 'lilly-ledbetter-fair-pay-act-of-2009' },
  { regKey: 'REG-119', itemId: 'no-electronic-theft-act' },
  { regKey: 'REG-120', itemId: 'protection-of-human-subjects-regulations-common-ru' },
  { regKey: 'REG-121', itemId: 'telemarketing' },
  { regKey: 'REG-122', itemId: 'unknown' },
  { regKey: 'REG-123', itemId: 'veterans-employment-emphasis-under-federal-contrac' },
  { regKey: 'REG-124', itemId: 'atomic-energy-act-of-1954' },
  { regKey: 'REG-125', itemId: 'chemical-facility-anti-terrorism-standards' },
  { regKey: 'REG-126', itemId: 'clean-air-act' },
  { regKey: 'REG-127', itemId: 'clean-water-act' },
  { regKey: 'REG-128', itemId: 'comprehensive-environmental-response-compensation-' },
  { regKey: 'REG-129', itemId: 'drug-free-schools-and-communities-act' },
  { regKey: 'REG-130', itemId: 'drug-free-workplace-act' },
  { regKey: 'REG-131', itemId: 'emergency-planning-and-community-right-act-epcra' },
  { regKey: 'REG-132', itemId: 'energy-policy-act' },
  { regKey: 'REG-133', itemId: 'energy-reorganization-act-of-1974-as-amended' },
  { regKey: 'REG-134', itemId: 'federal-insecticide-fungicide-and-rodenticide-act' },
  { regKey: 'REG-135', itemId: 'guarding-and-use-of-hand-portable-powered-tools' },
  { regKey: 'REG-136', itemId: 'hazardous-and-solid-waste-amendments-of-1984' },
  { regKey: 'REG-137', itemId: 'higher-education-opportunity-act' },
  { regKey: 'REG-138', itemId: 'higher-education-opportunity-act-sections-152-and-' },
  { regKey: 'REG-139', itemId: 'housing-urban-development-lead-based-paint-poisoni' },
  { regKey: 'REG-140', itemId: 'mandatory-reporting-of-greenhouse-gases' },
  { regKey: 'REG-141', itemId: 'motor-carrier-act-of-1980' },
  { regKey: 'REG-142', itemId: 'national-emission-standards-for-hazardous-air-poll' },
  { regKey: 'REG-143', itemId: 'oil-pollution-act' },
  { regKey: 'REG-144', itemId: 'residential-lead-based-paint-hazard-reduction-act-' },
  { regKey: 'REG-145', itemId: 'resource-conservation-and-recovery-act' },
  { regKey: 'REG-146', itemId: 'standards-for-the-management-of-used-oil' },
  { regKey: 'REG-147', itemId: 'the-public-health-security-and-bioterrorism-prepar' },
  { regKey: 'REG-148', itemId: 'toxic-substances-control-act' },
  { regKey: 'REG-149', itemId: 'bankruptcy-abuse-prevention-consumer-protection-ac' },
  { regKey: 'REG-150', itemId: 'clayton-antitrust-act-of-1914' },
  { regKey: 'REG-151', itemId: 'federal-unemployment-tax-act-futa' },
  { regKey: 'REG-152', itemId: 'higher-education-act-disclosure-of-foreign-gifts' },
  { regKey: 'REG-153', itemId: 'higher-education-act-readmission-requirements-for-' },
  { regKey: 'REG-154', itemId: 'immigration-and-nationality-act-ina' },
  { regKey: 'REG-155', itemId: 'regulation-e-electronic-fund-transfers' },
  { regKey: 'REG-156', itemId: 'sarbanes-oxley-act-of-2002-sox' },
  { regKey: 'REG-157', itemId: 'sherman-antitrust-act' },
  { regKey: 'REG-158', itemId: 'social-security-act' },
  { regKey: 'REG-159', itemId: 'student-exchange-and-visitor-information-system-se' },
  { regKey: 'REG-160', itemId: 'tax-cuts-and-jobs-act-of-2017-endowment-excise-tax' },
  { regKey: 'REG-161', itemId: 'truth-in-lending-act' },
  { regKey: 'REG-162', itemId: 'uniform-administrative-requirements-cost-principle' },
  { regKey: 'REG-163', itemId: 'unrelated-business-income-tax-ubit' },
  { regKey: 'REG-164', itemId: 'acts-affecting-a-personal-financial-interest' },
  { regKey: 'REG-165', itemId: 'bribery-of-public-officials-and-witnesses' },
  { regKey: 'REG-166', itemId: 'byrd-amendment' },
  { regKey: 'REG-167', itemId: 'cafeteria-plans-26-u-s-c-125' },
  { regKey: 'REG-168', itemId: 'charitable-gift-annuity-antitrust-relief-act' },
  { regKey: 'REG-169', itemId: 'compensation-to-members-of-congress-officers-other' },
  { regKey: 'REG-170', itemId: 'consumer-credit-protection-act-title-iii-ccpa-garn' },
  { regKey: 'REG-171', itemId: 'deferred-compensation' },
  { regKey: 'REG-172', itemId: 'employee-annuities' },
  { regKey: 'REG-173', itemId: 'ethics-in-government-act-amended-by-ethics-reform-' },
  { regKey: 'REG-174', itemId: 'fair-labor-standards-act-flsa' },
  { regKey: 'REG-175', itemId: 'federal-insurance-contributions-act-fica' },
  { regKey: 'REG-176', itemId: 'federal-sentencing-guidelines' },
  { regKey: 'REG-177', itemId: 'federal-unemployment-tax-act' },
  { regKey: 'REG-178', itemId: 'foreign-bank-accounts-and-tax-filings' },
  { regKey: 'REG-179', itemId: 'fringe-benefits' },
  { regKey: 'REG-180', itemId: 'honest-leadership-and-open-government-act-of-2007' },
  { regKey: 'REG-181', itemId: 'house-and-senate-gift-ban-and-ethics-rules' },
  { regKey: 'REG-182', itemId: 'independent-contractors' },
  { regKey: 'REG-183', itemId: 'industrial-alcohol-user-permits-and-special-tax' },
  { regKey: 'REG-184', itemId: 'internal-revenue-service-governance-information-re' },
  { regKey: 'REG-185', itemId: 'lobbying-disclosure-act' },
  { regKey: 'REG-186', itemId: 'nonqualified-deferred-inclusion' },
  { regKey: 'REG-187', itemId: 'pennsylvania-higher-education-gift-disclosure-act' },
  { regKey: 'REG-188', itemId: 'political-activities' },
  { regKey: 'REG-189', itemId: 'public-disclosure-of-material' },
  { regKey: 'REG-190', itemId: 'qualified-pensions' },
  { regKey: 'REG-191', itemId: 'qualified-tuition-reductions' },
  { regKey: 'REG-192', itemId: 'qualified-tuition-and-student-loan-interest-report' },
  { regKey: 'REG-193', itemId: 'reporting-of-payments-of-royalties' },
  { regKey: 'REG-194', itemId: 'restrictions-on-former-officers-employees-and-elec' },
  { regKey: 'REG-195', itemId: 'salary-of-government-officials-and-employees-payab' },
  { regKey: 'REG-196', itemId: 'small-business-job-protection-act' },
  { regKey: 'REG-197', itemId: 'unrelated-business-income-ubit' },
  { regKey: 'REG-198', itemId: 'american-jobs-creation-act-of-2004' },
  { regKey: 'REG-199', itemId: 'anti-kickback-act-of-1986' },
  { regKey: 'REG-200', itemId: 'anti-discrimination-laws-for-federal-contractors' },
  { regKey: 'REG-201', itemId: 'bayh-dole-act-of-1980' },
  { regKey: 'REG-202', itemId: 'copeland-anti-kickback-act' },
  { regKey: 'REG-203', itemId: 'copyright-act' },
  { regKey: 'REG-204', itemId: 'copyright-term-extension-act' },
  { regKey: 'REG-205', itemId: 'davis-bacon-act' },
  { regKey: 'REG-206', itemId: 'digital-millennium-copyright-act-dmca' },
  { regKey: 'REG-207', itemId: 'drug-alcohol-testing-of-transportation-employees' },
  { regKey: 'REG-208', itemId: 'e-verify-executive-order-13465-amending-executive-' },
  { regKey: 'REG-209', itemId: 'employee-polygraph-protection-act' },
  { regKey: 'REG-210', itemId: 'fair-credit-reporting-act-fcra' },
  { regKey: 'REG-211', itemId: 'federal-volunteer-protection-act' },
  { regKey: 'REG-212', itemId: 'foreign-agents-registration-act-of-1938' },
  { regKey: 'REG-213', itemId: 'foreign-corrupt-practices-act-fcpa' },
  { regKey: 'REG-214', itemId: 'higher-education-act-institutional-and-financial-a' },
  { regKey: 'REG-215', itemId: 'immigration-and-nationality-act' },
  { regKey: 'REG-216', itemId: 'lanham-act' },
  { regKey: 'REG-217', itemId: 'nsf-grant-term-and-condition-september-21-2018' },
  { regKey: 'REG-218', itemId: 'non-retaliation-for-disclosure-of-compensation-inf' },
  { regKey: 'REG-219', itemId: 'pennsylvania-english-fluency-in-higher-education-a' },
  { regKey: 'REG-220', itemId: 'pennsylvania-graduation-rates-reporting-act' },
  { regKey: 'REG-221', itemId: 'pennsylvania-higher-education-standards' },
  { regKey: 'REG-222', itemId: 'small-business-act-and-small-business-investment-a' },
  { regKey: 'REG-223', itemId: 'small-webcasters-settlement-act-of-2002' },
  { regKey: 'REG-224', itemId: 'technology-education-and-copyright-harmonization-a' },
  { regKey: 'REG-225', itemId: 'trade-sanctions-reform-and-export-enhancement' },
  { regKey: 'REG-226', itemId: 'trademark-revision-act' },
  { regKey: 'REG-227', itemId: 'u-s-patent-act' },
  { regKey: 'REG-228', itemId: 'visual-artists-rights-act' },
  { regKey: 'REG-229', itemId: 'worker-adjustment-and-retraining-notification-act-' },
  { regKey: 'REG-230', itemId: 'cafeteria-plan-regulations' },
  { regKey: 'REG-231', itemId: 'consolidated-omnibus-budget-reconciliation-act-cob' },
  { regKey: 'REG-232', itemId: 'employee-retirement-income-security-act-of-1974-er' },
  { regKey: 'REG-233', itemId: 'medicare-medicaid-and-schip-extension-act-of-2007' },
  { regKey: 'REG-234', itemId: 'patient-protection-and-affordable-care-act' },
  { regKey: 'REG-235', itemId: 'the-veterans-readjustment-benefits-act' },
  { regKey: 'REG-236', itemId: 'uniformed-services-employment-and-reemployment-rig' },
  { regKey: 'REG-237', itemId: 'age-discrimination-act-of-1975' },
  { regKey: 'REG-238', itemId: 'age-discrimination-employment-act-of-1967' },
  { regKey: 'REG-239', itemId: 'age-discrimination-in-employment-act-of-1967' },
  { regKey: 'REG-240', itemId: 'california-consumer-privacy-act' },
  { regKey: 'REG-241', itemId: 'civil-service-reform-act-of-1978' },
  { regKey: 'REG-242', itemId: 'general-data-protection-regulation' },
  { regKey: 'REG-243', itemId: 'national-labor-relations-act' },
  { regKey: 'REG-244', itemId: 'pennsylvania-student-consumer-protection' },
  { regKey: 'REG-245', itemId: 'higher-education-act-code-of-conduct' },
  { regKey: 'REG-246', itemId: 'higher-education-act-foreign-gift-and-contract-rep' },
  { regKey: 'REG-247', itemId: 'internal-revenue-code-substantiation-and-disclosur' },
  { regKey: 'REG-248', itemId: 'pension-protection-act' },
  { regKey: 'REG-249', itemId: 'philanthropy-protection-act-of-1995' },
  { regKey: 'REG-250', itemId: 'higher-education-act-textbook-informatoin' },
  { regKey: 'REG-251', itemId: 'higher-education-act-textbook-information' },
];

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(70));
    console.log('EdSteward: Universal REG-KEY Alignment Script');
    console.log('='.repeat(70));
    console.log('');
    
    // Step 1: Ensure reg_key column exists
    console.log('Step 1: Ensuring reg_key column exists...');
    await client.query(`
      ALTER TABLE regulations ADD COLUMN IF NOT EXISTS reg_key VARCHAR(10) UNIQUE
    `);
    console.log('  ✓ reg_key column ready');
    
    // Create index if not exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_regulations_reg_key ON regulations(reg_key)
    `);
    console.log('  ✓ Index on reg_key ready');
    console.log('');
    
    // Step 2: First, let's see what item_ids we actually have
    console.log('Step 2: Analyzing current database state...');
    const existingRegs = await client.query(`
      SELECT id, item_id, name, reg_key 
      FROM regulations 
      ORDER BY id
    `);
    console.log(`  Found ${existingRegs.rows.length} regulations in database`);
    
    const existingItemIds = new Set(existingRegs.rows.map(r => r.item_id));
    console.log(`  Unique item_ids in DB: ${existingItemIds.size}`);
    console.log('');
    
    // Step 3: Apply REG-KEY updates
    console.log('Step 3: Applying REG-KEY assignments...');
    let updated = 0;
    let notFound = 0;
    const notFoundList = [];
    
    for (const mapping of regKeyMapping) {
      const result = await client.query(
        `UPDATE regulations SET reg_key = $1 WHERE item_id = $2 AND (reg_key IS NULL OR reg_key != $1) RETURNING id, name`,
        [mapping.regKey, mapping.itemId]
      );
      
      if (result.rowCount > 0) {
        updated++;
        console.log(`  ✓ ${mapping.regKey}: ${result.rows[0].name.substring(0, 50)}...`);
      } else {
        // Check if already has correct reg_key
        const check = await client.query(
          `SELECT id, reg_key FROM regulations WHERE item_id = $1`,
          [mapping.itemId]
        );
        if (check.rows.length > 0 && check.rows[0].reg_key === mapping.regKey) {
          // Already correct, don't count as not found
        } else if (check.rows.length === 0) {
          notFound++;
          notFoundList.push({ regKey: mapping.regKey, itemId: mapping.itemId });
        }
      }
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Regulations updated: ${updated}`);
    console.log(`  Already correct: ${regKeyMapping.length - updated - notFound}`);
    console.log(`  Not found in DB: ${notFound}`);
    
    // Step 4: Verify results
    console.log('');
    console.log('Step 4: Verification...');
    const verification = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(reg_key) as with_reg_key,
        COUNT(DISTINCT reg_key) as unique_reg_keys
      FROM regulations
    `);
    
    const v = verification.rows[0];
    console.log(`  Total regulations: ${v.total}`);
    console.log(`  With reg_key: ${v.with_reg_key}`);
    console.log(`  Unique reg_keys: ${v.unique_reg_keys}`);
    
    // Show first 10 by reg_key
    console.log('');
    console.log('Top 10 Regulations by Risk (REG-001 = Highest Risk):');
    console.log('-'.repeat(70));
    const top10 = await client.query(`
      SELECT reg_key, name 
      FROM regulations 
      WHERE reg_key IS NOT NULL 
      ORDER BY reg_key 
      LIMIT 10
    `);
    
    for (const row of top10.rows) {
      console.log(`  ${row.reg_key}: ${row.name.substring(0, 55)}...`);
    }
    
    // Show regulations without reg_key
    const noRegKey = await client.query(`
      SELECT id, item_id, name 
      FROM regulations 
      WHERE reg_key IS NULL 
      ORDER BY id 
      LIMIT 10
    `);
    
    if (noRegKey.rows.length > 0) {
      console.log('');
      console.log('Regulations WITHOUT reg_key (first 10):');
      console.log('-'.repeat(70));
      for (const row of noRegKey.rows) {
        console.log(`  ID ${row.id}: ${row.item_id} - ${row.name.substring(0, 40)}...`);
      }
    }
    
    // Show not found item_ids for debugging
    if (notFoundList.length > 0 && notFoundList.length <= 20) {
      console.log('');
      console.log('Item IDs not found in database:');
      console.log('-'.repeat(70));
      for (const nf of notFoundList) {
        console.log(`  ${nf.regKey}: ${nf.itemId}`);
      }
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('REG-KEY ALIGNMENT COMPLETE');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
