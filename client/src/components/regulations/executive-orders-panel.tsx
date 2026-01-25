/**
 * Executive Orders Panel
 * 
 * Displays Executive Orders affecting a regulation with impact analysis.
 * MCP Engine Integration - January 2026
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Check,
  FileText,
  Scale,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExecutiveOrder {
  id: number;
  eoNumber: string;
  title: string;
  signedDate: string;
  status: string;
  president: string | null;
  term: string | null;
  summary: string | null;
  fullTextUrl: string | null;
}

interface EOImpact {
  id: number;
  eoId: number;
  regulationId: number;
  impactType: string;
  impactSeverity: string;
  impactSummary: string | null;
  assessedBy: string | null;
  confidenceScore: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  executiveOrder: ExecutiveOrder;
  reviewedByUser?: {
    id: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface ExecutiveOrdersPanelProps {
  regulationId: number;
  isAdmin?: boolean;
}

const severityConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: <AlertCircle className="h-4 w-4 text-orange-600" />,
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
  },
  low: {
    label: 'Low',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: <Shield className="h-4 w-4 text-gray-600" />,
  },
};

const impactTypeLabels: Record<string, string> = {
  modifies: 'Modifies',
  reinforces: 'Reinforces',
  conflicts: 'Conflicts',
  supersedes: 'Supersedes',
};

const reviewStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Reviewed', className: 'bg-blue-100 text-blue-800' },
  addressed: { label: 'Addressed', className: 'bg-green-100 text-green-800' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-800' },
};

export function ExecutiveOrdersPanel({ regulationId, isAdmin }: ExecutiveOrdersPanelProps) {
  const queryClient = useQueryClient();
  const [expandedEO, setExpandedEO] = useState<number | null>(null);
  const [reviewingImpact, setReviewingImpact] = useState<EOImpact | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');

  // Fetch EO impacts for this regulation
  const { data: impacts, isLoading, error } = useQuery<EOImpact[]>({
    queryKey: ['eo-impacts', regulationId],
    queryFn: async () => {
      const res = await fetch(`/api/executive-orders/regulation/${regulationId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch executive orders');
      return res.json();
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ impactId, status, notes }: { impactId: number; status: string; notes: string }) => {
      const res = await fetch(`/api/executive-orders/impacts/${impactId}/review`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: status, reviewNotes: notes }),
      });
      if (!res.ok) throw new Error('Failed to submit review');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eo-impacts', regulationId] });
      toast({ title: 'Review submitted successfully' });
      setReviewingImpact(null);
      setReviewStatus('');
      setReviewNotes('');
    },
    onError: () => {
      toast({ title: 'Failed to submit review', variant: 'destructive' });
    },
  });

  const handleReviewSubmit = () => {
    if (!reviewingImpact || !reviewStatus) return;
    reviewMutation.mutate({
      impactId: reviewingImpact.id,
      status: reviewStatus,
      notes: reviewNotes,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Executive Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !impacts) {
    return null; // Silently fail if EO feature not available
  }

  if (impacts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Scale className="h-5 w-5" />
            Executive Orders
          </CardTitle>
          <CardDescription>
            No Executive Orders currently affect this regulation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Count by severity
  const criticalCount = impacts.filter(i => i.impactSeverity === 'critical').length;
  const highCount = impacts.filter(i => i.impactSeverity === 'high').length;
  const pendingCount = impacts.filter(i => i.reviewStatus === 'pending').length;

  return (
    <>
      <Card className={cn(
        criticalCount > 0 && "border-red-300 bg-red-50/30",
        criticalCount === 0 && highCount > 0 && "border-orange-300 bg-orange-50/30"
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {criticalCount > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : highCount > 0 ? (
                <AlertCircle className="h-5 w-5 text-orange-600" />
              ) : (
                <Scale className="h-5 w-5" />
              )}
              Executive Orders ({impacts.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {criticalCount} Critical
                </Badge>
              )}
              {highCount > 0 && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  {highCount} High
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                  {pendingCount} Pending Review
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Presidential Executive Orders affecting this regulation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {impacts.map((impact) => {
            const severity = severityConfig[impact.impactSeverity] || severityConfig.medium;
            const reviewConfig = reviewStatusConfig[impact.reviewStatus] || reviewStatusConfig.pending;
            const isExpanded = expandedEO === impact.id;
            
            return (
              <Collapsible
                key={impact.id}
                open={isExpanded}
                onOpenChange={() => setExpandedEO(isExpanded ? null : impact.id)}
              >
                <div className={cn(
                  "border rounded-lg overflow-hidden",
                  impact.impactSeverity === 'critical' && "border-red-300",
                  impact.impactSeverity === 'high' && "border-orange-300"
                )}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        {severity.icon}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{impact.executiveOrder.eoNumber}</span>
                            <Badge variant="outline" className={severity.className}>
                              {severity.label}
                            </Badge>
                            <Badge variant="outline" className={reviewConfig.className}>
                              {reviewConfig.label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {impact.executiveOrder.title}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-4 border-t">
                      {/* Impact Analysis */}
                      <div className="bg-background rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm font-medium mb-2">
                          <FileText className="h-4 w-4" />
                          Impact Analysis
                          <Badge variant="outline" className="ml-auto">
                            {impactTypeLabels[impact.impactType] || impact.impactType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {impact.impactSummary || 'No analysis available.'}
                        </p>
                        {impact.confidenceScore && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Confidence: {parseFloat(impact.confidenceScore) * 100}% (assessed by {impact.assessedBy})
                          </div>
                        )}
                      </div>
                      
                      {/* EO Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Signed:</span>{' '}
                          {format(new Date(impact.executiveOrder.signedDate), 'MMM d, yyyy')}
                        </div>
                        <div>
                          <span className="text-muted-foreground">President:</span>{' '}
                          {impact.executiveOrder.president || 'N/A'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>{' '}
                          <Badge variant="outline" className={
                            impact.executiveOrder.status === 'active' ? 'bg-green-100 text-green-800' :
                            impact.executiveOrder.status === 'enjoined' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {impact.executiveOrder.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Term:</span>{' '}
                          {impact.executiveOrder.term || 'N/A'}
                        </div>
                      </div>
                      
                      {/* Review Info */}
                      {impact.reviewedAt && impact.reviewedByUser && (
                        <div className="text-sm text-muted-foreground border-t pt-3">
                          Reviewed by {impact.reviewedByUser.firstName || impact.reviewedByUser.username} on{' '}
                          {format(new Date(impact.reviewedAt), 'MMM d, yyyy')}
                          {impact.reviewNotes && (
                            <p className="mt-1 italic">"{impact.reviewNotes}"</p>
                          )}
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        {impact.executiveOrder.fullTextUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(impact.executiveOrder.fullTextUrl!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Full Text
                          </Button>
                        )}
                        {isAdmin && impact.reviewStatus === 'pending' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setReviewingImpact(impact);
                              setReviewStatus('reviewed');
                            }}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewingImpact} onOpenChange={() => setReviewingImpact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review EO Impact</DialogTitle>
            <DialogDescription>
              Mark this Executive Order impact as reviewed, addressed, or dismissed.
            </DialogDescription>
          </DialogHeader>
          
          {reviewingImpact && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-semibold">{reviewingImpact.executiveOrder.eoNumber}</div>
                <div className="text-sm text-muted-foreground">{reviewingImpact.executiveOrder.title}</div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Review Status</label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Reviewed - Acknowledged</SelectItem>
                    <SelectItem value="addressed">Addressed - Action Taken</SelectItem>
                    <SelectItem value="dismissed">Dismissed - Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this review..."
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingImpact(null)}>
              Cancel
            </Button>
            <Button onClick={handleReviewSubmit} disabled={!reviewStatus || reviewMutation.isPending}>
              {reviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
