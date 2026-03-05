#!/usr/bin/env node
/**
 * EdSteward: Add REG-KEY Universal Identifier Column
 * 
 * This script:
 * 1. Adds reg_key, risk_score, risk_level columns to regulations table
 * 2. Creates an index on reg_key for fast lookups
 * 3. Updates all 251 regulations with their assigned REG-XXX keys
 * 
 * Run with: node scripts/add-reg-key-column.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Complete REG-KEY mapping ordered by Institutional Risk Score
// REG-001 = highest risk (96), REG-251 = lowest risk (29)
const REG_KEY_MAPPING = [
  { regKey: 'REG-001', itemId: 'jeanne-clery-disclosure-of-campus-security-policy-', riskScore: 96, riskLevel: 'CRITICAL' },
  { regKey: 'REG-002', itemId: 'title-ix', riskScore: 88, riskLevel: 'SEVERE' },
  { regKey: 'REG-003', itemId: 'title-ix-of-the-education-amendment-of-1972', riskScore: 88, riskLevel: 'SEVERE' },
  { regKey: 'REG-004', itemId: 'family-educational-rights-and-privacy-act-ferpa', riskScore: 85, riskLevel: 'SEVERE' },
  { regKey: 'REG-005', itemId: 'new-jersey-campus-sex-assault-victim-bill-of-rights', riskScore: 78, riskLevel: 'SEVERE' },
  { regKey: 'REG-006', itemId: 'pennsylvania-sexual-violence-education-act', riskScore: 78, riskLevel: 'SEVERE' },
  { regKey: 'REG-007', itemId: 'campus-sex-crimes-prevention-act-1601-of-the-victi', riskScore: 77, riskLevel: 'SEVERE' },
  { regKey: 'REG-008', itemId: 'title-vi-of-the-civil-rights-act-of-1964', riskScore: 77, riskLevel: 'SEVERE' },
  { regKey: 'REG-009', itemId: 'title-vi-of-the-civil-rights-act-of-1964-42-u-s-c-', riskScore: 77, riskLevel: 'SEVERE' },
  { regKey: 'REG-010', itemId: 'title-vii-of-the-civil-rights-act-of-1964', riskScore: 77, riskLevel: 'SEVERE' },
  { regKey: 'REG-011', itemId: 'false-claims-act', riskScore: 75, riskLevel: 'SEVERE' },
  { regKey: 'REG-012', itemId: 'higher-education-act-recognition-of-accrediting-ag', riskScore: 75, riskLevel: 'SEVERE' },
  { regKey: 'REG-013', itemId: 'new-jersey-licensure-accreditation-standards', riskScore: 75, riskLevel: 'SEVERE' },
  { regKey: 'REG-014', itemId: 'pennsylvania-institutional-accreditation', riskScore: 75, riskLevel: 'SEVERE' },
  { regKey: 'REG-015', itemId: 'americans-with-disabilities-act', riskScore: 74, riskLevel: 'SEVERE' },
  { regKey: 'REG-016', itemId: 'americans-with-disabilities-act-of-1990', riskScore: 74, riskLevel: 'SEVERE' },
  { regKey: 'REG-017', itemId: 'equity-in-athletics-disclosure-act-eada', riskScore: 74, riskLevel: 'SEVERE' },
  { regKey: 'REG-018', itemId: 'section-504-of-the-rehabilitation-act-of-1973', riskScore: 74, riskLevel: 'SEVERE' },
  { regKey: 'REG-019', itemId: 'emergency-planning-and-community-right-to-know-act', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-020', itemId: 'hipaa', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-021', itemId: 'new-jersey-law-against-discrimination', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-022', itemId: 'new-jersey-security-officer-registration-act-sora-', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-023', itemId: 'pennsylvania-human-relations-act', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-024', itemId: 'pennsylvania-workers-compensation-act', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-025', itemId: 'student-right-to-know-and-campus-security-act', riskScore: 72, riskLevel: 'SEVERE' },
  { regKey: 'REG-026', itemId: 'controlled-substances-act', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-027', itemId: 'drug-free-schools-and-communities-act', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-028', itemId: 'drug-free-workplace-act-of-1988', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-029', itemId: 'federal-student-aid-program-participation-agreement', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-030', itemId: 'gramm-leach-bliley-act-glba', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-031', itemId: 'new-jersey-conscience-clause', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-032', itemId: 'new-jersey-drug-free-workplace-act', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-033', itemId: 'new-jersey-employment-discrimination-requirements', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-034', itemId: 'new-jersey-paid-sick-leave-act', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-035', itemId: 'new-jersey-wage-and-hour-laws', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-036', itemId: 'new-jersey-workers-compensation', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-037', itemId: 'occupational-safety-and-health-act-osha', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-038', itemId: 'pennsylvania-drug-free-workplace-requirements', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-039', itemId: 'pennsylvania-employment-discrimination-prohibitions', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-040', itemId: 'pennsylvania-minimum-wage-act', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-041', itemId: 'pennsylvania-osha-state-plan', riskScore: 70, riskLevel: 'HIGH' },
  { regKey: 'REG-042', itemId: 'fair-labor-standards-act-flsa', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-043', itemId: 'federal-trade-commission-act', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-044', itemId: 'higher-education-act-title-iv', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-045', itemId: 'new-jersey-child-abuse-reporting', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-046', itemId: 'new-jersey-family-leave-act', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-047', itemId: 'pennsylvania-child-abuse-reporting', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-048', itemId: 'pennsylvania-school-code', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-049', itemId: 'state-authorization-reciprocity-agreement-sara', riskScore: 68, riskLevel: 'HIGH' },
  { regKey: 'REG-050', itemId: 'anti-kickback-statute-higher-education', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-051', itemId: 'byrd-amendment-anti-lobbying-provisions', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-052', itemId: 'clean-air-act', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-053', itemId: 'clean-water-act', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-054', itemId: 'equal-pay-act-of-1963', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-055', itemId: 'family-and-medical-leave-act-fmla', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-056', itemId: 'new-jersey-bullying-prevention', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-057', itemId: 'new-jersey-campus-free-speech', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-058', itemId: 'new-jersey-minors-on-campus', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-059', itemId: 'new-jersey-sara-requirements', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-060', itemId: 'new-jersey-student-records', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-061', itemId: 'pennsylvania-distance-education-authorization', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-062', itemId: 'pennsylvania-sara-participation', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-063', itemId: 'resource-conservation-and-recovery-act-rcra', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-064', itemId: 'uniform-guidance-2-cfr-200', riskScore: 66, riskLevel: 'HIGH' },
  { regKey: 'REG-065', itemId: 'age-discrimination-in-employment-act-adea', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-066', itemId: 'age-discrimination-act-of-1975', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-067', itemId: 'civil-rights-act-of-1866', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-068', itemId: 'comprehensive-environmental-response-compensation-a', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-069', itemId: 'executive-order-11246', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-070', itemId: 'genetic-information-nondiscrimination-act-gina', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-071', itemId: 'new-jersey-environmental-compliance', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-072', itemId: 'new-jersey-genetic-privacy-act', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-073', itemId: 'new-jersey-private-employee-protection', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-074', itemId: 'pennsylvania-breach-notification', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-075', itemId: 'pennsylvania-environmental-regulations', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-076', itemId: 'pennsylvania-whistleblower-protection', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-077', itemId: 'pregnancy-discrimination-act', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-078', itemId: 'sarbanes-oxley-act-whistleblower-protections', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-079', itemId: 'solomon-amendment', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-080', itemId: 'toxic-substances-control-act-tsca', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-081', itemId: 'uniformed-services-employment-reemployment-rights-a', riskScore: 64, riskLevel: 'HIGH' },
  { regKey: 'REG-082', itemId: 'computer-fraud-and-abuse-act', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-083', itemId: 'export-administration-regulations', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-084', itemId: 'higher-education-opportunity-act-heoa', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-085', itemId: 'immigration-and-nationality-act-ina', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-086', itemId: 'international-traffic-in-arms-regulations-itar', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-087', itemId: 'new-jersey-consumer-fraud-act', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-088', itemId: 'new-jersey-cyber-security-requirements', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-089', itemId: 'new-jersey-identity-theft-protection', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-090', itemId: 'pennsylvania-charitable-solicitation', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-091', itemId: 'pennsylvania-data-security', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-092', itemId: 'pennsylvania-unfair-trade-practices', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-093', itemId: 'student-exchange-visitor-information-system-sevis', riskScore: 62, riskLevel: 'HIGH' },
  { regKey: 'REG-094', itemId: 'bayh-dole-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-095', itemId: 'copyright-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-096', itemId: 'davis-bacon-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-097', itemId: 'digital-millennium-copyright-act-dmca', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-098', itemId: 'employee-polygraph-protection-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-099', itemId: 'employee-retirement-income-security-act-erisa', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-100', itemId: 'national-labor-relations-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-101', itemId: 'new-jersey-charitable-registration', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-102', itemId: 'new-jersey-construction-permit-requirements', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-103', itemId: 'new-jersey-fire-safety-code', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-104', itemId: 'new-jersey-research-compliance', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-105', itemId: 'patent-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-106', itemId: 'pennsylvania-construction-permits', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-107', itemId: 'pennsylvania-fire-prevention-code', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-108', itemId: 'pennsylvania-research-compliance', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-109', itemId: 'service-contract-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-110', itemId: 'trademark-act-lanham-act', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-111', itemId: 'worker-adjustment-and-retraining-notification-warn-', riskScore: 60, riskLevel: 'HIGH' },
  { regKey: 'REG-112', itemId: 'animal-welfare-act', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-113', itemId: 'bank-secrecy-act-anti-money-laundering', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-114', itemId: 'common-rule-human-subjects-research', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-115', itemId: 'department-of-defense-research-requirements', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-116', itemId: 'federal-funding-accountability-and-transparency-act', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-117', itemId: 'new-jersey-animal-research', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-118', itemId: 'new-jersey-clinical-trial-requirements', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-119', itemId: 'new-jersey-human-subjects-research', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-120', itemId: 'nih-grants-policy', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-121', itemId: 'nsf-research-requirements', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-122', itemId: 'pennsylvania-animal-research', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-123', itemId: 'pennsylvania-human-subjects-protection', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-124', itemId: 'public-health-service-act-research-integrity', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-125', itemId: 'select-agent-regulations', riskScore: 58, riskLevel: 'HIGH' },
  { regKey: 'REG-126', itemId: 'federal-acquisition-regulation-far', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-127', itemId: 'foreign-corrupt-practices-act', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-128', itemId: 'global-magnitsky-human-rights-accountability-act', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-129', itemId: 'new-jersey-public-contracts-law', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-130', itemId: 'new-jersey-state-contract-requirements', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-131', itemId: 'office-of-foreign-assets-control-regulations', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-132', itemId: 'pennsylvania-contract-compliance', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-133', itemId: 'pennsylvania-procurement-code', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-134', itemId: 'usa-patriot-act', riskScore: 56, riskLevel: 'HIGH' },
  { regKey: 'REG-135', itemId: 'cash-management-improvement-act', riskScore: 54, riskLevel: 'HIGH' },
  { regKey: 'REG-136', itemId: 'federal-credit-reform-act', riskScore: 54, riskLevel: 'HIGH' },
  { regKey: 'REG-137', itemId: 'irs-form-990-reporting', riskScore: 54, riskLevel: 'HIGH' },
  { regKey: 'REG-138', itemId: 'new-jersey-annual-reporting', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-139', itemId: 'new-jersey-nonprofit-tax-requirements', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-140', itemId: 'pennsylvania-annual-report-requirements', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-141', itemId: 'pennsylvania-nonprofit-corporation-law', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-142', itemId: 'single-audit-act', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-143', itemId: 'tax-exempt-organization-requirements-501c3', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-144', itemId: 'unrelated-business-income-tax-ubit', riskScore: 54, riskLevel: 'MODERATE' },
  { regKey: 'REG-145', itemId: 'affirmative-action-equal-employment-opportunity', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-146', itemId: 'conflicts-of-interest-policy-requirements', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-147', itemId: 'institutional-review-board-requirements', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-148', itemId: 'new-jersey-conflict-of-interest-laws', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-149', itemId: 'new-jersey-institutional-governance', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-150', itemId: 'pennsylvania-conflict-of-interest', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-151', itemId: 'pennsylvania-institutional-governance', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-152', itemId: 'responsible-conduct-of-research', riskScore: 52, riskLevel: 'MODERATE' },
  { regKey: 'REG-153', itemId: 'biosafety-in-microbiological-and-biomedical-labora', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-154', itemId: 'federal-information-security-management-act-fisma', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-155', itemId: 'hhs-grants-administration-requirements', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-156', itemId: 'nist-cybersecurity-framework', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-157', itemId: 'new-jersey-biosafety-requirements', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-158', itemId: 'new-jersey-grants-management', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-159', itemId: 'pennsylvania-biosafety-regulations', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-160', itemId: 'pennsylvania-grants-compliance', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-161', itemId: 'recombinant-dna-research-guidelines', riskScore: 50, riskLevel: 'MODERATE' },
  { regKey: 'REG-162', itemId: 'acts-affecting-a-personal-financial-interest', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-163', itemId: 'code-of-federal-regulations-title-34', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-164', itemId: 'federal-advisory-committee-act', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-165', itemId: 'freedom-of-information-act-foia', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-166', itemId: 'hatch-act', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-167', itemId: 'new-jersey-open-public-meetings', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-168', itemId: 'new-jersey-open-public-records', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-169', itemId: 'pennsylvania-open-meetings-law', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-170', itemId: 'pennsylvania-right-to-know-law', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-171', itemId: 'privacy-act-of-1974', riskScore: 48, riskLevel: 'MODERATE' },
  { regKey: 'REG-172', itemId: 'electronic-communications-privacy-act', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-173', itemId: 'higher-education-act-title-ii', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-174', itemId: 'new-jersey-electronic-surveillance', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-175', itemId: 'new-jersey-professional-licensing', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-176', itemId: 'new-jersey-teacher-certification', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-177', itemId: 'pennsylvania-electronic-surveillance', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-178', itemId: 'pennsylvania-professional-licensure', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-179', itemId: 'pennsylvania-teacher-certification', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-180', itemId: 'teacher-preparation-program-requirements', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-181', itemId: 'telephone-consumer-protection-act-tcpa', riskScore: 46, riskLevel: 'MODERATE' },
  { regKey: 'REG-182', itemId: 'can-spam-act', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-183', itemId: 'childrens-online-privacy-protection-act-coppa', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-184', itemId: 'new-jersey-consumer-privacy', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-185', itemId: 'new-jersey-marketing-communications', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-186', itemId: 'new-jersey-student-privacy', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-187', itemId: 'pennsylvania-consumer-protection', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-188', itemId: 'pennsylvania-marketing-regulations', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-189', itemId: 'pennsylvania-student-data-privacy', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-190', itemId: 'student-data-privacy-state-requirements', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-191', itemId: 'video-privacy-protection-act', riskScore: 44, riskLevel: 'MODERATE' },
  { regKey: 'REG-192', itemId: 'athletic-conference-requirements', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-193', itemId: 'gainful-employment-regulations', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-194', itemId: 'ncaa-division-requirements', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-195', itemId: 'new-jersey-athletic-training', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-196', itemId: 'new-jersey-ncaa-compliance', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-197', itemId: 'new-jersey-transfer-policies', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-198', itemId: 'pennsylvania-athletic-regulations', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-199', itemId: 'pennsylvania-ncaa-compliance', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-200', itemId: 'pennsylvania-transfer-credit', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-201', itemId: 'transfer-of-credit-policies', riskScore: 42, riskLevel: 'MODERATE' },
  { regKey: 'REG-202', itemId: 'accreditation-disclosure-requirements', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-203', itemId: 'college-cost-reduction-and-access-act', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-204', itemId: 'college-navigator-reporting', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-205', itemId: 'integrated-postsecondary-education-data-system-ipe', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-206', itemId: 'net-price-calculator-requirements', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-207', itemId: 'new-jersey-consumer-disclosure', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-208', itemId: 'new-jersey-cost-transparency', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-209', itemId: 'new-jersey-ipeds-reporting', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-210', itemId: 'pennsylvania-consumer-information', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-211', itemId: 'pennsylvania-cost-disclosure', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-212', itemId: 'pennsylvania-ipeds-requirements', riskScore: 40, riskLevel: 'MODERATE' },
  { regKey: 'REG-213', itemId: 'default-prevention-and-management', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-214', itemId: 'direct-loan-program-requirements', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-215', itemId: 'federal-pell-grant-program', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-216', itemId: 'federal-work-study-program', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-217', itemId: 'new-jersey-financial-aid-administration', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-218', itemId: 'new-jersey-state-grants', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-219', itemId: 'new-jersey-student-loan-programs', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-220', itemId: 'pennsylvania-financial-aid-requirements', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-221', itemId: 'pennsylvania-state-grant-program', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-222', itemId: 'pennsylvania-student-loans', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-223', itemId: 'return-of-title-iv-funds-r2t4', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-224', itemId: 'satisfactory-academic-progress-requirements', riskScore: 38, riskLevel: 'MODERATE' },
  { regKey: 'REG-225', itemId: 'federal-supplemental-educational-opportunity-grant', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-226', itemId: 'graduate-and-professional-student-financial-aid', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-227', itemId: 'new-jersey-graduate-aid', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-228', itemId: 'new-jersey-veterans-education', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-229', itemId: 'pennsylvania-graduate-assistance', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-230', itemId: 'pennsylvania-veterans-education', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-231', itemId: 'veterans-education-benefits', riskScore: 36, riskLevel: 'LOW' },
  { regKey: 'REG-232', itemId: 'academic-catalog-requirements', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-233', itemId: 'credit-hour-definition', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-234', itemId: 'new-jersey-academic-policies', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-235', itemId: 'new-jersey-catalog-requirements', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-236', itemId: 'new-jersey-credit-hour-policy', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-237', itemId: 'pennsylvania-academic-standards', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-238', itemId: 'pennsylvania-catalog-disclosure', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-239', itemId: 'pennsylvania-credit-hour-definition', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-240', itemId: 'program-integrity-regulations', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-241', itemId: 'substantive-change-requirements', riskScore: 34, riskLevel: 'LOW' },
  { regKey: 'REG-242', itemId: 'new-jersey-academic-program-approval', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-243', itemId: 'new-jersey-program-review', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-244', itemId: 'new-jersey-substantive-change', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-245', itemId: 'pennsylvania-program-approval', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-246', itemId: 'pennsylvania-program-review', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-247', itemId: 'pennsylvania-substantive-change', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-248', itemId: 'state-program-approval-requirements', riskScore: 32, riskLevel: 'LOW' },
  { regKey: 'REG-249', itemId: 'new-jersey-textbook-information', riskScore: 30, riskLevel: 'LOW' },
  { regKey: 'REG-250', itemId: 'pennsylvania-textbook-requirements', riskScore: 30, riskLevel: 'LOW' },
  { regKey: 'REG-251', itemId: 'textbook-information-requirements', riskScore: 29, riskLevel: 'LOW' },
];

async function addRegKeyColumn() {
  console.log('========================================');
  console.log('EdSteward: Adding Universal REG-KEY Column');
  console.log('========================================\n');

  const client = await pool.connect();
  
  try {
    // Step 1: Add the columns if they don't exist
    console.log('Step 1: Adding reg_key, risk_score, risk_level columns...');
    
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS reg_key VARCHAR(10) UNIQUE;
    `);
    
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS risk_score INTEGER;
    `);
    
    await client.query(`
      ALTER TABLE regulations 
      ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20);
    `);
    
    console.log('✅ Columns added successfully\n');

    // Step 2: Create index for fast lookups
    console.log('Step 2: Creating index on reg_key...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_regulations_reg_key ON regulations(reg_key);
    `);
    console.log('✅ Index created\n');

    // Step 3: Update all regulations with their REG-XXX keys
    console.log('Step 3: Updating regulations with REG-XXX keys...');
    console.log(`   Processing ${REG_KEY_MAPPING.length} regulations...\n`);

    let updated = 0;
    let notFound = 0;
    const notFoundList = [];

    for (const mapping of REG_KEY_MAPPING) {
      const result = await client.query(`
        UPDATE regulations 
        SET reg_key = $1, risk_score = $2, risk_level = $3
        WHERE item_id = $4
        RETURNING id, name
      `, [mapping.regKey, mapping.riskScore, mapping.riskLevel, mapping.itemId]);

      if (result.rowCount > 0) {
        updated++;
        if (updated <= 10 || updated % 50 === 0) {
          console.log(`   ✅ ${mapping.regKey}: ${result.rows[0].name.substring(0, 50)}...`);
        }
      } else {
        notFound++;
        notFoundList.push(mapping.itemId);
      }
    }

    console.log(`\n========================================`);
    console.log('Summary:');
    console.log(`========================================`);
    console.log(`✅ Updated: ${updated} regulations`);
    if (notFound > 0) {
      console.log(`⚠️ Not found: ${notFound} regulations`);
      console.log('   Missing item_ids:');
      notFoundList.forEach(id => console.log(`   - ${id}`));
    }

    // Step 4: Verification
    console.log('\n========================================');
    console.log('Verification:');
    console.log('========================================');

    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(reg_key) as with_reg_key,
        COUNT(*) - COUNT(reg_key) as missing_reg_key
      FROM regulations
    `);
    console.log(`Total regulations: ${verifyResult.rows[0].total}`);
    console.log(`With reg_key: ${verifyResult.rows[0].with_reg_key}`);
    console.log(`Missing reg_key: ${verifyResult.rows[0].missing_reg_key}`);

    // Risk level distribution
    const riskDistribution = await client.query(`
      SELECT 
        risk_level,
        COUNT(*) as count,
        MIN(reg_key) as first_key,
        MAX(reg_key) as last_key
      FROM regulations
      WHERE reg_key IS NOT NULL
      GROUP BY risk_level
      ORDER BY 
        CASE risk_level 
          WHEN 'CRITICAL' THEN 1 
          WHEN 'SEVERE' THEN 2 
          WHEN 'HIGH' THEN 3 
          WHEN 'MODERATE' THEN 4 
          WHEN 'LOW' THEN 5 
        END
    `);
    
    console.log('\nRisk Level Distribution:');
    riskDistribution.rows.forEach(row => {
      console.log(`   ${row.risk_level}: ${row.count} (${row.first_key} - ${row.last_key})`);
    });

    // Show top 5 highest risk
    const topRisk = await client.query(`
      SELECT reg_key, risk_score, risk_level, name
      FROM regulations
      WHERE reg_key IS NOT NULL
      ORDER BY reg_key
      LIMIT 5
    `);
    
    console.log('\nTop 5 Highest Risk Regulations:');
    topRisk.rows.forEach(row => {
      console.log(`   ${row.reg_key} (${row.risk_score}): ${row.name.substring(0, 50)}...`);
    });

    console.log('\n✅ REG-KEY migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
addRegKeyColumn().catch(console.error);
