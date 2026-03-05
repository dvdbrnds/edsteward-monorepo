import { FC, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, XCircle, Clock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiQuery } from '@/lib/queryClient';

interface DifferentialViewProps {
  updateId: number;
}

type Difference = {
  added?: boolean;
  removed?: boolean;
  value: string;
};

type DiffData = {
  differences: Difference[];
  addedPercentage: number;
  removedPercentage: number;
  changedPercentage: number;
  addedChars: number;
  removedChars: number;
  originalLength: number;
  updatedLength: number;
};

type RegulationUpdate = {
  id: number;
  regulationId: number;
  updatedContent: string;
  submittedAt: string;
  submittedBy: number;
  status: 'pending' | 'accepted' | 'rejected' | 'deferred';
  processedAt: string | null;
  userId: number | null;
  signature: string | null;
  rejectionReason: string | null;
};

type Regulation = {
  id: number;
  name: string;
  jurisdiction: string;
  category: string;
  requirements: string | null;
};

export const DifferentialView: FC<DifferentialViewProps> = ({ updateId }) => {
  const [viewMode, setViewMode] = useState<'diff' | 'side-by-side' | 'statistics'>('diff');
  const [selectedTab, setSelectedTab] = useState<'before' | 'after' | 'diff'>('diff');
  const [signature, setSignature] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch regulation update data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/regulation-updates', updateId],
    queryFn: () => apiQuery(`/api/regulation-updates/${updateId}`),
  });

  // Accept update mutation
  const acceptMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', `/api/regulation-updates/${updateId}/accept`, { signature }),
    onSuccess: () => {
      toast({
        title: 'Update accepted',
        description: 'The regulation has been updated successfully.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates'] });
      setLocation('/regulation-updates');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to accept update: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Reject update mutation
  const rejectMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', `/api/regulation-updates/${updateId}/reject`, { 
        signature, 
        reason: rejectionReason 
      }),
    onSuccess: () => {
      toast({
        title: 'Update rejected',
        description: 'The regulation update has been rejected.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates'] });
      setLocation('/regulation-updates');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to reject update: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Defer update mutation
  const deferMutation = useMutation({
    mutationFn: () => 
      apiRequest('POST', `/api/regulation-updates/${updateId}/defer`, { signature }),
    onSuccess: () => {
      toast({
        title: 'Update deferred',
        description: 'The regulation update has been deferred for later review.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/regulation-updates'] });
      setLocation('/regulation-updates');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to defer update: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center p-6 border rounded-lg bg-red-50 text-red-700">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <h3 className="text-lg font-medium">Error loading regulation update</h3>
        <p>{error?.message || 'Failed to load regulation update details'}</p>
      </div>
    );
  }

  const { update, original, diffData } = data;

  // Render differences with proper HTML formatting
  const renderDiff = (differences: Difference[]) => {
    return differences.map((part, i) => {
      const className = part.added
        ? 'bg-green-100 text-green-900 px-1 rounded-sm'
        : part.removed
        ? 'bg-red-100 text-red-900 px-1 rounded-sm line-through'
        : '';
      
      return (
        <span key={i} className={className}>
          {part.value}
        </span>
      );
    });
  };

  // Render side-by-side view
  const renderSideBySide = () => {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-md p-4 bg-background">
          <h3 className="font-medium mb-2">Original Version</h3>
          <div className="whitespace-pre-wrap">{original.requirements}</div>
        </div>
        <div className="border rounded-md p-4 bg-background">
          <h3 className="font-medium mb-2">Updated Version</h3>
          <div className="whitespace-pre-wrap">{update.updatedContent}</div>
        </div>
      </div>
    );
  };

  const renderStatistics = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="border rounded-md p-4 text-center">
          <h3 className="font-medium mb-2">Added Content</h3>
          <div className="text-3xl font-bold text-green-600">{diffData.addedPercentage}%</div>
          <div className="text-sm text-muted-foreground">{diffData.addedChars} characters</div>
        </div>
        <div className="border rounded-md p-4 text-center">
          <h3 className="font-medium mb-2">Removed Content</h3>
          <div className="text-3xl font-bold text-red-600">{diffData.removedPercentage}%</div>
          <div className="text-sm text-muted-foreground">{diffData.removedChars} characters</div>
        </div>
        <div className="border rounded-md p-4 text-center">
          <h3 className="font-medium mb-2">Total Changes</h3>
          <div className="text-3xl font-bold text-blue-600">{diffData.changedPercentage}%</div>
          <div className="text-sm text-muted-foreground">
            {original.requirements?.length || 0} → {update.updatedContent.length} chars
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div>Regulation Update: {original.name}</div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className={cn(viewMode === 'diff' && 'bg-primary text-primary-foreground')}
              onClick={() => setViewMode('diff')}
            >
              Diff View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(viewMode === 'side-by-side' && 'bg-primary text-primary-foreground')}
              onClick={() => setViewMode('side-by-side')}
            >
              Side by Side
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(viewMode === 'statistics' && 'bg-primary text-primary-foreground')}
              onClick={() => setViewMode('statistics')}
            >
              Statistics
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Compare changes between original and updated regulation content
        </CardDescription>
        
        {renderStatistics()}
      </CardHeader>
      
      <CardContent>
        {viewMode === 'diff' && (
          <div className="border rounded-md p-4 bg-background whitespace-pre-wrap">
            {renderDiff(diffData.differences)}
          </div>
        )}
        
        {viewMode === 'side-by-side' && renderSideBySide()}
        
        {viewMode === 'statistics' && (
          <div className="flex flex-col space-y-6">
            <div>
              <h3 className="font-medium mb-4">Change Summary</h3>
              <p>
                This update changes approximately{' '}
                <span className="font-semibold">{diffData.changedPercentage}%</span> of the original content.
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  <span className="text-green-600 font-medium">{diffData.addedPercentage}%</span> of content was added
                  ({diffData.addedChars} characters)
                </li>
                <li>
                  <span className="text-red-600 font-medium">{diffData.removedPercentage}%</span> of content was removed
                  ({diffData.removedChars} characters)
                </li>
              </ul>
              
              <div className="mt-6">
                <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${diffData.addedPercentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-center mt-1">Added Content</div>
                
                <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${diffData.removedPercentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-center mt-1">Removed Content</div>
                
                <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${diffData.changedPercentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-center mt-1">Total Changes</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Document Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Original document length:</p>
                  <p className="font-medium">{diffData.originalLength} characters</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Updated document length:</p>
                  <p className="font-medium">{diffData.updatedLength} characters</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net change:</p>
                  <p className="font-medium">
                    {diffData.updatedLength - diffData.originalLength > 0 ? '+' : ''}
                    {diffData.updatedLength - diffData.originalLength} characters
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <Separator className="my-6" />
        
        <div className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            <p>Submitted by: User ID {update.submittedBy}</p>
            <p>Submitted on: {new Date(update.submittedAt).toLocaleString()}</p>
          </div>
          
          <div className="flex space-x-3">
            {/* Accept Dialog */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 border-green-200">
                  <Check className="w-4 h-4 mr-2" /> Accept
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Accept Regulation Update</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to accept this update? The regulation content will be updated immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="signature" className="mb-2 block">
                    Your Signature (Required)
                  </Label>
                  <Textarea
                    id="signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Type your full name to confirm"
                    className="w-full"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => acceptMutation.mutate()}
                    disabled={!signature || acceptMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {acceptMutation.isPending ? 'Processing...' : 'Accept Update'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {/* Reject Dialog */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200">
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject Regulation Update</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to reject this update? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="rejection-reason" className="mb-2 block">
                      Rejection Reason (Required)
                    </Label>
                    <Textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this update is being rejected"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reject-signature" className="mb-2 block">
                      Your Signature (Required)
                    </Label>
                    <Textarea
                      id="reject-signature"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Type your full name to confirm"
                      className="w-full"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => rejectMutation.mutate()}
                    disabled={!signature || !rejectionReason || rejectMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {rejectMutation.isPending ? 'Processing...' : 'Reject Update'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {/* Defer Dialog */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border-amber-200">
                  <Clock className="w-4 h-4 mr-2" /> Defer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Defer Regulation Update</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deferring will keep this update in the pending queue for later review.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="defer-signature" className="mb-2 block">
                    Your Signature (Required)
                  </Label>
                  <Textarea
                    id="defer-signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Type your full name to confirm"
                    className="w-full"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deferMutation.mutate()}
                    disabled={!signature || deferMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {deferMutation.isPending ? 'Processing...' : 'Defer Update'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DifferentialView;