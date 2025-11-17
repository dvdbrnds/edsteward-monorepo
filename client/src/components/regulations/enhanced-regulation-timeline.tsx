import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  History, 
  Clock, 
  RotateCcw, 
  Eye, 
  FileText,
  User,
  GitCommit,
  Download,
  Zap,
  Shield
} from "lucide-react";
import type { Regulation } from "@shared/schema";

interface RegulationVersion {
  id: number;
  regulationId: number;
  versionNumber: number;
  content: string;
  createdAt: string;
  createdBy: number;
  createdByUser?: {
    username: string;
    firstName?: string;
    lastName?: string;
  };
  source: 'local' | 'mcp' | 'import' | 'rollback';
  sourceId?: string;
  changesSummary?: string;
  validationStatus?: Array<{
    level: string;
    status: 'passed' | 'failed' | 'pending';
    details: any;
  }>;
}

interface RegulationUpdate {
  id: number;
  regulationId: number;
  name: string;
  status: 'pending' | 'accepted' | 'rejected';
  updateDate: string;
  signature?: string;
  userId?: number;
  user?: {
    username: string;
    firstName?: string;
    lastName?: string;
  };
  changeStats?: {
    addedPercentage: number;
    removedPercentage: number;
    changedPercentage: number;
  };
}

interface EnhancedRegulationTimelineProps {
  regulation: Regulation;
  showRollback?: boolean;
}

export const EnhancedRegulationTimeline: React.FC<EnhancedRegulationTimelineProps> = ({ 
  regulation, 
  showRollback = true 
}) => {
  const [_selectedVersion, setSelectedVersion] = useState<RegulationVersion | null>(null);
  const [compareVersions, setCompareVersions] = useState<[RegulationVersion | null, RegulationVersion | null]>([null, null]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all versions for this regulation
  const { data: versions = [], isLoading: versionsLoading } = useQuery<RegulationVersion[]>({
    queryKey: ['/api/regulations', regulation.id, 'versions'],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${regulation.id}/versions`);
      if (!response.ok) throw new Error('Failed to fetch versions');
      return response.json();
    }
  });

  // Fetch pending updates for this regulation
  const { data: pendingUpdates = [], isLoading: updatesLoading } = useQuery<RegulationUpdate[]>({
    queryKey: ['/api/regulations', regulation.id, 'pending-updates'],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${regulation.id}/pending-updates`);
      if (!response.ok) throw new Error('Failed to fetch pending updates');
      return response.json();
    }
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const response = await fetch(`/api/regulations/${regulation.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId })
      });
      if (!response.ok) throw new Error('Failed to rollback');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rollback Successful",
        description: "Regulation has been rolled back to the selected version.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/regulations', regulation.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/regulations', regulation.id, 'versions'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Rollback Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create timeline events from versions and updates
  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      date: Date;
      title: string;
      description: string;
      type: 'version' | 'update' | 'milestone';
      icon: React.ReactNode;
      data: RegulationVersion | RegulationUpdate | any;
      status: 'completed' | 'pending' | 'failed';
    }> = [];

    // Add version events
    versions.forEach(version => {
      const sourceIcons = {
        local: <User className="h-4 w-4 text-blue-500" />,
        mcp: <Zap className="h-4 w-4 text-purple-500" />,
        import: <Download className="h-4 w-4 text-green-500" />,
        rollback: <RotateCcw className="h-4 w-4 text-orange-500" />
      };

      events.push({
        id: `version-${version.id}`,
        date: new Date(version.createdAt),
        title: `Version ${version.versionNumber}`,
        description: `${version.source === 'mcp' ? 'MCP Engine Update' : 
                     version.source === 'import' ? 'Imported Update' :
                     version.source === 'rollback' ? 'Rolled Back' : 'Manual Update'}`,
        type: 'version',
        icon: sourceIcons[version.source] || <GitCommit className="h-4 w-4 text-gray-500" />,
        data: version,
        status: 'completed'
      });
    });

    // Add pending update events
    pendingUpdates.forEach(update => {
      events.push({
        id: `update-${update.id}`,
        date: new Date(update.updateDate),
        title: `Pending Update`,
        description: update.name,
        type: 'update',
        icon: <Clock className="h-4 w-4 text-yellow-500" />,
        data: update,
        status: 'pending'
      });
    });

    // Add regulation milestones
    if (regulation.originationDate) {
      events.push({
        id: 'originated',
        date: new Date(regulation.originationDate),
        title: 'Regulation Originated',
        description: 'Initial publication',
        type: 'milestone',
        icon: <FileText className="h-4 w-4 text-blue-500" />,
        data: null,
        status: 'completed'
      });
    }

    if (regulation.effectiveDate) {
      events.push({
        id: 'effective',
        date: new Date(regulation.effectiveDate),
        title: 'Became Effective',
        description: 'Regulation became legally effective',
        type: 'milestone',
        icon: <Shield className="h-4 w-4 text-green-500" />,
        data: null,
        status: 'completed'
      });
    }

    // Sort by date (newest first)
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [versions, pendingUpdates, regulation]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      pending: 'secondary',
      failed: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status}
      </Badge>
    );
  };

  if (versionsLoading || updatesLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Regulation Timeline & Version Control
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {versions.length} versions
            </Badge>
            {pendingUpdates.length > 0 && (
              <Badge variant="secondary">
                {pendingUpdates.length} pending
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <ScrollArea className="h-[600px] w-full">
              <div className="space-y-4">
                {timelineEvents.map((event, index) => (
                  <div key={event.id} className="flex items-start space-x-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-gray-200 shadow-sm">
                        {event.icon}
                      </div>
                      {index < timelineEvents.length - 1 && (
                        <div className="w-px h-16 bg-gray-200 mt-2"></div>
                      )}
                    </div>

                    {/* Event content */}
                    <div className="flex-1 min-w-0 pb-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-gray-900">
                            {event.title}
                          </h3>
                          {getStatusBadge(event.status)}
                        </div>
                        <time className="text-xs text-gray-500">
                          {formatDate(event.date)}
                        </time>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">
                        {event.description}
                      </p>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-2">
                        {event.type === 'version' && event.data && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedVersion(event.data as RegulationVersion)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>
                                    Version {(event.data as RegulationVersion).versionNumber} Details
                                  </DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="h-[60vh]">
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-medium">Content:</h4>
                                      <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                                        <pre className="whitespace-pre-wrap text-sm">
                                          {(event.data as RegulationVersion).content}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>

                            {showRollback && event.data.id !== versions[0]?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Rollback
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Rollback</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to rollback to Version {(event.data as RegulationVersion).versionNumber}? 
                                      This will create a new version with the content from the selected version.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => rollbackMutation.mutate(event.data.id)}
                                      disabled={rollbackMutation.isPending}
                                    >
                                      {rollbackMutation.isPending ? 'Rolling back...' : 'Rollback'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </>
                        )}

                        {event.type === 'update' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/regulations/updates/${event.data.id}`, '_blank')}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                        )}
                      </div>

                      {/* Additional metadata and change summary */}
                      {event.type === 'version' && event.data && (
                        <>
                          {/* Parse version content to show what changed */}
                          {(() => {
                            try {
                              const versionData = JSON.parse(event.data.content);
                              const changes: string[] = [];
                              
                              if (versionData.regulation_text) {
                                const textLength = versionData.regulation_text.length;
                                changes.push(`📄 Regulation text (${textLength.toLocaleString()} chars)`);
                              }
                              
                              if (versionData.summary) {
                                changes.push(`📝 Summary updated`);
                              }
                              
                              if (versionData.requirements) {
                                changes.push(`✅ Requirements updated`);
                              }
                              
                              if (versionData.filing_deadlines) {
                                const deadlineCount = versionData.filing_deadlines.split('\n').filter((d: string) => d.trim()).length;
                                changes.push(`📅 ${deadlineCount} filing deadline${deadlineCount !== 1 ? 's' : ''}`);
                              }
                              
                              return changes.length > 0 ? (
                                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                  <div className="text-xs font-medium text-blue-900 mb-1">Changes in this version:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {changes.map((change, idx) => (
                                      <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                                        {change}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            } catch (e) {
                              return null;
                            }
                          })()}
                          
                          <div className="mt-2 text-xs text-gray-500">
                            {event.data.createdByUser && (
                              <span>
                                by {event.data.createdByUser.firstName} {event.data.createdByUser.lastName} 
                                ({event.data.createdByUser.username})
                              </span>
                            )}
                            {event.data.sourceId && (
                              <span className="ml-2">• Source ID: {event.data.sourceId}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {timelineEvents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No timeline events found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="versions" className="space-y-4">
            <div className="grid gap-4">
              {versions.map((version) => (
                <Card key={version.id} className={version.id === versions[0]?.id ? 'ring-2 ring-blue-500' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <GitCommit className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Version {version.versionNumber}</span>
                          {version.id === versions[0]?.id && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </div>
                        <Badge variant="outline">{version.source}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {formatDate(new Date(version.createdAt))}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedVersion(version)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {version.changesSummary && (
                      <p className="text-sm text-gray-600 mt-2">{version.changesSummary}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Version A</h4>
                <select 
                  className="w-full p-2 border rounded"
                  onChange={(e) => {
                    const version = versions.find(v => v.id === parseInt(e.target.value));
                    setCompareVersions([version || null, compareVersions[1]]);
                  }}
                >
                  <option value="">Select version...</option>
                  {versions.map(version => (
                    <option key={version.id} value={version.id}>
                      Version {version.versionNumber} ({formatDate(new Date(version.createdAt))})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h4 className="font-medium mb-2">Version B</h4>
                <select 
                  className="w-full p-2 border rounded"
                  onChange={(e) => {
                    const version = versions.find(v => v.id === parseInt(e.target.value));
                    setCompareVersions([compareVersions[0], version || null]);
                  }}
                >
                  <option value="">Select version...</option>
                  {versions.map(version => (
                    <option key={version.id} value={version.id}>
                      Version {version.versionNumber} ({formatDate(new Date(version.createdAt))})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {compareVersions[0] && compareVersions[1] && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Version {compareVersions[0].versionNumber} vs Version {compareVersions[1].versionNumber}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium mb-2">Version {compareVersions[0].versionNumber}</h5>
                      <div className="p-4 bg-red-50 rounded-lg max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm">
                          {compareVersions[0].content}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">Version {compareVersions[1].versionNumber}</h5>
                      <div className="p-4 bg-green-50 rounded-lg max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm">
                          {compareVersions[1].content}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
