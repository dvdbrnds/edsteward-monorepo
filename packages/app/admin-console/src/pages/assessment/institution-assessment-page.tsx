import React, { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstitutionResult {
  id: number;
  name: string;
  city: string;
  state: string;
  website: string;
  ownership: string;
  carnegieClassification: string;
  religiousAffiliation: string | null;
  accreditor: string;
  studentSize: number;
  admissionRate: number | null;
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  pellGrantRate: number | null;
  onlineOnly: boolean;
  classification: { primaryType: string; characteristics: string[] };
  allTypes: string[];
}

interface AssessmentData {
  institution: InstitutionResult;
  regulations: { total: number; applicable: number };
}

interface RequirementFinding {
  requirementId: string;
  description: string;
  critical: boolean;
  status: 'found' | 'partial' | 'not_found';
  evidence: string;
  sourceUrl: string;
  notes: string;
}

interface RegulationVerdict {
  regulationId: string;
  name: string;
  shortName: string;
  grade: 'A' | 'B' | 'C' | 'F';
  score: number;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_checked';
  findings: RequirementFinding[];
  relevantPages: string[];
  weight: number;
}

interface ExternalIndicator {
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

interface ComplianceReport {
  institutionName: string;
  websiteUrl: string;
  scanDate: string;
  overallGrade: 'A' | 'B' | 'C' | 'F';
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
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  'public-4year': 'Public University (4-year)',
  'private-nonprofit-4year': 'Private Nonprofit University (4-year)',
  'public-2year': 'Public Community College (2-year)',
  'private-nonprofit-2year': 'Private Nonprofit College (2-year)',
  'private-for-profit': 'For-Profit Institution',
  'religious-affiliation': 'Religious Affiliation',
  'research-intensive': 'Research Intensive (R1/R2)',
  'graduate-professional': 'Graduate / Professional Programs',
  'intercollegiate-athletics': 'Intercollegiate Athletics',
  'online-distance-ed': 'Online / Distance Education',
  'medical-health-programs': 'Medical / Health Programs',
  'residential-campus': 'Residential Campus',
  'title-iv-participant': 'Title IV Participant',
};

const TYPE_COLORS: Record<string, string> = {
  'public-4year': 'bg-blue-100 text-blue-800 border-blue-200',
  'private-nonprofit-4year': 'bg-purple-100 text-purple-800 border-purple-200',
  'public-2year': 'bg-green-100 text-green-800 border-green-200',
  'private-nonprofit-2year': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'private-for-profit': 'bg-red-100 text-red-800 border-red-200',
  'religious-affiliation': 'bg-amber-100 text-amber-800 border-amber-200',
  'research-intensive': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'graduate-professional': 'bg-teal-100 text-teal-800 border-teal-200',
  'intercollegiate-athletics': 'bg-orange-100 text-orange-800 border-orange-200',
  'online-distance-ed': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'medical-health-programs': 'bg-pink-100 text-pink-800 border-pink-200',
  'residential-campus': 'bg-lime-100 text-lime-800 border-lime-200',
  'title-iv-participant': 'bg-violet-100 text-violet-800 border-violet-200',
};

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-yellow-400 text-yellow-900',
  C: 'bg-orange-500 text-white',
  F: 'bg-red-600 text-white',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  found: { label: 'Found', className: 'bg-green-100 text-green-800' },
  partial: { label: 'Partial', className: 'bg-yellow-100 text-yellow-800' },
  not_found: { label: 'Not Found', className: 'bg-red-100 text-red-800' },
};

const VERDICT_STATUS: Record<string, { label: string; className: string }> = {
  compliant: { label: 'Compliant', className: 'text-green-700 bg-green-50 border-green-200' },
  partial: { label: 'Partially Compliant', className: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  non_compliant: { label: 'Non-Compliant', className: 'text-red-700 bg-red-50 border-red-200' },
  not_checked: { label: 'Could Not Check', className: 'text-gray-700 bg-gray-50 border-gray-200' },
};

const INDICATOR_STATUS_STYLES: Record<string, { icon: string; className: string }> = {
  pass: { icon: '✓', className: 'bg-green-50 border-green-200 text-green-800' },
  warning: { icon: '⚠', className: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  fail: { icon: '✗', className: 'bg-red-50 border-red-200 text-red-800' },
  info: { icon: 'ℹ', className: 'bg-blue-50 border-blue-200 text-blue-800' },
  unknown: { icon: '?', className: 'bg-gray-50 border-gray-200 text-gray-600' },
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  financial: { label: 'Financial Health (Title IV)', icon: '💰' },
  accreditation: { label: 'Accreditation & Oversight', icon: '🏛' },
  accessibility: { label: 'Website Accessibility (ADA)', icon: '♿' },
  'federal-oversight': { label: 'Federal Oversight', icon: '🔍' },
  institutional: { label: 'Institutional Data', icon: '📊' },
};

function ExternalIndicatorsPanel({ report }: { report: ComplianceReport }) {
  if (!report.externalIndicators?.length) return null;

  const grouped = new Map<string, ExternalIndicator[]>();
  for (const ind of report.externalIndicators) {
    const list = grouped.get(ind.category) || [];
    list.push(ind);
    grouped.set(ind.category, list);
  }

  const categoryOrder = ['financial', 'accreditation', 'federal-oversight', 'accessibility'];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">External Compliance Indicators</h3>
            <p className="text-indigo-200 text-sm mt-0.5">
              Data-driven checks from government databases and automated analysis
            </p>
          </div>
          <div className="flex gap-3">
            {report.financialHealthScore != null && report.financialHealthScore >= 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{report.financialHealthScore}%</div>
                <div className="text-xs text-indigo-200">Financial</div>
              </div>
            )}
            {report.accessibilityScore != null && report.accessibilityScore >= 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{report.accessibilityScore}/100</div>
                <div className="text-xs text-indigo-200">Accessibility</div>
              </div>
            )}
          </div>
        </div>
        {report.externalSummary && (
          <div className="flex gap-6 mt-3 text-sm">
            <span className="text-green-300">{report.externalSummary.passing} passing</span>
            <span className="text-yellow-300">{report.externalSummary.warnings} warnings</span>
            <span className="text-red-300">{report.externalSummary.failing} failing</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {categoryOrder.map(cat => {
          const indicators = grouped.get(cat);
          if (!indicators?.length) return null;
          const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: '📋' };
          return (
            <div key={cat} className="px-6 py-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>{catInfo.icon}</span> {catInfo.label}
              </h4>
              <div className="grid gap-2">
                {indicators.map(ind => {
                  const style = INDICATOR_STATUS_STYLES[ind.status] || INDICATOR_STATUS_STYLES.unknown;
                  return (
                    <div key={ind.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${style.className}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium shrink-0">{style.icon}</span>
                        <span className="text-sm truncate">{ind.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{ind.value}</span>
                        {ind.threshold && (
                          <span className="text-xs opacity-75 hidden sm:inline">{ind.threshold}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scorecard Component
// ---------------------------------------------------------------------------

function ComplianceScorecard({ report }: { report: ComplianceReport }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Website Compliance Scorecard</h3>
          <p className="text-slate-300 text-sm mt-0.5">
            {report.regulationsChecked} regulations analyzed &middot; {report.crawlStats.pagesScanned} pages scanned
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{report.overallScore}%</div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Overall Score</div>
          </div>
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black ${GRADE_STYLES[report.overallGrade]}`}>
            {report.overallGrade}
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200">
        <div className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{report.compliantCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Compliant</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{report.partialCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Partial</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{report.nonCompliantCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Non-Compliant</div>
        </div>
      </div>

      {/* Per-regulation grade cards */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {report.verdicts.map(v => (
          <div
            key={v.regulationId}
            className="border border-gray-200 rounded-lg p-3 flex items-center gap-3 hover:border-gray-300 transition-colors"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${GRADE_STYLES[v.grade]}`}>
              {v.grade}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{v.shortName}</div>
              <div className="text-xs text-gray-500">{v.score}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gap Report Component
// ---------------------------------------------------------------------------

function ComplianceGapReport({ report }: { report: ComplianceReport }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Detailed Compliance Gap Report</h3>
        <p className="text-sm text-gray-500 mt-0.5">Click a regulation to expand findings</p>
      </div>

      <div className="divide-y divide-gray-100">
        {report.verdicts.map(verdict => {
          const isExpanded = expandedId === verdict.regulationId;
          const vstyle = VERDICT_STATUS[verdict.status] || VERDICT_STATUS.not_checked;
          return (
            <div key={verdict.regulationId}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : verdict.regulationId)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${GRADE_STYLES[verdict.grade]}`}>
                    {verdict.grade}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{verdict.shortName}</div>
                    <div className="text-xs text-gray-500 truncate">{verdict.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${vstyle.className}`}>
                    {vstyle.label}
                  </span>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-5 bg-gray-50 border-t border-gray-100">
                  <div className="space-y-3 mt-3">
                    {verdict.findings.map(f => {
                      const badge = STATUS_BADGE[f.status] || STATUS_BADGE.not_found;
                      return (
                        <div key={f.requirementId} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                                {f.critical && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                                    Critical
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-900 mt-1.5">{f.description}</p>
                            </div>
                          </div>
                          {f.evidence && (
                            <div className="mt-2 pl-3 border-l-2 border-green-300">
                              <p className="text-xs text-gray-600 italic">"{f.evidence}"</p>
                              {f.sourceUrl && (
                                <a
                                  href={f.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
                                >
                                  Source: {f.sourceUrl}
                                </a>
                              )}
                            </div>
                          )}
                          {f.notes && (
                            <p className="mt-2 text-xs text-gray-500">{f.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {verdict.relevantPages.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pages Analyzed</div>
                      <div className="flex flex-wrap gap-1">
                        {verdict.relevantPages.map(url => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded"
                          >
                            {new URL(url).pathname || '/'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Progress Component
// ---------------------------------------------------------------------------

function ScanProgress({ phase }: { phase: 'crawling' | 'analyzing' }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <div className="animate-spin h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full mx-auto" />
      <p className="text-gray-700 font-medium mt-4">
        {phase === 'crawling' ? 'Scanning website pages...' : 'Analyzing compliance with AI...'}
      </p>
      <p className="text-gray-500 text-sm mt-1">
        {phase === 'crawling'
          ? 'Crawling the institution website for compliance-related content'
          : 'Claude is reviewing each regulation against the website content. This may take 30-60 seconds.'}
      </p>
      <div className="mt-4 w-64 mx-auto bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: phase === 'crawling' ? '40%' : '70%' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function InstitutionAssessmentPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InstitutionResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<AssessmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<'crawling' | 'analyzing'>('crawling');
  const [scanError, setScanError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setSelectedInstitution(null);
    setComplianceReport(null);
    try {
      const data = await apiGet<{ success: boolean; total: number; results: InstitutionResult[] }>(
        `/api/assessment/search?q=${encodeURIComponent(query)}&limit=10`
      );
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        setError('No institutions found. Try a different search term.');
      }
    } catch {
      setError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectInstitution = async (id: number) => {
    setIsLoading(true);
    setError(null);
    setComplianceReport(null);
    try {
      const data = await apiGet<AssessmentData>(`/api/assessment/institution/${id}`);
      setSelectedInstitution(data);
    } catch {
      setError('Failed to load institution details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplianceScan = async () => {
    if (!selectedInstitution) return;
    const inst = selectedInstitution.institution;
    const websiteUrl = inst.website;

    if (!websiteUrl) {
      setScanError('No website URL available for this institution.');
      return;
    }

    setIsScanning(true);
    setScanPhase('crawling');
    setScanError(null);
    setComplianceReport(null);

    // Switch to analyzing phase after a short delay to show crawl progress
    const phaseTimer = setTimeout(() => setScanPhase('analyzing'), 8000);

    try {
      const data = await apiPost<{ success: boolean; report: ComplianceReport }>(
        '/api/assessment/compliance-scan',
        {
          websiteUrl: websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`,
          institutionTypes: inst.allTypes,
          institutionName: inst.name,
          institutionData: inst,
        }
      );
      setComplianceReport(data.report);
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Compliance scan failed. Please try again.';
      setScanError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      clearTimeout(phaseTimer);
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Institution Assessment</h1>
        <p className="text-gray-600 mt-1">
          Search any US higher education institution to determine its regulatory profile,
          applicable compliance requirements, and scan its website for compliance gaps.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by institution name (e.g., Moravian University, Penn State, MIT)..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Data sourced from the College Scorecard (U.S. Department of Education) — covers all Title IV institutions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && !selectedInstitution && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {searchResults.map(inst => (
              <button
                key={inst.id}
                onClick={() => handleSelectInstitution(inst.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{inst.name}</div>
                    <div className="text-sm text-gray-500">
                      {inst.city}, {inst.state} &middot; {inst.ownership} &middot;{' '}
                      {inst.studentSize?.toLocaleString() || '?'} students
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${TYPE_COLORS[inst.classification?.primaryType] || 'bg-gray-100 text-gray-800'}`}>
                    {TYPE_LABELS[inst.classification?.primaryType] || inst.classification?.primaryType}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-3">Analyzing institution...</p>
        </div>
      )}

      {/* Assessment Result */}
      {selectedInstitution && (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => { setSelectedInstitution(null); setComplianceReport(null); setScanError(null); }}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            &larr; Back to search results
          </button>

          {/* Institution Profile Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <h2 className="text-xl font-bold text-white">
                {selectedInstitution.institution.name}
              </h2>
              <p className="text-blue-100 mt-1">
                {selectedInstitution.institution.city}, {selectedInstitution.institution.state}
                {selectedInstitution.institution.website && (
                  <> &middot; <a href={`https://${selectedInstitution.institution.website}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{selectedInstitution.institution.website}</a></>
                )}
              </p>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Ownership</div>
                <div className="font-medium text-gray-900 mt-1">{selectedInstitution.institution.ownership}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Students</div>
                <div className="font-medium text-gray-900 mt-1">{selectedInstitution.institution.studentSize?.toLocaleString() || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Carnegie</div>
                <div className="font-medium text-gray-900 mt-1 text-sm">{selectedInstitution.institution.carnegieClassification}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Accreditor</div>
                <div className="font-medium text-gray-900 mt-1 text-sm">{selectedInstitution.institution.accreditor || 'N/A'}</div>
              </div>
              {selectedInstitution.institution.religiousAffiliation && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Religious Affiliation</div>
                  <div className="font-medium text-gray-900 mt-1">{selectedInstitution.institution.religiousAffiliation}</div>
                </div>
              )}
              {selectedInstitution.institution.admissionRate != null && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Admission Rate</div>
                  <div className="font-medium text-gray-900 mt-1">{(selectedInstitution.institution.admissionRate * 100).toFixed(1)}%</div>
                </div>
              )}
              {selectedInstitution.institution.tuitionInState != null && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Tuition (In-State)</div>
                  <div className="font-medium text-gray-900 mt-1">${selectedInstitution.institution.tuitionInState?.toLocaleString()}</div>
                </div>
              )}
              {selectedInstitution.institution.pellGrantRate != null && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Pell Grant Rate</div>
                  <div className="font-medium text-gray-900 mt-1">{(selectedInstitution.institution.pellGrantRate * 100).toFixed(1)}%</div>
                </div>
              )}
            </div>
          </div>

          {/* EdSteward Classification */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">EdSteward Classification</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Primary Classification</div>
                <span className={`inline-flex px-3 py-1.5 rounded-lg border text-sm font-medium ${TYPE_COLORS[selectedInstitution.institution.classification.primaryType] || 'bg-gray-100 text-gray-800'}`}>
                  {TYPE_LABELS[selectedInstitution.institution.classification.primaryType] || selectedInstitution.institution.classification.primaryType}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Institutional Characteristics</div>
                {selectedInstitution.institution.classification.characteristics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedInstitution.institution.classification.characteristics.map(char => (
                      <span key={char} className={`inline-flex px-3 py-1.5 rounded-lg border text-sm font-medium ${TYPE_COLORS[char] || 'bg-gray-100 text-gray-800'}`}>
                        {TYPE_LABELS[char] || char}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No additional characteristics detected from available data.</p>
                )}
              </div>
            </div>
          </div>

          {/* Regulation Impact */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regulatory Impact</h3>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">{selectedInstitution.regulations.applicable}</div>
                <div className="text-sm text-gray-500 mt-1">Applicable Regulations</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-400">{selectedInstitution.regulations.total}</div>
                <div className="text-sm text-gray-500 mt-1">Total in Database</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">{selectedInstitution.regulations.total - selectedInstitution.regulations.applicable}</div>
                <div className="text-sm text-gray-500 mt-1">Filtered Out</div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Sales Insight:</strong> Based on publicly available data, {selectedInstitution.institution.name} is
                subject to at least <strong>{selectedInstitution.regulations.applicable} federal and state regulations</strong>.
                EdSteward can help them manage compliance across all of these requirements with automated tracking,
                attestation workflows, and deadline management.
              </p>
            </div>
          </div>

          {/* Compliance Scan Section */}
          {!complianceReport && !isScanning && (
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Website Compliance Scan</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Crawl {selectedInstitution.institution.name}'s website and use AI to check whether required
                    regulatory disclosures are published. Takes 30-90 seconds.
                  </p>
                </div>
                <button
                  onClick={handleComplianceScan}
                  disabled={!selectedInstitution.institution.website}
                  className="px-6 py-3 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Run Compliance Scan
                </button>
              </div>
              {scanError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {scanError}
                </div>
              )}
            </div>
          )}

          {/* Scan in progress */}
          {isScanning && <ScanProgress phase={scanPhase} />}

          {/* Compliance Results */}
          {complianceReport && (
            <>
              <ComplianceScorecard report={complianceReport} />

              {/* External Indicators */}
              <ExternalIndicatorsPanel report={complianceReport} />

              {/* Sales CTA */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-5">
                <p className="text-sm text-red-900">
                  <strong>Sales Opportunity:</strong> Our scan found{' '}
                  <strong>{complianceReport.nonCompliantCount} non-compliant</strong> and{' '}
                  <strong>{complianceReport.partialCount} partially compliant</strong> areas
                  across {complianceReport.regulationsChecked} regulations.
                  {complianceReport.nonCompliantCount > 0 && (
                    <> These gaps represent real regulatory risk. EdSteward provides automated monitoring, 
                    task management, and evidence collection to close these gaps.</>
                  )}
                </p>
              </div>

              <ComplianceGapReport report={complianceReport} />

              {/* Scan metadata */}
              <div className="text-xs text-gray-400 text-right">
                Scanned on {new Date(complianceReport.scanDate).toLocaleString()} &middot;{' '}
                {complianceReport.crawlStats.pagesScanned} pages crawled in {(complianceReport.crawlStats.durationMs / 1000).toFixed(1)}s &middot;{' '}
                AI analysis in {(complianceReport.analysisDurationMs / 1000).toFixed(1)}s
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
