import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import Navigation from "@/components/layout/navigation";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EyeIcon, CheckIcon, XIcon, ClockIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RegulationUpdate {
  id: number;
  regulationId: number;
  name: string;
  status: string;
  updateDate: string;
  changeStats?: {
    addedPercentage: number;
    removedPercentage: number;
    changedPercentage: number;
  };
}

const UpdatesListPage: React.FC = () => {
  const [pendingUpdates, setPendingUpdates] = useState<RegulationUpdate[]>([]);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/regulation-updates/pending'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/regulation-updates/pending');
        if (!response.ok) {
          throw new Error('Failed to fetch regulation updates');
        }
        const jsonData = await response.json();
        return Array.isArray(jsonData) ? jsonData : [];
      } catch (err) {
        console.error('Error fetching regulation updates:', err);
        // Return empty array instead of throwing to prevent app crashes
        return [];
      }
    },
    // Add retry logic to make the feature more robust
    retry: 1,
    retryDelay: 1000,
    // Default to empty array to prevent undefined errors
    initialData: []
  });
  
  useEffect(() => {
    if (data) {
      setPendingUpdates(data);
    }
  }, [data]);
  
  // Function to determine badge color based on percentage changes
  const getChangeSeverity = (percentage: number) => {
    if (percentage > 50) return 'destructive';
    if (percentage > 25) return 'warning';
    return 'secondary';
  };
  
  // For now, let's provide a fallback if we can't connect to the API endpoint
  const handleFallbackClick = () => {
    // Direct to our test page as a temporary solution
    window.location.href = '/regulations/diff-test';
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold mb-6">Pending Regulation Updates</h1>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="mb-4">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-24 mr-2" />
                  <Skeleton className="h-10 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold mb-6">Pending Regulation Updates</h1>
      
          {error && (
            <Card className="mb-6 border-red-300">
              <CardHeader>
                <CardTitle className="text-red-600">Error Loading Updates</CardTitle>
                <CardDescription>
                  We encountered an issue loading the updates. You can still use our file comparison tool.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={handleFallbackClick}>
                  Use File Comparison Tool
                </Button>
              </CardFooter>
            </Card>
          )}
          
          {!error && pendingUpdates.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No Pending Updates</CardTitle>
                <CardDescription>
                  There are currently no regulation updates requiring review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Updates will appear here when regulatory changes are detected and require your review.</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={handleFallbackClick}>
                  Try File Comparison Tool
                </Button>
              </CardFooter>
            </Card>
          )}
          
          {pendingUpdates.map((update) => (
            <Card key={update.id} className="mb-4">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{update.name}</CardTitle>
                    <CardDescription>
                      Updated {update.updateDate ? formatDistanceToNow(new Date(update.updateDate), { addSuffix: true }) : 'recently'}
                    </CardDescription>
                  </div>
                  {update.changeStats && (
                    <Badge variant={getChangeSeverity(update.changeStats.changedPercentage)}>
                      {update.changeStats.changedPercentage}% Changed
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {update.changeStats && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Content Added:</p>
                        <p className="font-medium text-green-600">+{update.changeStats.addedPercentage}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Content Removed:</p>
                        <p className="font-medium text-red-600">-{update.changeStats.removedPercentage}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status:</p>
                        <p className="font-medium">{update.status.charAt(0).toUpperCase() + update.status.slice(1)}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Link href={`/regulations/updates/${update.id}`}>
                  <Button variant="outline">
                    <EyeIcon className="mr-2 h-4 w-4" />
                    View Changes
                  </Button>
                </Link>
                <div className="flex gap-2">
                  <Link href={`/regulations/updates/${update.id}?action=approve`}>
                    <Button variant="success" className="bg-green-600 hover:bg-green-700 text-white">
                      <CheckIcon className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </Link>
                  <Link href={`/regulations/updates/${update.id}?action=reject`}>
                    <Button variant="destructive">
                      <XIcon className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </Link>
                  <Link href={`/regulations/updates/${update.id}?action=defer`}>
                    <Button variant="secondary">
                      <ClockIcon className="mr-2 h-4 w-4" />
                      Defer
                    </Button>
                  </Link>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default UpdatesListPage;