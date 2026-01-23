import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText, Eye, Calendar, Clock, RefreshCw, Trash2, PlayCircle, Zap, CheckCircle } from 'lucide-react';
import Navigation from "@/components/layout/navigation";

// Type definition for regulation updates with rich fields
interface RegulationUpdate {
  id: number;
  regulationId: number;
  name: string;
  originalContent: string;
  updatedContent: string;
  summary?: string | null;
  requirements?: string | null;
  filingDeadlines?: string | null;
  status: string;
  updateDate: string;
  metadata?: any;
  changeStats?: {
    addedPercentage: number;
    removedPercentage: number;
    changedPercentage: number;
  };
}

const UpdatesListPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  
  const { data: pendingUpdates = [], isLoading, error, refetch, dataUpdatedAt } = useQuery<RegulationUpdate[]>({
    queryKey: ['/api/regulation-updates/pending'],
    queryFn: async () => {
      const timestamp = new Date().toLocaleTimeString();
      
      const response = await fetch('/api/regulation-updates/pending', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      console.log(`📊 [${timestamp}] API response (${jsonData.length} items):`, jsonData);
      
      return Array.isArray(jsonData) ? jsonData : [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds (reduced from 3 seconds)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    staleTime: 10000, // Consider data stale after 10 seconds
    cacheTime: 60000, // Cache data for 1 minute
  });

  

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/regulation-updates/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete updates');
      }
      
      return response.json();
    },
    onSuccess: (_data) => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates/pending'] });
    },
    onError: (error) => {
      console.error('❌ Bulk delete failed:', error);
      alert(`Failed to delete updates: ${error.message}`);
    },
  });

  // Bulk accept mutation
  const bulkAcceptMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = [];
      for (const id of ids) {
        try {
          const response = await fetch(`/api/regulation-updates/${id}/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({}), // Auto-signature is generated server-side
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to accept update ${id}`);
          }
          
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      
      
      if (successCount > 0) {
        alert(`Successfully accepted ${successCount} regulation update${successCount > 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : '.'}`);
      }
      
      if (failCount > 0 && successCount === 0) {
        alert(`Failed to accept ${failCount} regulation update${failCount > 1 ? 's' : ''}.`);
      }
      
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates/pending'] });
    },
    onError: (error) => {
      console.error('❌ Bulk accept failed:', error);
      alert(`Failed to accept updates: ${error.message}`);
    },
  });

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendingUpdates.map(update => update.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectUpdate = (updateId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, updateId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== updateId));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedIds.length} regulation update${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleBulkAccept = () => {
    if (selectedIds.length === 0) return;
    
    const confirmMessage = `Are you sure you want to accept ${selectedIds.length} regulation update${selectedIds.length > 1 ? 's' : ''}? This will apply all changes to the regulations.`;
    
    if (window.confirm(confirmMessage)) {
      bulkAcceptMutation.mutate(selectedIds);
    }
  };

  const isAllSelected = pendingUpdates.length > 0 && selectedIds.length === pendingUpdates.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < pendingUpdates.length;

  if (isLoading) {
    
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading regulation updates...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Updates</h1>
            <p className="text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Regulation Updates</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingUpdates.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const confirmMessage = `Accept all ${pendingUpdates.length} pending regulation updates? This will apply all changes immediately.`;
                  if (window.confirm(confirmMessage)) {
                    const allIds = pendingUpdates.map(update => update.id);
                    bulkAcceptMutation.mutate(allIds);
                  }
                }}
                disabled={bulkAcceptMutation.isPending}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
              >
                {bulkAcceptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Accept All Updates
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Badge variant="secondary" className="text-sm">
              {pendingUpdates.length} pending updates
            </Badge>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {pendingUpdates.length > 0 && (
          <div className="bg-card rounded-lg border p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = isSomeSelected;
                      }
                    }}
                  />
                  <span className="text-sm font-medium">
                    {selectedIds.length === 0 
                      ? 'Select all' 
                      : `${selectedIds.length} selected`
                    }
                  </span>
                </div>
                {selectedIds.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Testing Mode
                  </Badge>
                )}
              </div>
              
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBulkAccept}
                    disabled={bulkAcceptMutation.isPending}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                  >
                    {bulkAcceptMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Accept All ({selectedIds.length})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    className="flex items-center gap-1"
                  >
                    {bulkDeleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete Selected ({selectedIds.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {pendingUpdates.length === 0 ? (
          <div className="space-y-8">
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <FileText className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No pending updates</h3>
              <p className="text-muted-foreground">
                All regulation updates have been reviewed and processed.
              </p>
            </div>

            {/* Demo Section */}
            <div className="border-t pt-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  <Zap className="h-5 w-5 inline mr-2 text-blue-500" />
                  Differential View Demo
                </h2>
                <p className="text-muted-foreground">
                  Experience the powerful regulation change tracking and review system
                </p>
              </div>

              <Card className="max-w-2xl mx-auto border-blue-200 bg-blue-50/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="pt-1">
                      <PlayCircle className="h-6 w-6 text-blue-500" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          Title IX Educational Amendments - 2024 Update
                        </h3>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          Demo
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date().toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date().toLocaleTimeString()}
                        </span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                          15% Changed
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="font-semibold text-green-700">+8%</div>
                          <div className="text-green-600">Added</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="font-semibold text-red-700">-3%</div>
                          <div className="text-red-600">Removed</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="font-semibold text-blue-700">4</div>
                          <div className="text-blue-600">Sections</div>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">
                        <strong>Summary:</strong> Updated compliance requirements for educational institutions, 
                        including new reporting procedures and enhanced protection measures for students and staff.
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => window.open('/regulations/updates/demo', '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Demo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center mt-6">
                <p className="text-sm text-muted-foreground">
                  This demo showcases the differential view feature with sample regulation changes.
                  <br />
                  In production, this section will display real pending regulation updates.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUpdates.map((update) => (
              <Card key={update.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.includes(update.id)}
                        onCheckedChange={(checked) => handleSelectUpdate(update.id, checked as boolean)}
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {update.name}
                        </h3>
                        <Badge variant="outline">
                          {update.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(update.updateDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(update.updateDate).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {/* Quality Indicators */}
                      <div className="flex flex-wrap gap-2">
                        {/* Content Badge */}
                        <Badge 
                          variant={update.updatedContent && update.updatedContent.length >= 100 ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {update.updatedContent && update.updatedContent.length >= 100 ? '✅' : '❌'} Content
                          {update.updatedContent && ` (${update.updatedContent.length} chars)`}
                        </Badge>
                        
                        {/* Summary Badge */}
                        <Badge 
                          variant={update.summary ? "default" : "outline"}
                          className="text-xs"
                        >
                          {update.summary ? '✅' : '❌'} Summary
                          {update.summary && ` (${update.summary.length} chars)`}
                        </Badge>
                        
                        {/* Requirements Badge */}
                        <Badge 
                          variant={update.requirements ? "default" : "outline"}
                          className="text-xs"
                        >
                          {update.requirements ? '✅' : '❌'} Requirements
                        </Badge>
                        
                        {/* Deadlines Badge */}
                        <Badge 
                          variant={update.filingDeadlines ? "default" : "outline"}
                          className="text-xs"
                        >
                          {update.filingDeadlines ? '✅' : '❌'} Deadlines
                          {update.filingDeadlines && 
                            (() => {
                              try {
                                const parsed = typeof update.filingDeadlines === 'string' 
                                  ? JSON.parse(update.filingDeadlines) 
                                  : update.filingDeadlines;
                                return ` (${parsed.length})`;
                              } catch {
                                return '';
                              }
                            })()
                          }
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/regulations/updates/${update.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Changes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatesListPage;