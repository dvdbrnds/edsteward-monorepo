/**
 * Audit Trail Panel
 * Displays comprehensive audit log for a regulation showing every action taken
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Bot,
  Clock,
  FileEdit,
  Plus,
  Trash2,
  Eye,
  AlertTriangle,
  Shield,
  Activity,
  Download,
  FileArchive,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface AuditLog {
  id: number | string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'view';
  userId: number | null;
  userEmail: string | null;
  userName?: string | null;
  timestamp: string;
  previousValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  changes: Record<string, { old: any; new: any }> | null;
  complianceImpact: string | null;
  riskLevel: string | null;
  metadata: {
    taskTitle?: string;
    content?: string;
    source?: string;
    note?: string;
  } | null;
}

interface AuditTrailPanelProps {
  regulationId: number;
}

export function AuditTrailPanel({ regulationId }: AuditTrailPanelProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/legal-export/regulation/${regulationId}?purpose=Legal%20Discovery%20Export`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const data = await response.json();
      
      // Download as file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal-export-${data.exportId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `Export ID: ${data.exportId} - ${data.stats.totalActivityRecords} activity records exported`,
      });
    } catch (err) {
      toast({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Failed to export data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZIP = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/legal-export/regulation/${regulationId}/download?purpose=Legal%20Discovery%20Export`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `legal-export-regulation-${regulationId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Complete',
        description: 'ZIP archive with all data and evidence files downloaded',
      });
    } catch (err) {
      toast({
        title: 'Download Failed',
        description: err instanceof Error ? err.message : 'Failed to download ZIP',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: AuditLog[];
    meta: {
      totalEntries: number;
      actionSummary: Record<string, number>;
      entitySummary: Record<string, number>;
    };
  }>({
    queryKey: ['audit', 'regulation', regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/audit/regulation/${regulationId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      return response.json();
    },
    enabled: !!regulationId,
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'update':
        return <FileEdit className="h-4 w-4 text-blue-600" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'view':
        return <Eye className="h-4 w-4 text-slate-500" />;
      default:
        return <Activity className="h-4 w-4 text-slate-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'update':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'delete':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'view':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getRiskBadge = (riskLevel: string | null) => {
    if (!riskLevel) return null;
    switch (riskLevel) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-700 text-xs">High Risk</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Medium</Badge>;
      default:
        return null;
    }
  };

  const formatEntityType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatChanges = (changes: Record<string, { old: any; new: any }> | null) => {
    if (!changes) return null;
    return Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
      <div key={field} className="text-xs mt-1 pl-4 border-l-2 border-slate-200">
        <span className="font-medium text-slate-600">{field}:</span>{' '}
        <span className="text-red-600 line-through">{JSON.stringify(oldVal)}</span>{' '}
        <span className="text-slate-400">→</span>{' '}
        <span className="text-green-600">{JSON.stringify(newVal)}</span>
      </div>
    ));
  };

  const isSystemAction = (log: AuditLog) => {
    return !log.userId || log.userEmail?.includes('system') || log.userEmail?.includes('mcp');
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-3 p-3 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>Failed to load audit trail</p>
        <p className="text-sm text-muted-foreground mt-1">You may not have permission to view audit logs</p>
      </div>
    );
  }

  const logs = data?.data || [];
  const meta = data?.meta;

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">No audit records found</p>
        <p className="text-sm text-muted-foreground mt-1">Actions on this regulation will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legal Export Actions */}
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Legal Discovery Export</p>
            <p className="text-xs text-amber-600">Export all data for court-ordered subpoena response</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            disabled={isExporting}
            className="border-amber-300 hover:bg-amber-100"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export JSON
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadZIP}
            disabled={isDownloading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileArchive className="h-4 w-4 mr-2" />
            )}
            Download ZIP
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {meta && (
        <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">{meta.totalEntries}</p>
            <p className="text-xs text-muted-foreground">Total Actions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{meta.actionSummary?.create || 0}</p>
            <p className="text-xs text-muted-foreground">Created</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{meta.actionSummary?.update || 0}</p>
            <p className="text-xs text-muted-foreground">Updated</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{meta.actionSummary?.delete || 0}</p>
            <p className="text-xs text-muted-foreground">Deleted</p>
          </div>
        </div>
      )}

      {/* Audit Log Timeline */}
      <ScrollArea className="h-[500px] pr-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
          
          {logs.map((log) => (
            <div key={log.id} className="relative flex gap-4 pb-6">
              {/* Timeline dot */}
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white ${
                log.riskLevel === 'critical' ? 'border-red-500' :
                log.riskLevel === 'high' ? 'border-orange-400' :
                'border-slate-300'
              }`}>
                {isSystemAction(log) ? (
                  <Bot className="h-5 w-5 text-purple-600" />
                ) : (
                  <User className="h-5 w-5 text-slate-600" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 bg-white border rounded-lg p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                        <span className="ml-1 capitalize">{log.action}</span>
                      </Badge>
                      <span className="font-medium text-slate-800">
                        {formatEntityType(log.entityType)}
                      </span>
                      {getRiskBadge(log.riskLevel)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1">
                      {isSystemAction(log) ? (
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          System / EdSteward
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.userName || log.userEmail || `User #${log.userId}`}
                        </span>
                      )}
                    </p>

                    {/* Show task title if this is task activity */}
                    {log.metadata?.taskTitle && (
                      <p className="text-sm font-medium text-slate-700 mt-2">
                        Task: {log.metadata.taskTitle}
                      </p>
                    )}

                    {/* Show content/description from task activity */}
                    {log.metadata?.content && (
                      <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2 rounded">
                        {log.metadata.content}
                      </p>
                    )}

                    {/* Show changes */}
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-slate-600">Changes:</p>
                        {formatChanges(log.changes)}
                      </div>
                    )}

                    {/* Show metadata notes */}
                    {log.metadata?.note && (
                      <p className="text-xs text-slate-600 mt-2 italic">
                        Note: {log.metadata.note}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.timestamp), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), "h:mm:ss a")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default AuditTrailPanel;
