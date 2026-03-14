/**
 * External compliance indicators derived from government data and
 * programmatic analysis — not website content.
 *
 * Sources:
 *  - College Scorecard API (financial health, accreditation, Title IV)
 *  - HTML accessibility analysis (ADA / Section 504 / WCAG)
 *  - School metadata (state, religious affiliation, programs)
 */

import * as cheerio from 'cheerio';
import { CrawledPage } from './website-scanner.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IndicatorStatus = 'pass' | 'warning' | 'fail' | 'info' | 'unknown';

export interface ExternalIndicator {
  id: string;
  regulationId: string;
  category: 'financial' | 'accreditation' | 'accessibility' | 'federal-oversight' | 'institutional';
  name: string;
  value: string;
  numericValue?: number;
  status: IndicatorStatus;
  threshold?: string;
  source: string;
  sourceUrl: string;
  notes: string;
}

export interface ExternalCheckResult {
  indicators: ExternalIndicator[];
  accessibilityScore: number;
  financialHealthScore: number;
  summary: {
    totalChecks: number;
    passing: number;
    warnings: number;
    failing: number;
    unknown: number;
  };
}

// ─── Scorecard-based financial indicators ────────────────────────────────────

function buildFinancialIndicators(institution: any): ExternalIndicator[] {
  const indicators: ExternalIndicator[] = [];
  const scorecardUrl = 'https://collegescorecard.ed.gov';

  // Completion/graduation rate
  if (institution.completionRate != null) {
    const pct = Math.round(institution.completionRate * 100);
    let status: IndicatorStatus = 'pass';
    if (pct < 25) status = 'fail';
    else if (pct < 50) status = 'warning';
    indicators.push({
      id: 'graduation-rate',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'financial',
      name: 'Graduation Rate',
      value: `${pct}%`,
      numericValue: pct,
      status,
      threshold: '≥ 50% is strong; < 25% may trigger HEA scrutiny',
      source: 'College Scorecard (IPEDS)',
      sourceUrl: scorecardUrl,
      notes: status === 'fail' ? 'Low graduation rate may indicate Title IV compliance risk' : '',
    });
  }

  // Retention rate
  if (institution.retentionRate != null) {
    const pct = Math.round(institution.retentionRate * 100);
    let status: IndicatorStatus = 'pass';
    if (pct < 50) status = 'fail';
    else if (pct < 67) status = 'warning';
    indicators.push({
      id: 'retention-rate',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'financial',
      name: 'Retention Rate (Full-Time)',
      value: `${pct}%`,
      numericValue: pct,
      status,
      threshold: '≥ 67% is typical; < 50% may trigger concern',
      source: 'College Scorecard (IPEDS)',
      sourceUrl: scorecardUrl,
      notes: '',
    });
  }

  // Pell Grant rate (indicates low-income student population)
  if (institution.pellGrantRate != null) {
    const pct = Math.round(institution.pellGrantRate * 100);
    indicators.push({
      id: 'pell-grant-rate',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'financial',
      name: 'Pell Grant Recipients',
      value: `${pct}%`,
      numericValue: pct,
      status: 'info',
      source: 'College Scorecard',
      sourceUrl: scorecardUrl,
      notes: `${pct}% of students receive Pell Grants — higher rates indicate greater Title IV reliance`,
    });
  }

  // Federal loan rate
  if (institution.federalLoanRate != null) {
    const pct = Math.round(institution.federalLoanRate * 100);
    let status: IndicatorStatus = 'info';
    if (pct > 80) status = 'warning';
    indicators.push({
      id: 'federal-loan-rate',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'financial',
      name: 'Federal Loan Participation Rate',
      value: `${pct}%`,
      numericValue: pct,
      status,
      source: 'College Scorecard',
      sourceUrl: scorecardUrl,
      notes: pct > 80 ? 'High federal loan dependency may trigger 90/10 or financial responsibility review' : '',
    });
  }

  // Repayment rate (3-year)
  if (institution.repaymentRate != null) {
    const pct = Math.round(institution.repaymentRate * 100);
    let status: IndicatorStatus = 'pass';
    if (pct < 30) status = 'fail';
    else if (pct < 50) status = 'warning';
    indicators.push({
      id: 'repayment-rate',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'financial',
      name: '3-Year Loan Repayment Rate',
      value: `${pct}%`,
      numericValue: pct,
      status,
      threshold: '≥ 50% is healthy; < 30% is a red flag',
      source: 'College Scorecard',
      sourceUrl: scorecardUrl,
      notes: status === 'fail' ? 'Low repayment rate may trigger gainful employment or financial responsibility review' : '',
    });
  }

  // Median debt
  if (institution.medianDebt != null) {
    const debt = institution.medianDebt;
    indicators.push({
      id: 'median-debt',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'financial',
      name: 'Median Student Debt at Completion',
      value: `$${debt.toLocaleString()}`,
      numericValue: debt,
      status: 'info',
      source: 'College Scorecard',
      sourceUrl: scorecardUrl,
      notes: '',
    });
  }

  return indicators;
}

// ─── Accreditation & oversight indicators ────────────────────────────────────

function buildAccreditationIndicators(institution: any): ExternalIndicator[] {
  const indicators: ExternalIndicator[] = [];

  // Accreditation status
  if (institution.accreditor) {
    indicators.push({
      id: 'accreditation-status',
      regulationId: 'higher-education-opportunity-act',
      category: 'accreditation',
      name: 'Institutional Accreditation',
      value: institution.accreditor,
      status: 'pass',
      source: 'College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov',
      notes: 'Recognized by U.S. Department of Education',
    });
  } else {
    indicators.push({
      id: 'accreditation-status',
      regulationId: 'higher-education-opportunity-act',
      category: 'accreditation',
      name: 'Institutional Accreditation',
      value: 'Not found',
      status: 'fail',
      source: 'College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov',
      notes: 'No recognized accreditor listed — significant compliance concern',
    });
  }

  // Title IV participation
  if (institution.titleIvApprovalDate) {
    indicators.push({
      id: 'title-iv-participation',
      regulationId: 'higher-education-act-title-iv-student-financial-a',
      category: 'accreditation',
      name: 'Title IV Program Participation',
      value: `Active since ${institution.titleIvApprovalDate}`,
      status: 'pass',
      source: 'College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov',
      notes: '',
    });
  }

  // Heightened Cash Monitoring / under investigation
  if (institution.underInvestigation != null) {
    const under = institution.underInvestigation === 1 || institution.underInvestigation === true;
    indicators.push({
      id: 'under-investigation',
      regulationId: 'title-ix',
      category: 'federal-oversight',
      name: 'Under Federal Investigation',
      value: under ? 'Yes' : 'No',
      status: under ? 'fail' : 'pass',
      source: 'College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov',
      notes: under ? 'Institution is listed as under investigation by the U.S. Department of Education' : '',
    });
  }

  return indicators;
}

// ─── HTML accessibility analysis (WCAG-lite) ────────────────────────────────

interface AccessibilityIssue {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  count: number;
  description: string;
}

function analyzePageAccessibility(html: string, url: string): AccessibilityIssue[] {
  const $ = cheerio.load(html);
  const issues: AccessibilityIssue[] = [];

  // 1. Images without alt text (WCAG 1.1.1)
  const imgsWithoutAlt = $('img').filter((_, el) => {
    const alt = $(el).attr('alt');
    return alt === undefined;
  }).length;
  if (imgsWithoutAlt > 0) {
    issues.push({
      rule: 'img-alt',
      severity: 'critical',
      count: imgsWithoutAlt,
      description: `${imgsWithoutAlt} image(s) missing alt attribute`,
    });
  }

  // 2. Empty alt on non-decorative images (WCAG 1.1.1)
  const imgsEmptyAlt = $('img[alt=""]').filter((_, el) => {
    const role = $(el).attr('role');
    return role !== 'presentation' && role !== 'none';
  }).length;
  if (imgsEmptyAlt > 3) {
    issues.push({
      rule: 'img-alt-empty',
      severity: 'moderate',
      count: imgsEmptyAlt,
      description: `${imgsEmptyAlt} images with empty alt text (may be decorative, or may need descriptions)`,
    });
  }

  // 3. Missing document language (WCAG 3.1.1)
  const htmlLang = $('html').attr('lang');
  if (!htmlLang) {
    issues.push({
      rule: 'html-has-lang',
      severity: 'serious',
      count: 1,
      description: 'Page missing lang attribute on <html> element',
    });
  }

  // 4. Missing page title (WCAG 2.4.2)
  const title = $('title').text().trim();
  if (!title) {
    issues.push({
      rule: 'document-title',
      severity: 'serious',
      count: 1,
      description: 'Page missing <title> element',
    });
  }

  // 5. Heading hierarchy issues (WCAG 1.3.1, 2.4.6)
  const headings = $('h1, h2, h3, h4, h5, h6').toArray();
  let prevLevel = 0;
  let skipCount = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName.replace('h', ''));
    if (prevLevel > 0 && level > prevLevel + 1) skipCount++;
    prevLevel = level;
  }
  if (skipCount > 0) {
    issues.push({
      rule: 'heading-order',
      severity: 'moderate',
      count: skipCount,
      description: `${skipCount} heading level skip(s) (e.g., h2 → h4)`,
    });
  }

  // 6. Form inputs without labels (WCAG 1.3.1, 4.1.2)
  const inputsWithoutLabel = $('input, select, textarea').filter((_, el) => {
    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const type = $(el).attr('type');
    if (type === 'hidden' || type === 'submit' || type === 'button') return false;
    if (ariaLabel || ariaLabelledBy) return false;
    if (id && $(`label[for="${id}"]`).length > 0) return false;
    return true;
  }).length;
  if (inputsWithoutLabel > 0) {
    issues.push({
      rule: 'label',
      severity: 'critical',
      count: inputsWithoutLabel,
      description: `${inputsWithoutLabel} form input(s) without associated labels`,
    });
  }

  // 7. Empty links (WCAG 2.4.4)
  const emptyLinks = $('a[href]').filter((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label');
    const img = $(el).find('img[alt]');
    return !text && !ariaLabel && img.length === 0;
  }).length;
  if (emptyLinks > 0) {
    issues.push({
      rule: 'link-name',
      severity: 'serious',
      count: emptyLinks,
      description: `${emptyLinks} link(s) with no discernible text`,
    });
  }

  // 8. Missing ARIA roles on interactive elements
  const buttonsWithoutType = $('button').filter((_, el) => !$(el).attr('type')).length;
  if (buttonsWithoutType > 0) {
    issues.push({
      rule: 'button-name',
      severity: 'minor',
      count: buttonsWithoutType,
      description: `${buttonsWithoutType} button(s) without explicit type attribute`,
    });
  }

  return issues;
}

function buildAccessibilityIndicators(pages: CrawledPage[]): { indicators: ExternalIndicator[]; score: number } {
  let totalIssues = 0;
  let criticalCount = 0;
  let seriousCount = 0;
  let pagesAnalyzed = 0;

  for (const page of pages.slice(0, 10)) {
    if (!page.textContent) continue;
    pagesAnalyzed++;
    // Re-fetch won't work here, but we can reconstruct basic analysis from textContent
    // For a production version, we'd store raw HTML. For now, count what we can from the page metadata.
  }

  // Since we don't have raw HTML in CrawledPage, we'll analyze based on the homepage
  // and any pages we can re-fetch. For now, create summary indicators.
  // The real analysis happens during the crawl phase (see below).

  const indicators: ExternalIndicator[] = [];
  const adaUrl = 'https://www.w3.org/WAI/standards-guidelines/wcag/';

  // These get populated by analyzeAccessibilityFromCrawl()
  return { indicators, score: 0 };
}

// ─── Accessibility analysis during crawl (operates on raw HTML) ──────────────

export function analyzeAccessibilityFromHtml(
  htmlPages: Array<{ url: string; html: string }>,
): { indicators: ExternalIndicator[]; score: number; issuesByPage: Map<string, AccessibilityIssue[]> } {
  const allIssues: AccessibilityIssue[] = [];
  const issuesByPage = new Map<string, AccessibilityIssue[]>();
  let totalCritical = 0;
  let totalSerious = 0;
  let totalModerate = 0;

  for (const { url, html } of htmlPages) {
    const pageIssues = analyzePageAccessibility(html, url);
    issuesByPage.set(url, pageIssues);
    allIssues.push(...pageIssues);
    for (const issue of pageIssues) {
      if (issue.severity === 'critical') totalCritical += issue.count;
      else if (issue.severity === 'serious') totalSerious += issue.count;
      else if (issue.severity === 'moderate') totalModerate += issue.count;
    }
  }

  // Deduplicate by rule and sum counts
  const ruleMap = new Map<string, { count: number; severity: string; description: string }>();
  for (const issue of allIssues) {
    const existing = ruleMap.get(issue.rule);
    if (existing) {
      existing.count += issue.count;
    } else {
      ruleMap.set(issue.rule, { count: issue.count, severity: issue.severity, description: issue.description });
    }
  }

  const wcagUrl = 'https://www.w3.org/WAI/standards-guidelines/wcag/';
  const indicators: ExternalIndicator[] = [];

  // Overall accessibility score (100 - weighted deductions)
  const deductions = totalCritical * 10 + totalSerious * 5 + totalModerate * 2;
  const score = Math.max(0, Math.min(100, 100 - deductions));
  const status: IndicatorStatus = score >= 85 ? 'pass' : score >= 50 ? 'warning' : 'fail';

  indicators.push({
    id: 'wcag-overall',
    regulationId: 'americans-with-disabilities-act-of-1990',
    category: 'accessibility',
    name: 'Website Accessibility (WCAG 2.1 Automated Checks)',
    value: `${score}/100`,
    numericValue: score,
    status,
    threshold: '≥ 85 = good; < 50 = significant issues',
    source: `Automated WCAG analysis of ${htmlPages.length} pages`,
    sourceUrl: wcagUrl,
    notes: `${totalCritical} critical, ${totalSerious} serious, ${totalModerate} moderate issues found`,
  });

  // Individual rule indicators (top issues)
  const sortedRules = Array.from(ruleMap.entries())
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      const aOrd = sevOrder[a[1].severity] ?? 4;
      const bOrd = sevOrder[b[1].severity] ?? 4;
      return aOrd - bOrd || b[1].count - a[1].count;
    })
    .slice(0, 6);

  for (const [rule, data] of sortedRules) {
    const sevStatus: IndicatorStatus = data.severity === 'critical' ? 'fail'
      : data.severity === 'serious' ? 'warning' : 'info';
    indicators.push({
      id: `wcag-${rule}`,
      regulationId: 'americans-with-disabilities-act-of-1990',
      category: 'accessibility',
      name: data.description,
      value: `${data.count} instance(s)`,
      numericValue: data.count,
      status: sevStatus,
      source: `WCAG 2.1 Rule: ${rule}`,
      sourceUrl: wcagUrl,
      notes: `Severity: ${data.severity}`,
    });
  }

  return { indicators, score, issuesByPage };
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function generateExternalIndicators(
  institution: any,
  accessibilityResult?: { indicators: ExternalIndicator[]; score: number },
): ExternalCheckResult {
  const financial = buildFinancialIndicators(institution);
  const accreditation = buildAccreditationIndicators(institution);
  const accessibility = accessibilityResult?.indicators ?? [];

  const allIndicators = [...financial, ...accreditation, ...accessibility];

  let passing = 0, warnings = 0, failing = 0, unknown = 0;
  for (const ind of allIndicators) {
    if (ind.status === 'pass') passing++;
    else if (ind.status === 'warning') warnings++;
    else if (ind.status === 'fail') failing++;
    else if (ind.status === 'unknown') unknown++;
  }

  // Financial health composite
  const financialScores: number[] = financial
    .filter(i => i.numericValue != null && i.status !== 'info')
    .map(i => i.status === 'pass' ? 100 : i.status === 'warning' ? 50 : 0);
  const financialHealthScore = financialScores.length > 0
    ? Math.round(financialScores.reduce((a, b) => a + b, 0) / financialScores.length)
    : -1;

  return {
    indicators: allIndicators,
    accessibilityScore: accessibilityResult?.score ?? -1,
    financialHealthScore,
    summary: {
      totalChecks: allIndicators.filter(i => i.status !== 'info').length,
      passing,
      warnings,
      failing,
      unknown,
    },
  };
}
