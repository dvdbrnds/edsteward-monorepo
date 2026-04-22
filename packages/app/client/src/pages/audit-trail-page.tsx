/**
 * Audit Trail Page for EdSteward
 * Allows administrators to view and query audit logs for compliance tracking
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navigation from '@/components/layout/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter, Download, Eye, Clock, User, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  userId: number;
  userEmail: string;
  ipAddress: string;
  timestamp: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: Record<string, { old: any; new: any }>;
  regulationId?: number;
  complianceImpact?: string;
  riskLevel?: string;
  metadata?: Record<string, any>;
}

interface AuditQueryParams {
  entityType?: string;
  action?: string;
  regulationId?: string;
  complianceImpact?: string;
  riskLevel?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export default function AuditTrailPage() {
  const { toast } = useToast();
  const [queryParams, setQueryParams] = useState<AuditQueryParams>({
    limit: 50,
    offset: 0
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Export compliance report as CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/audit/compliance-report?format=csv', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to export report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-audit-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export Complete',
        description: 'Compliance audit report has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export report',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch audit logs
  const { data: auditData, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/audit/logs?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      return response.json();
    }
  });


  const handleSearch = () => {
    setQueryParams({ ...queryParams, offset: 0 });
    refetch();
  };

  const handleReset = () => {
    setQueryParams({ limit: 50, offset: 0 });
    refetch();
  };

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-foreground';
    }
  };

  const getComplianceImpactColor = (impact?: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-foreground';
    }
  };

  const formatChanges = (changes?: Record<string, { old: any; new: any }>) => {
    if (!changes) return null;

    return Object.entries(changes).map(([field, change]) => (
      <div key={field} className="mb-2 p-2 bg-background rounded">
        <div className="font-medium text-sm text-foreground">{field}:</div>
        <div className="text-sm">
          <span className="text-red-600">- {JSON.stringify(change.old)}</span>
        </div>
        <div className="text-sm">
          <span className="text-green-600">+ {JSON.stringify(change.new)}</span>
        </div>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Trail</h1>
          <p className="text-muted-foreground">Monitor compliance actions and system changes</p>
        </div>
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={handleExportCSV}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? 'Exporting...' : 'Export Report'}
        </Button>
      </div>

      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="regulation">By Regulation</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label htmlFor="audit-search" className="text-sm font-medium">Search</label>
                  <Input
                    id="audit-search"
                    placeholder="Search logs..."
                    value={queryParams.search || ''}
                    onChange={(e) => setQueryParams({ ...queryParams, search: e.target.value })}
                  />
                </div>
                
                <div>
                  <label htmlFor="audit-entity-type" className="text-sm font-medium">Entity Type</label>
                  <Select
                    value={queryParams.entityType || 'all'}
                    onValueChange={(value) => setQueryParams({ ...queryParams, entityType: value === 'all' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="regulation_action">Regulation Actions</SelectItem>
                      <SelectItem value="deadline">Deadlines</SelectItem>
                      <SelectItem value="note">Notes</SelectItem>
                      <SelectItem value="evidence">Evidence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="audit-action" className="text-sm font-medium">Action</label>
                  <Select
                    value={queryParams.action || 'all'}
                    onValueChange={(value) => setQueryParams({ ...queryParams, action: value === 'all' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="view">View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="audit-risk-level" className="text-sm font-medium">Risk Level</label>
                  <Select
                    value={queryParams.riskLevel || 'all'}
                    onValueChange={(value) => setQueryParams({ ...queryParams, riskLevel: value === 'all' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All levels</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="audit-regulation-id" className="text-sm font-medium">Regulation ID</label>
                  <Input
                    id="audit-regulation-id"
                    placeholder="Regulation ID"
                    value={queryParams.regulationId || ''}
                    onChange={(e) => setQueryParams({ ...queryParams, regulationId: e.target.value })}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button onClick={handleSearch} className="gap-2">
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              {auditData && (
                <p className="text-sm text-muted-foreground">
                  Showing {auditData.data?.length || 0} of {auditData.pagination?.total || 0} logs
                </p>
              )}
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {error && (
                <div className="text-center py-8 text-red-600">
                  Error loading audit logs: {error.message}
                </div>
              )}

              {auditData?.data && (
                <div className="space-y-4">
                  {auditData.data.map((log: AuditLog) => (
                    <div
                      key={log.id}
                      className="border rounded-lg p-4 hover:bg-background cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLog(log)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLog(log); }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{log.entityType}</Badge>
                            <Badge variant="outline">{log.action}</Badge>
                            {log.riskLevel && (
                              <Badge className={getRiskLevelColor(log.riskLevel)}>
                                {log.riskLevel}
                              </Badge>
                            )}
                            {log.complianceImpact && (
                              <Badge className={getComplianceImpactColor(log.complianceImpact)}>
                                {log.complianceImpact} impact
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {log.userEmail}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), 'PPp')}
                              </span>
                              {log.regulationId && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  Regulation {log.regulationId}
                                </span>
                              )}
                            </div>
                            <div>Entity: {log.entityId}</div>
                            {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regulation">
          <Card>
            <CardHeader>
              <CardTitle>Regulation Audit Trail</CardTitle>
              <p className="text-sm text-muted-foreground">
                View all audit logs for a specific regulation
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Enter regulation ID"
                  className="max-w-xs"
                />
                <Button>View Audit Trail</Button>
              </div>
              <div className="text-center py-8 text-muted-foreground">
                Enter a regulation ID to view its complete audit trail
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Audit Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Audit summary and compliance reports coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Audit Log Details</h2>
                <Button variant="ghost" onClick={() => setSelectedLog(null)}>
                  ×
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Basic Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedLog.id}</div>
                    <div><strong>Entity Type:</strong> {selectedLog.entityType}</div>
                    <div><strong>Entity ID:</strong> {selectedLog.entityId}</div>
                    <div><strong>Action:</strong> {selectedLog.action}</div>
                    <div><strong>User:</strong> {selectedLog.userEmail}</div>
                    <div><strong>Timestamp:</strong> {format(new Date(selectedLog.timestamp), 'PPpp')}</div>
                    <div><strong>IP Address:</strong> {selectedLog.ipAddress}</div>
                    {selectedLog.regulationId && (
                      <div><strong>Regulation ID:</strong> {selectedLog.regulationId}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Compliance Information</h3>
                  <div className="space-y-2 text-sm">
                    {selectedLog.riskLevel && (
                      <div>
                        <strong>Risk Level:</strong>{' '}
                        <Badge className={getRiskLevelColor(selectedLog.riskLevel)}>
                          {selectedLog.riskLevel}
                        </Badge>
                      </div>
                    )}
                    {selectedLog.complianceImpact && (
                      <div>
                        <strong>Compliance Impact:</strong>{' '}
                        <Badge className={getComplianceImpactColor(selectedLog.complianceImpact)}>
                          {selectedLog.complianceImpact}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedLog.changes && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Changes Made</h3>
                  <div className="bg-background p-4 rounded">
                    {formatChanges(selectedLog.changes)}
                  </div>
                </div>
              )}

              {selectedLog.metadata && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Metadata</h3>
                  <pre className="bg-background p-4 rounded text-sm overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
