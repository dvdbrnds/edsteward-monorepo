import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { diffWords } from 'diff';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckIcon, XIcon, ClockIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// interface RegulationUpdate {
//   id: number;
//   regulationId: number;
//   name: string;
//   originalContent: string;
//   updatedContent: string;
//   status: string;
//   updateDate: string;
// }

// interface RegulationDetail {
//   id: number;
//   name: string;
//   jurisdiction: string;
//   agency_name?: string;
//   agency_department?: string;
//   lastUpdated?: string;
// }

// interface DiffData {
//   addedChars: number;
//   removedChars: number;
//   changedChars: number;
//   originalLength: number;
//   updatedLength: number;
//   addedPercentage: number;
//   removedPercentage: number;
//   changedPercentage: number;
//   differences: any[];
// }

const DifferentialViewPage: React.FC = () => {
  const [match, params] = useRoute<{ id: string }>('/regulations/updates/:id');
  const [, setLocation] = useLocation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'defer' | null>(null);
  const [reason, setReason] = useState('');
  
  // Parse query parameters to see if we should show a dialog
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const actionParam = queryParams.get('action');
    
    if (actionParam === 'approve') {
      setAction('approve');
      setShowConfirmDialog(true);
    } else if (actionParam === 'reject') {
      setAction('reject');
      setShowConfirmDialog(true);
    } else if (actionParam === 'defer') {
      setAction('defer');
      setShowConfirmDialog(true);
    }
    
    // Clean up the URL
    if (actionParam) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);
  
  const updateId = match ? parseInt(params.id) : null;
  
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/regulation-updates/${updateId}`],
    queryFn: async () => {
      try {
        if (!updateId) throw new Error('No update ID provided');
        
        const response = await fetch(`/api/regulation-updates/${updateId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch regulation update: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Calculate diff data if not provided by the API
        if (!data.diffData) {
          const differences = diffWords(data.original.content, data.update.content);
          
          let addedChars = 0;
          let removedChars = 0;
          
          differences.forEach(part => {
            if (part.added) {
              addedChars += part.value.length;
            } else if (part.removed) {
              removedChars += part.value.length;
            } else {
              // unchanged
            }
          });
          
          const originalLength = data.original.content.length;
          const updatedLength = data.update.content.length;
          
          data.diffData = {
            addedChars,
            removedChars,
            changedChars: Math.abs(updatedLength - originalLength),
            originalLength,
            updatedLength,
            addedPercentage: Math.round((addedChars / originalLength) * 100),
            removedPercentage: Math.round((removedChars / originalLength) * 100),
            changedPercentage: Math.round(
              ((addedChars + removedChars) / originalLength) * 100
            ),
            differences
          };
        }
        
        return data;
      } catch (err) {
        console.error('Error fetching regulation update:', err);
        throw err;
      }
    },
    enabled: !!updateId
  });
  
  const handleApproveUpdate = async () => {
    try {
      setShowConfirmDialog(false);
      
      // API call to approve the update (signature is auto-generated on backend)
      const response = await fetch(`/api/regulation-updates/${updateId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Approval failed:', response.status, errorData);
        throw new Error(`Failed to approve update: ${response.status} ${errorData.error || response.statusText}`);
      }
      
      console.log('✅ Update approved successfully');
      
      // Redirect to success page or list
      setLocation('/regulations/updates');
      
    } catch (err) {
      console.error('Error approving update:', err);
      alert(`Error approving update: ${err.message}`);
    }
  };
  
  const handleRejectUpdate = async () => {
    try {
      setShowConfirmDialog(false);
      
      // API call to reject the update (signature is auto-generated on backend)
      const response = await fetch(`/api/regulation-updates/${updateId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          reason
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Rejection failed:', response.status, errorData);
        throw new Error(`Failed to reject update: ${response.status} ${errorData.error || response.statusText}`);
      }
      
      console.log('✅ Update rejected successfully');
      
      // Redirect to list
      setLocation('/regulations/updates');
      
    } catch (err) {
      console.error('Error rejecting update:', err);
      alert(`Error rejecting update: ${err.message}`);
    }
  };
  
  const handleDeferUpdate = async () => {
    try {
      setShowConfirmDialog(false);
      
      // API call to defer the update (signature is auto-generated on backend)
      const response = await fetch(`/api/regulation-updates/${updateId}/defer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          reason
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to defer update');
      }
      
      // Redirect to list
      setLocation('/regulations/updates');
      
    } catch (err) {
      console.error('Error deferring update:', err);
      // Show error notification
    }
  };
  
  const handleConfirmAction = () => {
    setShowConfirmDialog(false);
    
    if (action === 'approve') {
      handleApproveUpdate();
    } else if (action === 'reject' || action === 'defer') {
      // Show reason dialog for reject and defer actions
      setShowReasonDialog(true);
    }
  };
  
  const handleReasonSubmit = () => {
    setShowReasonDialog(false);
    
    if (action === 'reject') {
      handleRejectUpdate();
    } else if (action === 'defer') {
      handleDeferUpdate();
    }
  };
  
  const renderDiffContent = () => {
    if (!data || !data.diffData) return null;
    
    return data.diffData.differences.map((part, index) => {
      if (part.added) {
        return <span key={index} className="bg-green-100 text-green-800">{part.value}</span>;
      }
      if (part.removed) {
        return <span key={index} className="bg-red-100 text-red-800 line-through">{part.value}</span>;
      }
      return <span key={index}>{part.value}</span>;
    });
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-24" />
            </div>
            
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
            
            <Tabs defaultValue="diff" className="mb-6">
              <TabsList>
                <Skeleton className="h-10 w-20 mr-2" />
                <Skeleton className="h-10 w-20 mr-2" />
                <Skeleton className="h-10 w-20" />
              </TabsList>
              <Skeleton className="h-64 w-full mt-4" />
            </Tabs>
            
            <div className="flex justify-end space-x-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-red-300">
              <CardHeader>
                <CardTitle className="text-red-600">Error Loading Update</CardTitle>
                <CardDescription>
                  We encountered an issue loading the regulation update.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Please try again later or contact support if the issue persists.</p>
              </CardContent>
              <CardFooter>
                <Button onClick={() => setLocation('/regulations/updates')}>
                  Return to Updates List
                </Button>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  
  const { update, original, diffData } = data;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Regulation Update Review</h1>
            {diffData && (
              <Badge
                variant={
                  diffData.changedPercentage > 50 
                    ? 'destructive' 
                    : diffData.changedPercentage > 25 
                      ? 'warning' 
                      : 'secondary'
                }
                className="text-sm"
              >
                {diffData.changedPercentage}% Changed
              </Badge>
            )}
          </div>
      
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{update.name}</CardTitle>
              <CardDescription>
                Last updated: {new Date(update.updateDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Content Added:</p>
                  <p className="font-medium text-green-600">+{diffData.addedPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Content Removed:</p>
                  <p className="font-medium text-red-600">-{diffData.removedPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status:</p>
                  <p className="font-medium">{update.status.charAt(0).toUpperCase() + update.status.slice(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="diff" className="mb-6">
            <TabsList>
              <TabsTrigger value="diff">Differential View</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="updated">Updated</TabsTrigger>
            </TabsList>
            <TabsContent value="diff" className="p-4 border rounded-md min-h-[400px] whitespace-pre-wrap">
              {renderDiffContent()}
            </TabsContent>
            <TabsContent value="original" className="p-4 border rounded-md min-h-[400px] whitespace-pre-wrap">
              {original.content}
            </TabsContent>
            <TabsContent value="updated" className="p-4 border rounded-md min-h-[400px] whitespace-pre-wrap">
              {update.content}
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/regulations/updates')}
            >
              Back to List
            </Button>
            <Button 
              variant="secondary"
              onClick={() => {
                setAction('defer');
                setShowConfirmDialog(true);
              }}
            >
              <ClockIcon className="mr-2 h-4 w-4" />
              Defer
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                setAction('reject');
                setShowConfirmDialog(true);
              }}
            >
              <XIcon className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button 
              variant="success"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setAction('approve');
                setShowConfirmDialog(true);
              }}
            >
              <CheckIcon className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      </main>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Defer'} Regulation Update
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'approve' 
                ? 'Are you sure you want to approve this regulation update? This will mark it as accepted and apply the changes.' 
                : action === 'reject'
                  ? 'Are you sure you want to reject this regulation update? This will mark it as rejected.'
                  : 'Are you sure you want to defer this regulation update? This will mark it for later review.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Reason Dialog for Reject/Defer */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {action === 'reject' ? 'Reject' : 'Defer'} Regulation Update
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this action. Your signature will be automatically generated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  action === 'reject'
                    ? 'Reason for rejection...'
                    : 'Reason for deferral...'
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReasonSubmit}
              disabled={action === 'reject' && !reason.trim()}
            >
              {action === 'reject' ? 'Reject' : 'Defer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DifferentialViewPage;