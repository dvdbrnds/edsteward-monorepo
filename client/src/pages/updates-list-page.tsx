import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText, Eye, Calendar, Clock, RefreshCw, Trash2 } from 'lucide-react';
import Navigation from "@/components/layout/navigation";

const UpdatesListPage: React.FC = () => {
  console.log('🚀 UpdatesListPage component is rendering!');
  console.log('🚀 UpdatesListPage: Current URL:', window.location.pathname);
  
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  
  const { data: pendingUpdates = [], isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['/api/regulation-updates/pending'],
    queryFn: async () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🔍 [${timestamp}] Fetching regulation updates from API...`);
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
    refetchInterval: 3000, // Refetch every 3 seconds for more aggressive testing
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    staleTime: 0, // Consider data stale immediately
    cacheTime: 0, // Don't cache data
  });

  console.log('📋 Current state:', { pendingUpdates, isLoading, error });

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
    onSuccess: (data) => {
      console.log(`✅ Successfully deleted ${data.deletedCount} updates`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates/pending'] });
    },
    onError: (error) => {
      console.error('❌ Bulk delete failed:', error);
      alert(`Failed to delete updates: ${error.message}`);
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

  const isAllSelected = pendingUpdates.length > 0 && selectedIds.length === pendingUpdates.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < pendingUpdates.length;

  if (isLoading) {
    console.log('⏳ Rendering loading state');
    return (
      <div className="min-h-screen bg-gray-50">
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
    console.log('❌ Rendering error state:', error);
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Updates</h1>
            <p className="text-gray-600">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  console.log('📋 Rendering updates list with', pendingUpdates.length, 'items');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Regulation Updates</h1>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="bg-white rounded-lg border p-4 mb-6">
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
              )}
            </div>
          </div>
        )}

        {pendingUpdates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FileText className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending updates</h3>
            <p className="text-gray-500">
              All regulation updates have been reviewed and processed.
            </p>
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
                        <h3 className="text-lg font-semibold text-gray-900">
                          {update.name}
                        </h3>
                        <Badge variant="outline">
                          {update.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(update.updateDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(update.updateDate).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/regulations/updates/${update.id}`, '_blank')}
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