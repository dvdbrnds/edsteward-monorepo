import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { diffWords } from 'diff';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckIcon, XIcon, ClockIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface RegulationUpdate {
  id: number;
  regulationId: number;
  name: string;
  originalContent: string;
  updatedContent: string;
  status: string;
  updateDate: string;
}

interface RegulationDetail {
  id: number;
  name: string;
  jurisdiction: string;
  agency_name?: string;
  agency_department?: string;
  lastUpdated?: string;
}

interface DiffData {
  addedChars: number;
  removedChars: number;
  changedChars: number;
  originalLength: number;
  updatedLength: number;
  addedPercentage: number;
  removedPercentage: number;
  changedPercentage: number;
  differences: any[];
}

const DifferentialViewPage = () => {
  const [, params] = useRoute('/regulations/updates/:id');
  const updateId = params?.id ? parseInt(params.id, 10) : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDeferDialogOpen, setIsDeferDialogOpen] = useState(false);
  const [signature, setSignature] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Determine if we should open a specific dialog based on URL params
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const action = queryParams.get('action');
    
    if (action === 'approve') {
      setIsApproveDialogOpen(true);
    } else if (action === 'reject') {
      setIsRejectDialogOpen(true);
    } else if (action === 'defer') {
      setIsDeferDialogOpen(true);
    }
    
    // Clean up the URL after processing the action
    if (action) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);
  
  // Fetch the regulation update details
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/regulation-updates', updateId],
    queryFn: async () => {
      if (!updateId) throw new Error('No update ID provided');
      
      const response = await fetch(`/api/regulation-updates/${updateId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch regulation update');
      }
      
      const data = await response.json();
      return {
        update: data.update as RegulationUpdate,
        original: data.original as RegulationDetail,
        diffData: data.diffData as DiffData
      };
    },
    enabled: !!updateId
  });
  
  // Approve action
  const handleApprove = async () => {
    if (!signature.trim()) {
      toast({
        title: 'Signature Required',
        description: 'Please provide your signature to approve this update.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/regulation-updates/${updateId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ signature })
      });
      
      if (!response.ok) {
        throw new Error('Failed to approve update');
      }
      
      toast({
        title: 'Update Approved',
        description: 'The regulation update has been successfully approved.',
      });
      
      setIsApproveDialogOpen(false);
      setSignature('');
      
      // Redirect back to the updates list
      setTimeout(() => {
        setLocation('/regulations/updates');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };
  
  // Reject action
  const handleReject = async () => {
    if (!signature.trim()) {
      toast({
        title: 'Signature Required',
        description: 'Please provide your signature to reject this update.',
        variant: 'destructive'
      });
      return;
    }
    
    if (!rejectionReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for rejecting this update.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/regulation-updates/${updateId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          signature,
          reason: rejectionReason
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reject update');
      }
      
      toast({
        title: 'Update Rejected',
        description: 'The regulation update has been rejected.',
      });
      
      setIsRejectDialogOpen(false);
      setSignature('');
      setRejectionReason('');
      
      // Redirect back to the updates list
      setTimeout(() => {
        setLocation('/regulations/updates');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };
  
  // Defer action
  const handleDefer = async () => {
    if (!signature.trim()) {
      toast({
        title: 'Signature Required',
        description: 'Please provide your signature to defer this update.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/regulation-updates/${updateId}/defer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ signature })
      });
      
      if (!response.ok) {
        throw new Error('Failed to defer update');
      }
      
      toast({
        title: 'Update Deferred',
        description: 'The regulation update has been deferred for later review.',
      });
      
      setIsDeferDialogOpen(false);
      setSignature('');
      
      // Redirect back to the updates list
      setTimeout(() => {
        setLocation('/regulations/updates');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Deferral Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };
  
  // Handle loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Skeleton className="h-8 w-60" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
          <CardFooter>
            <div className="flex justify-end w-full gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Handle error state
  if (error || !data) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">Regulation Update Details</h1>
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Update</CardTitle>
            <CardDescription>
              We encountered an issue loading this regulation update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setLocation('/regulations/updates')}>
              Return to Updates List
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  const { update, original, diffData } = data;
  
  return (
    <div className="container mx-auto py-6">
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
            {original ? (
              <>
                {original.jurisdiction} - {original.agency_name || 'Unknown Agency'}
                {original.lastUpdated && (
                  <> · Last updated {formatDistanceToNow(new Date(original.lastUpdated), { addSuffix: true })}</>
                )}
              </>
            ) : (
              'Regulation Details Unavailable'
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {diffData && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Content Added</h3>
                <p className="text-xl font-bold text-green-600">+{diffData.addedPercentage}%</p>
                <p className="text-xs text-muted-foreground">{diffData.addedChars} characters</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Content Removed</h3>
                <p className="text-xl font-bold text-red-600">-{diffData.removedPercentage}%</p>
                <p className="text-xs text-muted-foreground">{diffData.removedChars} characters</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Total Changes</h3>
                <p className="text-xl font-bold">{diffData.changedPercentage}%</p>
                <p className="text-xs text-muted-foreground">of original content</p>
              </div>
            </div>
          )}
          
          <Tabs defaultValue="diff" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="diff">Differential View</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="updated">Updated</TabsTrigger>
            </TabsList>
            
            <TabsContent value="diff" className="border rounded-md p-4 min-h-[400px] overflow-auto">
              {diffData ? (
                <>
                  {diffData.differences.map((part, index) => (
                    <span 
                      key={index}
                      className={
                        part.added 
                          ? 'bg-green-100 text-green-800' 
                          : part.removed 
                            ? 'bg-red-100 text-red-800 line-through' 
                            : ''
                      }
                    >
                      {part.value}
                    </span>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground">Differential view is not available.</p>
              )}
            </TabsContent>
            
            <TabsContent value="original" className="border rounded-md p-4 min-h-[400px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm">{update.originalContent}</pre>
            </TabsContent>
            
            <TabsContent value="updated" className="border rounded-md p-4 min-h-[400px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm">{update.updatedContent}</pre>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={() => setLocation('/regulations/updates')}>
            Back to Updates
          </Button>
          <Button 
            variant="success" 
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setIsApproveDialogOpen(true)}
          >
            <CheckIcon className="mr-2 h-4 w-4" />
            Approve
          </Button>
          <Button 
            variant="destructive"
            onClick={() => setIsRejectDialogOpen(true)}
          >
            <XIcon className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button 
            variant="secondary"
            onClick={() => setIsDeferDialogOpen(true)}
          >
            <ClockIcon className="mr-2 h-4 w-4" />
            Defer
          </Button>
        </CardFooter>
      </Card>
      
      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Regulation Update</DialogTitle>
            <DialogDescription>
              You are about to approve this regulation update. This action will update the official regulation content.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="signature" className="mb-2 block">
              Confirm with Digital Signature <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="signature" 
              value={signature} 
              onChange={(e) => setSignature(e.target.value)} 
              placeholder="Type your full name" 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="success" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
            >
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Regulation Update</DialogTitle>
            <DialogDescription>
              You are about to reject this regulation update. Please provide a reason for the rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="rejection-reason" className="mb-2 block">
                Reason for Rejection <span className="text-red-500">*</span>
              </Label>
              <Textarea 
                id="rejection-reason" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="Explain why this update is being rejected..." 
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="signature-reject" className="mb-2 block">
                Confirm with Digital Signature <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="signature-reject" 
                value={signature} 
                onChange={(e) => setSignature(e.target.value)} 
                placeholder="Type your full name" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Defer Dialog */}
      <Dialog open={isDeferDialogOpen} onOpenChange={setIsDeferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Defer Regulation Update</DialogTitle>
            <DialogDescription>
              You are about to defer this regulation update for later review. The update will remain in the pending queue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="signature-defer" className="mb-2 block">
              Confirm with Digital Signature <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="signature-defer" 
              value={signature} 
              onChange={(e) => setSignature(e.target.value)} 
              placeholder="Type your full name" 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeferDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="secondary"
              onClick={handleDefer}
            >
              Confirm Deferral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DifferentialViewPage;