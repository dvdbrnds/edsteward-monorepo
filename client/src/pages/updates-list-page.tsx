import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, Eye, Calendar, Clock } from 'lucide-react';

const UpdatesListPage: React.FC = () => {
  console.log('🚀 UpdatesListPage component is rendering!');
  console.log('🚀 UpdatesListPage: Current URL:', window.location.pathname);
  
  const { data: pendingUpdates = [], isLoading, error } = useQuery({
    queryKey: ['/api/regulation-updates/pending'],
    queryFn: async () => {
      console.log('🔍 Fetching regulation updates from API...');
      const response = await fetch('/api/regulation-updates/pending');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      console.log('📊 API response:', jsonData);
      return Array.isArray(jsonData) ? jsonData : [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  console.log('📋 Current state:', { pendingUpdates, isLoading, error });

  if (isLoading) {
    console.log('⏳ Rendering loading state');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading regulation updates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('❌ Rendering error state:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Updates</h1>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  console.log('📋 Rendering updates list with', pendingUpdates.length, 'items');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Regulation Updates</h1>
        <Badge variant="secondary" className="text-sm">
          {pendingUpdates.length} pending updates
        </Badge>
      </div>

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
                <div className="flex items-start justify-between">
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
                  
                  <div className="flex items-center gap-2 ml-4">
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
  );
};

export default UpdatesListPage;