import Navigation from "@/components/layout/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ValidationError {
  regulationId: string;
  field: string;
  error: string;
  value: any;
  severity: 'error' | 'warning';
}

interface ValidationReport {
  totalRegulations: number;
  validRegulations: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  timestamp: Date;
}

export default function ValidationPage() {
  const { toast } = useToast();

  const { data: report, isLoading: reportLoading } = useQuery<ValidationReport>({
    queryKey: ["/api/regulations/validate"],
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/regulations/validate", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Validation Complete",
        description: "The validation report has been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations/validate"] });
    },
  });

  const downloadReport = () => {
    if (!report) return;

    const allIssues = [
      ...report.errors.map(e => ({ ...e, type: 'Error' })),
      ...report.warnings.map(w => ({ ...w, type: 'Warning' }))
    ];

    const csv = [
      ['Type', 'Regulation ID', 'Field', 'Error', 'Current Value'].join(','),
      ...allIssues.map(issue => 
        [
          issue.type,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Regulation Validation
            </h1>
            <div className="space-x-4">
              {report && (
                <Button variant="outline" onClick={downloadReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              )}
              <Button 
                onClick={() => validateMutation.mutate()} 
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? "Validating..." : "Run Validation"}
              </Button>
            </div>
          </div>

          {reportLoading || validateMutation.isPending ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-4">
                  <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
                  <span>Loading validation results...</span>
                </div>
              </CardContent>
            </Card>
          ) : report ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
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

              {(report.errors.length > 0 || report.warnings.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Validation Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Severity</TableHead>
                          <TableHead>Regulation ID</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Current Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...report.errors, ...report.warnings]
                          .sort((a, b) => {
                            if (a.severity === b.severity) {
                              return a.regulationId.localeCompare(b.regulationId);
                            }
                            return a.severity === 'error' ? -1 : 1;
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
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p>Click "Run Validation" to check your regulations for issues.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}