/**
 * Compliance Documents Component
 * 
 * Provides UI for viewing HECVAT compliance status and downloading
 * compliance reports (Full and Lite PDF) from the admin settings page.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { generateHecvatFullPDF, generateHecvatLitePDF } from '@/lib/hecvat-pdf-generator';

interface SectionSummary {
  id: string;
  name: string;
  status: string;
  total: number;
  compliant: number;
  inProgress: number;
  partial: number;
  compliancePercentage: number;
}

interface ComplianceSummary {
  vendor: {
    name: string;
    productName: string;
    completedDate: string;
  };
  metadata: {
    hecvatVersion: string;
    documentVersion: string;
    lastUpdated: string;
    nextReview: string;
    approvedBy: string;
  };
  overallCompliancePercentage: number;
  totalQuestions: number;
  totalCompliant: number;
  totalInProgress: number;
  sections: SectionSummary[];
  thirdPartyCertifications: {
    provider: string;
    service: string;
    certifications: string[];
  }[];
}

interface HecvatQuestion {
  id: string;
  question: string;
  response: string;
  status: string;
  evidence?: string;
  notes?: string;
  liteIncluded: boolean;
}

interface HecvatSection {
  id: string;
  name: string;
  description: string;
  status: string;
  questions: HecvatQuestion[];
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'compliant':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Compliant
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    case 'partially_compliant':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Partial
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ComplianceDocuments() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isGeneratingFull, setIsGeneratingFull] = useState(false);
  const [isGeneratingLite, setIsGeneratingLite] = useState(false);

  // Fetch compliance summary
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['/api/compliance/hecvat/summary'],
    queryFn: async () => {
      const response = await fetch('/api/compliance/hecvat/summary');
      if (!response.ok) throw new Error('Failed to fetch compliance summary');
      const data = await response.json();
      return data.summary as ComplianceSummary;
    },
  });

  // Fetch full report (for PDF generation)
  const { data: reportData } = useQuery({
    queryKey: ['/api/compliance/hecvat'],
    queryFn: async () => {
      const response = await fetch('/api/compliance/hecvat');
      if (!response.ok) throw new Error('Failed to fetch HECVAT report');
      const data = await response.json();
      return data.report;
    },
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleDownloadFull = async () => {
    if (!reportData) return;
    setIsGeneratingFull(true);
    try {
      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
      await generateHecvatFullPDF(reportData);
    } catch (error) {
      console.error('Failed to generate full PDF:', error);
    } finally {
      setIsGeneratingFull(false);
    }
  };

  const handleDownloadLite = async () => {
    if (!reportData) return;
    setIsGeneratingLite(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      await generateHecvatLitePDF(reportData);
    } catch (error) {
      console.error('Failed to generate lite PDF:', error);
    } finally {
      setIsGeneratingLite(false);
    }
  };

  if (summaryLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading compliance data...</span>
        </CardContent>
      </Card>
    );
  }

  if (summaryError || !summaryData) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load compliance data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const { overallCompliancePercentage, totalQuestions, totalCompliant, totalInProgress, sections } = summaryData;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>HECVAT Compliance Status</CardTitle>
              <CardDescription>
                Higher Education Community Vendor Assessment Toolkit (v{summaryData.metadata.hecvatVersion})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">{overallCompliancePercentage}%</div>
              <div className="text-sm text-muted-foreground mt-1">Overall Compliance</div>
              <Progress value={overallCompliancePercentage} className="mt-2 h-2" />
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{totalCompliant}</div>
              <div className="text-sm text-muted-foreground mt-1">Questions Compliant</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{totalInProgress}</div>
              <div className="text-sm text-muted-foreground mt-1">In Progress</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-foreground">{totalQuestions}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Questions</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last Updated: {summaryData.metadata.lastUpdated}</span>
            <span className="mx-2">|</span>
            <span>Next Review: {summaryData.metadata.nextReview}</span>
            <span className="mx-2">|</span>
            <span>Approved By: {summaryData.metadata.approvedBy}</span>
          </div>
        </CardContent>
      </Card>

      {/* Download Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Compliance Reports
          </CardTitle>
          <CardDescription>
            Generate and download HECVAT compliance reports to share with auditors, accreditation bodies, or internal stakeholders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Report */}
            <div className="border rounded-lg p-5 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">HECVAT Full Report</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comprehensive compliance report with all {totalQuestions} questions, detailed responses, evidence references, and policy document index. Approximately 15-20 pages.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">PDF</Badge>
                    <Badge variant="outline" className="text-xs">All Sections</Badge>
                    <Badge variant="outline" className="text-xs">Evidence References</Badge>
                  </div>
                  <Button
                    onClick={handleDownloadFull}
                    disabled={!reportData || isGeneratingFull}
                    className="mt-4 w-full"
                  >
                    {isGeneratingFull ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Full Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Lite Report */}
            <div className="border rounded-lg p-5 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">HECVAT Lite Summary</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Condensed compliance summary with key questions from each section. Ideal for quick vendor assessments. Approximately 5-8 pages.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">PDF</Badge>
                    <Badge variant="outline" className="text-xs">Key Questions</Badge>
                    <Badge variant="outline" className="text-xs">Summary Format</Badge>
                  </div>
                  <Button
                    onClick={handleDownloadLite}
                    disabled={!reportData || isGeneratingLite}
                    variant="outline"
                    className="mt-4 w-full"
                  >
                    {isGeneratingLite ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Lite Summary
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section-by-Section Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Section-by-Section Status
          </CardTitle>
          <CardDescription>
            Click a section to see detailed compliance status for each HECVAT area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sections.map((section) => (
              <div key={section.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={expandedSections.has(section.id)}
                  aria-label={`${section.name} compliance section, ${section.compliancePercentage}% compliant`}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div>
                      <span className="font-medium text-foreground">{section.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({section.compliant}/{section.total} questions)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2">
                      <Progress value={section.compliancePercentage} className="w-24 h-2" />
                      <span className="text-sm font-medium text-muted-foreground w-10 text-right">
                        {section.compliancePercentage}%
                      </span>
                    </div>
                    <StatusBadge status={section.status} />
                  </div>
                </button>

                {expandedSections.has(section.id) && (
                  <div className="border-t bg-muted/10">
                    {/* Summary bar */}
                    <div className="px-4 py-3 border-b bg-muted/20">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          <span className="font-medium text-green-700 dark:text-green-400">{section.compliant} Compliant</span>
                        </span>
                        {section.partial > 0 && (
                          <span className="flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                            <span className="font-medium text-yellow-700 dark:text-yellow-400">{section.partial} Partial</span>
                          </span>
                        )}
                        {section.inProgress > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="font-medium text-amber-700 dark:text-amber-400">{section.inProgress} In Progress</span>
                          </span>
                        )}
                        <span className="text-muted-foreground ml-auto">{section.total} total</span>
                      </div>
                      <Progress value={section.compliancePercentage} className="h-1.5 mt-2" />
                    </div>

                    {/* Individual questions */}
                    <div className="divide-y">
                      {reportData?.sections
                        ?.find((s: HecvatSection) => s.id === section.id)
                        ?.questions?.map((q: HecvatQuestion) => (
                          <div key={q.id} className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              {/* Status icon */}
                              <div className="flex-shrink-0 mt-0.5">
                                {q.status === 'compliant' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : q.status === 'partially_compliant' ? (
                                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                ) : (
                                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                )}
                              </div>

                              {/* Question content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div>
                                    <span className="text-xs font-mono text-muted-foreground mr-2">{q.id}</span>
                                    <span className="font-medium text-sm text-foreground">{q.question}</span>
                                  </div>
                                  <StatusBadge status={q.status} />
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                                  {q.response}
                                </p>

                                {(q.evidence || q.notes) && (
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                    {q.evidence && (
                                      <span className="text-muted-foreground">
                                        <span className="font-medium text-foreground/70">Evidence:</span>{' '}
                                        {q.evidence}
                                      </span>
                                    )}
                                    {q.notes && (
                                      <span className="text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded">
                                        {q.notes}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )) ?? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                            Loading questions...
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Third-Party Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Infrastructure Certifications
          </CardTitle>
          <CardDescription>
            Certifications held by EdSteward's infrastructure and service providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summaryData.thirdPartyCertifications.map((cert, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="font-medium text-foreground">{cert.provider}</div>
                <div className="text-sm text-muted-foreground mt-1">{cert.service}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {cert.certifications.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Supporting Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Supporting Policy Documents
          </CardTitle>
          <CardDescription>
            Detailed policy documents that support the HECVAT compliance report. Download to share with auditors or institutional reviewers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'Information Security Policy', slug: 'information-security-policy', section: 'Security Controls', review: 'Annual', lastReviewed: 'Feb 2026' },
              { name: 'Incident Response Plan', slug: 'incident-response-plan', section: 'Incident Response', review: 'Semi-annual', lastReviewed: 'Feb 2026' },
              { name: 'Data Retention Policy', slug: 'data-retention-policy', section: 'Data Protection', review: 'Annual', lastReviewed: 'Feb 2026' },
              { name: 'Privacy Policy', slug: 'privacy-policy', section: 'Privacy', review: 'Annual', lastReviewed: 'Feb 2026' },
              { name: 'AI Governance Policy', slug: 'ai-governance-policy', section: 'AI Governance', review: 'Semi-annual', lastReviewed: 'Feb 2026' },
              { name: 'Emergency Access Procedure', slug: 'emergency-access-procedure', section: 'Business Continuity', review: 'Annual', lastReviewed: 'Feb 2026' },
            ].map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="font-medium text-sm text-foreground">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">
                      HECVAT Section: {doc.section} | Review: {doc.review} | Last: {doc.lastReviewed}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = `/api/compliance/policies/${doc.slug}/download`;
                    a.download = '';
                    a.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
            All policy documents are also available upon request at{' '}
            <a href="mailto:support@edsteward.ai" className="text-primary hover:underline">
              support@edsteward.ai
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
