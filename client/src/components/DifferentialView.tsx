import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChangeStatistics } from "@/components/ChangeStatistics";

// Diff library
import { diffWords } from 'diff';

interface RegulationUpdate {
  id: number;
  name: string;
  originalContent: string;
  updatedContent: string;
  changeStatistics: {
    added: number;
    removed: number;
    changed: number;
  };
  date: string;
}

export default function DifferentialView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | 'defer' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [signature, setSignature] = useState('');

  // Fetch regulation update details
  const { 
    data: update, 
    isLoading, 
    error 
  } = useQuery<RegulationUpdate>({
    queryKey: ['/api/regulations/updates', Number(id)],
    refetchOnWindowFocus: false,
  });

  // Calculate diffs for display
  const diffs = update ? diffWords(update.originalContent, update.updatedContent) : [];

  // Accept update mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/regulations/${id}/accept`, 'POST', { signature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulations/updates'] });
      navigate('/regulations/updates');
    }
  });

  // Reject update mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/regulations/${id}/reject`, 'POST', { 
        reason: rejectionReason,
        signature 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulations/updates'] });
      navigate('/regulations/updates');
    }
  });

  // Defer update mutation
  const deferMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/regulations/${id}/defer`, 'POST', { signature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulations/updates'] });
      navigate('/regulations/updates');
    }
  });

  const handleConfirm = () => {
    if (confirmAction === 'accept') {
      acceptMutation.mutate();
    } else if (confirmAction === 'reject') {
      rejectMutation.mutate();
    } else if (confirmAction === 'defer') {
      deferMutation.mutate();
    }
    setConfirmAction(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error || !update) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            <p>Error loading regulation update. Please try again.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/regulations/updates')}
            >
              Back to Updates
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/regulations/updates')}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>{update.name}</CardTitle>
          </div>
          <Badge className="ml-auto">Update: {new Date(update.date).toLocaleDateString()}</Badge>
        </CardHeader>
        <CardContent>
          <ChangeStatistics statistics={update.changeStatistics} />
          <Separator className="my-4" />
          
          <div className="border rounded-md p-4 bg-slate-50 font-mono text-sm overflow-auto max-h-96">
            {diffs.map((part, index) => (
              <span 
                key={index}
                className={
                  part.added 
                    ? "bg-green-100 text-green-800" 
                    : part.removed 
                      ? "bg-red-100 text-red-800 line-through" 
                      : ""
                }
              >
                {part.value}
              </span>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setConfirmAction('reject')}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setConfirmAction('defer')}
            >
              Defer
            </Button>
            <Button 
              onClick={() => setConfirmAction('accept')}
            >
              <Check className="h-4 w-4 mr-2" />
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accept confirmation dialog */}
      <Dialog open={confirmAction === 'accept'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Acceptance</DialogTitle>
            <DialogDescription>
              You are about to accept changes to this regulation. Please confirm by providing your signature.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="signature">Digital Signature</Label>
            <Input 
              id="signature" 
              value={signature} 
              onChange={(e) => setSignature(e.target.value)} 
              placeholder="Type your full name" 
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!signature || acceptMutation.isPending}
            >
              {acceptMutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
              Confirm Acceptance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation dialog */}
      <Dialog open={confirmAction === 'reject'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rejection</DialogTitle>
            <DialogDescription>
              You are about to reject changes to this regulation. Please provide a reason and your signature.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="reason">Reason for Rejection</Label>
              <Textarea 
                id="reason" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="Please explain why you are rejecting these changes" 
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="signature-reject">Digital Signature</Label>
              <Input 
                id="signature-reject" 
                value={signature} 
                onChange={(e) => setSignature(e.target.value)} 
                placeholder="Type your full name" 
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!signature || !rejectionReason || rejectMutation.isPending}
              variant="destructive"
            >
              {rejectMutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Defer confirmation dialog */}
      <Dialog open={confirmAction === 'defer'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deferral</DialogTitle>
            <DialogDescription>
              You are about to defer the decision on this regulation update. The update will remain in your pending queue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="signature-defer">Digital Signature</Label>
            <Input 
              id="signature-defer" 
              value={signature} 
              onChange={(e) => setSignature(e.target.value)} 
              placeholder="Type your full name" 
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!signature || deferMutation.isPending}
              variant="secondary"
            >
              {deferMutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
              Confirm Deferral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}