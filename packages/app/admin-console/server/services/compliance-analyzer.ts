/**
 * LLM-powered compliance analyzer.
 * Takes crawled website pages and regulation check definitions,
 * sends targeted prompts to Claude, and parses structured verdicts.
 */

import { RegulationCheck, getChecksForInstitutionTypes } from './compliance-checks.js';
import { CrawledPage } from './website-scanner.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RequirementStatus = 'found' | 'partial' | 'not_found';
export type RegulationGrade = 'A' | 'B' | 'C' | 'F';

export interface RequirementFinding {
  requirementId: string;
  description: string;
  critical: boolean;
  status: RequirementStatus;
  evidence: string;
  sourceUrl: string;
  notes: string;
}

export interface RegulationVerdict {
  regulationId: string;
  name: string;
  shortName: string;
  grade: RegulationGrade;
  score: number;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_checked';
  findings: RequirementFinding[];
  relevantPages: string[];
  weight: number;
}

export interface ExternalIndicator {
  id: string;
  regulationId: string;
  category: 'financial' | 'accreditation' | 'accessibility' | 'federal-oversight' | 'institutional';
  name: string;
  value: string;
  numericValue?: number;
  status: 'pass' | 'warning' | 'fail' | 'info' | 'unknown';
  threshold?: string;
  source: string;
  sourceUrl: string;
  notes: string;
}

export interface ComplianceReport {
  institutionName: string;
  websiteUrl: string;
  scanDate: string;
  overallGrade: RegulationGrade;
  overallScore: number;
  regulationsChecked: number;
  compliantCount: number;
  partialCount: number;
  nonCompliantCount: number;
  verdicts: RegulationVerdict[];
  externalIndicators?: ExternalIndicator[];
  accessibilityScore?: number;
  financialHealthScore?: number;
  externalSummary?: {
    totalChecks: number;
    passing: number;
    warnings: number;
    failing: number;
  };
  crawlStats: { pagesScanned: number; durationMs: number };
  analysisDurationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  return key;
}

function selectRelevantPages(pages: CrawledPage[], check: RegulationCheck): CrawledPage[] {
  const scored = pages.map(page => {
    let score = 0;
    const lower = (page.url + ' ' + page.title + ' ' + page.textContent).toLowerCase();
    for (const kw of check.searchKeywords) {
      const count = lower.split(kw).length - 1;
      score += count > 0 ? 3 + Math.min(count - 1, 2) : 0;
    }
    for (const sp of check.searchPaths) {
      if (page.url.toLowerCase().includes(sp)) score += 5;
    }
    return { page, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.page);
}

function truncateContent(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '... [truncated]';
}

/**
 * For long pages, extract the most relevant windows of text around keyword
 * matches instead of blindly taking the first N characters. This ensures
 * that VAWA definitions buried 100KB into a policy doc still get seen.
 */
function extractRelevantSections(
  textContent: string,
  keywords: string[],
  maxTotalLen: number,
): string {
  if (textContent.length <= maxTotalLen) return textContent;

  const lower = textContent.toLowerCase();
  const WINDOW = 1500;
  const positions: number[] = [];

  for (const kw of keywords) {
    let idx = lower.indexOf(kw);
    while (idx !== -1 && positions.length < 20) {
      positions.push(idx);
      idx = lower.indexOf(kw, idx + kw.length);
    }
  }

  if (positions.length === 0) {
    return textContent.slice(0, maxTotalLen) + '... [truncated]';
  }

  positions.sort((a, b) => a - b);

  // Merge overlapping windows
  const windows: Array<{ start: number; end: number }> = [];
  for (const pos of positions) {
    const start = Math.max(0, pos - WINDOW);
    const end = Math.min(textContent.length, pos + WINDOW);
    if (windows.length > 0 && start <= windows[windows.length - 1].end) {
      windows[windows.length - 1].end = Math.max(windows[windows.length - 1].end, end);
    } else {
      windows.push({ start, end });
    }
  }

  // Always include the start of the page for title/context
  const headerLen = Math.min(2000, maxTotalLen / 4);
  let result = textContent.slice(0, headerLen);
  let remaining = maxTotalLen - result.length;

  for (const w of windows) {
    if (remaining <= 0) break;
    if (w.start < headerLen && w.end <= headerLen) continue;
    const effectiveStart = Math.max(w.start, headerLen);
    const chunk = textContent.slice(effectiveStart, Math.min(w.end, effectiveStart + remaining));
    if (chunk.length > 50) {
      result += '\n\n[...section relevant to search...]\n' + chunk;
      remaining -= chunk.length + 40;
    }
  }

  // Append LINKS section if present
  const linksIdx = textContent.indexOf('\nLINKS ON THIS PAGE:');
  if (linksIdx !== -1 && remaining > 200) {
    const linksSection = textContent.slice(linksIdx, linksIdx + Math.min(remaining, 3000));
    result += '\n' + linksSection;
  }

  return result;
}

function gradeFromScore(score: number): RegulationGrade {
  if (score >= 85) return 'A';
  if (score >= 65) return 'B';
  if (score >= 40) return 'C';
  return 'F';
}

function statusFromGrade(grade: RegulationGrade): 'compliant' | 'partial' | 'non_compliant' {
  if (grade === 'A') return 'compliant';
  if (grade === 'B' || grade === 'C') return 'partial';
  return 'non_compliant';
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errBody}`);
  }

  const data = await response.json() as any;
  return data.content?.[0]?.text || '';
}

// ---------------------------------------------------------------------------
// Per-regulation analysis
// ---------------------------------------------------------------------------

async function analyzeRegulation(
  check: RegulationCheck,
  relevantPages: CrawledPage[],
  institutionName: string,
): Promise<RegulationVerdict> {
  if (relevantPages.length === 0) {
    return {
      regulationId: check.regulationId,
      name: check.name,
      shortName: check.shortName,
      grade: 'F',
      score: 0,
      status: 'non_compliant',
      findings: check.requirements.map(r => ({
        requirementId: r.id,
        description: r.description,
        critical: r.critical,
        status: 'not_found' as RequirementStatus,
        evidence: '',
        sourceUrl: '',
        notes: 'No relevant pages were found on the institution website for this regulation.',
      })),
      relevantPages: [],
      weight: check.weight,
    };
  }

  const requirementsList = check.requirements
    .map((r, i) => `${i + 1}. [${r.id}] (${r.critical ? 'CRITICAL' : 'recommended'}) ${r.description}`)
    .join('\n');

  const pagesContent = relevantPages
    .map(p => {
      const content = p.textContent.length > 12000
        ? extractRelevantSections(p.textContent, check.searchKeywords, 12000)
        : truncateContent(p.textContent, 12000);
      return `--- PAGE: ${p.url} ---\nTitle: ${p.title}\n${content}`;
    })
    .join('\n\n');

  const systemPrompt = `You are an expert higher education compliance auditor examining university websites for regulatory compliance.

SCORING GUIDELINES — be thorough but fair:
- Mark "found" if the requirement is satisfied, even in a different format or location than expected.
- A link to a PDF report (e.g., "Annual Security Report" linking to a .pdf URL) counts as the report being "published" and "accessible".
- A phone number, email, or named contact counts as contact information being "provided", even if the exact title differs (e.g., "Campus Police Chief" satisfies "emergency contact").
- Content on a sub-page linked from the analyzed page counts — look at the LINKS ON THIS PAGE section.
- Mark "partial" if evidence exists but is incomplete (e.g., a report is mentioned but the link is broken or the info is vague).
- Only mark "not_found" if there is genuinely NO evidence whatsoever.
- Universities use varied terminology: "Campus Police" = "Public Safety" = "University Police" = "Security". Treat them as equivalent.`;

  const userPrompt = `Analyze the following web pages from "${institutionName}" to verify compliance with the **${check.name}** (${check.shortName}).

REQUIREMENTS TO VERIFY:
${requirementsList}

WEB PAGES FOUND:
${pagesContent}

IMPORTANT:
- Each page may include a "LINKS ON THIS PAGE" section showing hyperlinks with their destination URLs.
- A link to a report PDF (e.g., [Annual Security Report](https://example.edu/report.pdf)) counts as that report being "published" and "accessible".
- Contact info (phone, email, name) counts as information being "provided" even if the exact role title differs.
- Different schools use different terminology — treat "Campus Police", "Public Safety", "University Police", "Security" as equivalent.

Respond with ONLY a JSON array (no markdown fences, no explanation). Each element must have:
- "requirementId": string (from the IDs above)
- "status": "found" | "partial" | "not_found"
- "evidence": string (brief quote or description of what was found, empty string if not_found)
- "sourceUrl": string (which page URL, empty if not_found)
- "notes": string (any concerns about completeness or quality)

Example response format:
[{"requirementId":"asr-published","status":"found","evidence":"Link to 2024 ASR PDF found on campus safety page","sourceUrl":"https://example.edu/campus-safety","notes":""}]`;

  try {
    const raw = await callClaude(systemPrompt, userPrompt);

    // Extract JSON from response (handle markdown fences if present)
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const parsed: Array<{
      requirementId: string;
      status: string;
      evidence: string;
      sourceUrl: string;
      notes: string;
    }> = JSON.parse(jsonStr);

    const findings: RequirementFinding[] = check.requirements.map(req => {
      const llmResult = parsed.find(p => p.requirementId === req.id);
      if (!llmResult) {
        return {
          requirementId: req.id,
          description: req.description,
          critical: req.critical,
          status: 'not_found' as RequirementStatus,
          evidence: '',
          sourceUrl: '',
          notes: 'LLM did not return a result for this requirement',
        };
      }
      return {
        requirementId: req.id,
        description: req.description,
        critical: req.critical,
        status: (['found', 'partial', 'not_found'].includes(llmResult.status) ? llmResult.status : 'not_found') as RequirementStatus,
        evidence: llmResult.evidence || '',
        sourceUrl: llmResult.sourceUrl || '',
        notes: llmResult.notes || '',
      };
    });

    // Score: critical requirements worth 2x, others 1x
    let totalWeight = 0;
    let earnedWeight = 0;
    for (const f of findings) {
      const w = f.critical ? 2 : 1;
      totalWeight += w;
      if (f.status === 'found') earnedWeight += w;
      else if (f.status === 'partial') earnedWeight += w * 0.5;
    }
    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
    const grade = gradeFromScore(score);

    return {
      regulationId: check.regulationId,
      name: check.name,
      shortName: check.shortName,
      grade,
      score,
      status: statusFromGrade(grade),
      findings,
      relevantPages: relevantPages.map(p => p.url),
      weight: check.weight,
    };
  } catch (error: any) {
    console.error(`LLM analysis failed for ${check.shortName}:`, error.message);
    return {
      regulationId: check.regulationId,
      name: check.name,
      shortName: check.shortName,
      grade: 'F',
      score: 0,
      status: 'not_checked',
      findings: check.requirements.map(r => ({
        requirementId: r.id,
        description: r.description,
        critical: r.critical,
        status: 'not_found' as RequirementStatus,
        evidence: '',
        sourceUrl: '',
        notes: `Analysis error: ${error.message}`,
      })),
      relevantPages: relevantPages.map(p => p.url),
      weight: check.weight,
    };
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function analyzeCompliance(
  pages: CrawledPage[],
  institutionName: string,
  institutionTypes: string[],
  websiteUrl: string,
  crawlStats: { pagesScanned: number; durationMs: number },
): Promise<ComplianceReport> {
  const startTime = Date.now();
  const checks = getChecksForInstitutionTypes(institutionTypes);

  // Run analyses in batches of 4 to manage concurrency
  const BATCH_SIZE = 4;
  const verdicts: RegulationVerdict[] = [];

  for (let i = 0; i < checks.length; i += BATCH_SIZE) {
    const batch = checks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(check => {
        const relevant = selectRelevantPages(pages, check);
        return analyzeRegulation(check, relevant, institutionName);
      })
    );
    verdicts.push(...batchResults);
  }

  // Weighted overall score
  let totalWeight = 0;
  let weightedScore = 0;
  for (const v of verdicts) {
    totalWeight += v.weight;
    weightedScore += v.score * v.weight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  const compliantCount = verdicts.filter(v => v.status === 'compliant').length;
  const partialCount = verdicts.filter(v => v.status === 'partial').length;
  const nonCompliantCount = verdicts.filter(v => v.status === 'non_compliant' || v.status === 'not_checked').length;

  return {
    institutionName,
    websiteUrl,
    scanDate: new Date().toISOString(),
    overallGrade: gradeFromScore(overallScore),
    overallScore,
    regulationsChecked: verdicts.length,
    compliantCount,
    partialCount,
    nonCompliantCount,
    verdicts: verdicts.sort((a, b) => a.score - b.score),
    crawlStats,
    analysisDurationMs: Date.now() - startTime,
  };
}
