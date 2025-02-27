import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, AlertTriangle, CheckCircle, XCircle, Loader2, FileText, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ConsoleView } from "@/components/common/console-view";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { format } from "date-fns";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ValidationError {
  regulationId: string;
  field: string;
  error: string;
  value: any;
  severity: 'error' | 'warning';
  category: 'required_fields' | 'dates' | 'urls' | 'content' | 'documentation' | 'references';
  priority: 1 | 2 | 3;
}

interface ValidationReport {
  totalRegulations: number;
  validRegulations: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  timestamp: Date;
}

interface ConsoleLog {
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
  timestamp: string;
}

const categoryColors = {
  required_fields: 'bg-red-100 text-red-800',
  dates: 'bg-blue-100 text-blue-800',
  urls: 'bg-purple-100 text-purple-800',
  content: 'bg-green-100 text-green-800',
  documentation: 'bg-yellow-100 text-yellow-800',
  references: 'bg-orange-100 text-orange-800'
};

const priorityLabels = {
  1: 'Critical',
  2: 'Important',
  3: 'Low'
};

const priorityColors = {
  1: 'bg-red-100 text-red-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-blue-100 text-blue-800'
};

export default function ValidationPage() {
  const { toast } = useToast();
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);

  const addLog = (message: string, type: 'info' | 'error' | 'warning' | 'success' = 'info') => {
    setConsoleLogs(prev => [...prev, {
      message,
      type,
      timestamp: format(new Date(), 'HH:mm:ss')
    }]);
  };

  // Load validation data immediately when page loads
  const { data: report, isLoading: reportLoading } = useQuery<ValidationReport>({
    queryKey: ["/api/regulations/validate"],
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      setConsoleLogs([]);
      addLog("Starting validation process...", "info");
      const response = await apiRequest("POST", "/api/regulations/validate", {});
      if (!response.ok) {
        throw new Error('Validation failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      addLog(`Validation complete. Checked ${data.totalRegulations} regulations.`, "success");
      addLog(`Found ${data.errors.length} errors and ${data.warnings.length} warnings.`, "info");

      // Group and log issues by category
      const issuesByCategory = [...data.errors, ...data.warnings].reduce((acc, issue) => {
        acc[issue.category] = acc[issue.category] || [];
        acc[issue.category].push(issue);
        return acc;
      }, {} as Record<string, ValidationError[]>);

      Object.entries(issuesByCategory).forEach(([category, issues]) => {
        addLog(`${category}: ${issues.length} issues found`, issues[0].severity);
        issues.forEach(issue => {
          addLog(`  - ${issue.regulationId}: ${issue.error}`, issue.severity);
        });
      });

      toast({
        title: "Validation Complete",
        description: `Checked ${data.totalRegulations} regulations. Found ${data.errors.length} errors and ${data.warnings.length} warnings.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations/validate"] });
    },
    onError: (error) => {
      addLog("Validation failed: " + error.message, "error");
      toast({
        title: "Validation Failed",
        description: "There was an error running the validation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const renderCategorySummary = () => {
    if (!report) return null;

    const allIssues = [...report.errors, ...report.warnings];
    const categories = Object.entries(categoryColors).map(([category, colorClass]) => {
      const categoryIssues = allIssues.filter(issue => issue.category === category);
      const errors = categoryIssues.filter(issue => issue.severity === 'error').length;
      const warnings = categoryIssues.filter(issue => issue.severity === 'warning').length;
      const total = errors + warnings;

      return (
        <Card 
          key={category} 
          className="border-2 border-[#5B2C8F] shadow-md bg-purple-50/30 relative hover:bg-purple-50/50 transition-colors"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium capitalize">
              {category.replace(/_/g, ' ')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                {errors > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">{errors} Errors</span>
                  </div>
                )}
                {warnings > 0 && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{warnings} Warnings</span>
                  </div>
                )}
                {total === 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">All Clear</span>
                  </div>
                )}
              </div>
              <Badge className={colorClass} variant="secondary">
                {total}
              </Badge>
            </div>
          </CardContent>
        </Card>
      );
    });

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {categories}
      </div>
    );
  };

  const downloadCSV = () => {
    if (!report) return;

    const allIssues = [
      ...report.errors.map(e => ({ ...e, type: 'Error' })),
      ...report.warnings.map(w => ({ ...w, type: 'Warning' }))
    ];

    const csv = [
      ['Type', 'Priority', 'Category', 'Regulation ID', 'Field', 'Error', 'Current Value'].join(','),
      ...allIssues.map(issue =>
        [
          issue.type,
          priorityLabels[issue.priority],
          issue.category,
          issue.regulationId,
          issue.field,
          issue.error,
          String(issue.value).replace(/,/g, ';')
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!report) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Add title
    doc.setFontSize(20);
    doc.text("Validation Report", pageWidth / 2, 20, { align: "center" });

    // Add timestamp
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), "PPpp")}`, pageWidth / 2, 30, { align: "center" });

    // Add summary
    doc.setFontSize(12);
    doc.text("Summary", 20, 45);

    const summaryData = [
      ["Total Regulations", report.totalRegulations.toString()],
      ["Valid Regulations", report.validRegulations.toString()],
      ["Total Issues", (report.errors.length + report.warnings.length).toString()],
      ["Errors", report.errors.length.toString()],
      ["Warnings", report.warnings.length.toString()]
    ];

    autoTable(doc, {
      startY: 50,
      head: [["Metric", "Count"]],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [0, 38, 122] } // Moravian Blue
    });

    // Add issues table if there are any
    if (report.errors.length > 0 || report.warnings.length > 0) {
      const allIssues = [
        ...report.errors.map(e => ({ ...e, type: 'Error' })),
        ...report.warnings.map(w => ({ ...w, type: 'Warning' }))
      ].sort((a, b) => {
        // Sort first by priority
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by severity
        if (a.severity !== b.severity) {
          return a.severity === 'error' ? -1 : 1;
        }
        // Finally by regulation ID
        return a.regulationId.localeCompare(b.regulationId);
      });

      doc.addPage();
      doc.text("Validation Issues", 20, 20);

      autoTable(doc, {
        startY: 25,
        head: [["Type", "Priority", "Category", "Regulation ID", "Field", "Issue", "Current Value"]],
        body: allIssues.map(issue => [
          issue.type,
          priorityLabels[issue.priority],
          issue.category,
          issue.regulationId,
          issue.field,
          issue.error,
          String(issue.value)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 38, 122] }, // Moravian Blue
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 50 },
          4: { cellWidth: 'auto' },
          5: { cellWidth: 50 },
          6: { cellWidth: 'auto' }
        },
      });
    }

    // Save the PDF
    doc.save(`validation-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);

    toast({
      title: "PDF Generated",
      description: "The validation report has been downloaded as a PDF.",
    });
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Regulation Validation
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Validate regulations against compliance rules and standards
              </p>
            </div>
            <div className="space-x-4">
              {report && report.totalRegulations > 0 && (
                <>
                  <Button variant="outline" onClick={downloadCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={downloadPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </>
              )}
              <Button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Run Validation"
                )}
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          {!reportLoading && report && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Total Regulations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{report.totalRegulations}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Valid Regulations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {report.validRegulations}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Issues Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-yellow-600">
                    {report.errors.length + report.warnings.length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Category Summary Cards */}
          {report && renderCategorySummary()}

          <div className="space-y-8">
            {/* Console View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Validation Console
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConsoleView logs={consoleLogs} className="min-h-[300px]" />
              </CardContent>
            </Card>

            {/* Results Table */}
            {report && (report.errors.length > 0 || report.warnings.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Validation Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Regulation ID</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Current Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...report.errors, ...report.warnings]
                        .sort((a, b) => {
                          // Sort first by priority
                          if (a.priority !== b.priority) {
                            return a.priority - b.priority;
                          }
                          // Then by severity
                          if (a.severity !== b.severity) {
                            return a.severity === 'error' ? -1 : 1;
                          }
                          // Finally by regulation ID
                          return a.regulationId.localeCompare(b.regulationId);
                        })
                        .map((issue, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {issue.severity === 'error' ? (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                )}
                                <span className={
                                  issue.severity === 'error'
                                    ? 'text-red-600 font-medium'
                                    : 'text-yellow-600 font-medium'
                                }>
                                  {issue.severity === 'error' ? 'Error' : 'Warning'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={priorityColors[issue.priority]}
                                variant="secondary"
                              >
                                {priorityLabels[issue.priority]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={categoryColors[issue.category]}
                                variant="secondary"
                              >
                                {issue.category.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>{issue.regulationId}</TableCell>
                            <TableCell>{issue.field}</TableCell>
                            <TableCell>{issue.error}</TableCell>
                            <TableCell>
                              <code className="px-2 py-1 bg-gray-100 rounded">
                                {String(issue.value)}
                              </code>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}