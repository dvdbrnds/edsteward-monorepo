/**
 * Circuit Court Interpretations Panel
 *
 * Displays federal circuit court interpretations and splits affecting a regulation.
 * Follows the same pattern as ExecutiveOrdersPanel.
 * MCP Engine Integration - March 2026
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Check,
  Landmark,
  Shield,
  Scale,
  Gavel,
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

interface CircuitInterpretation {
  id: number;
  regulationId: number;
  circuitNumber: number;
  caseName: string;
  caseYear: number | null;
  caseCitation: string | null;
  courtLevel: string;
  interpretationType: string;
  summary: string;
  complianceImplication: string | null;
  affectedRequirements: string[] | null;
  impactSeverity: string;
  status: string;
  isCircuitSplit: boolean | null;
  splitId: number | null;
  sourceUrl: string | null;
  assessedBy: string | null;
  confidenceScore: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
}

interface CircuitSplit {
  id: number;
  regulationId: number;
  title: string;
  description: string | null;
  affectedCircuits: number[] | null;
  scotusPetitionPending: boolean | null;
  scotusCertGranted: boolean | null;
  scotusCaseInfo: string | null;
  status: string;
}

interface TenantCircuitInfo {
  number: number;
  name: string;
  stateCode: string;
}

interface RegulationCircuitData {
  tenantCircuit: TenantCircuitInfo | null;
  myCircuitInterpretations: CircuitInterpretation[];
  otherCircuitInterpretations: CircuitInterpretation[];
  circuitSplits: CircuitSplit[];
  totalCount: number;
}

interface CircuitInterpretationsPanelProps {
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

const typeLabels: Record<string, { label: string; className: string }> = {
  stricter: { label: 'Stricter', className: 'bg-red-100 text-red-800' },
  broader: { label: 'Broader', className: 'bg-blue-100 text-blue-800' },
  narrower: { label: 'Narrower', className: 'bg-purple-100 text-purple-800' },
  divergent: { label: 'Divergent', className: 'bg-amber-100 text-amber-800' },
  vacated: { label: 'Vacated', className: 'bg-gray-100 text-gray-800' },
};

const reviewStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Reviewed', className: 'bg-blue-100 text-blue-800' },
  addressed: { label: 'Addressed', className: 'bg-green-100 text-green-800' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-800' },
};

export function CircuitInterpretationsPanel({ regulationId, isAdmin }: CircuitInterpretationsPanelProps) {
  const queryClient = useQueryClient();
  const [expandedCI, setExpandedCI] = useState<number | null>(null);
  const [reviewingCI, setReviewingCI] = useState<CircuitInterpretation | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');

  const { data, isLoading, error } = useQuery<RegulationCircuitData>({
    queryKey: ['circuit-interpretations', regulationId],
    queryFn: async () => {
      const res = await fetch(`/api/circuit-interpretations/regulation/${regulationId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch circuit interpretations');
      return res.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      const res = await fetch(`/api/circuit-interpretations/${id}/review`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: status, reviewNotes: notes }),
      });
      if (!res.ok) throw new Error('Failed to submit review');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circuit-interpretations', regulationId] });
      toast({ title: 'Review submitted successfully' });
      setReviewingCI(null);
      setReviewStatus('');
      setReviewNotes('');
    },
    onError: () => {
      toast({ title: 'Failed to submit review', variant: 'destructive' });
    },
  });

  const handleReviewSubmit = () => {
    if (!reviewingCI || !reviewStatus) return;
    reviewMutation.mutate({ id: reviewingCI.id, status: reviewStatus, notes: reviewNotes });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Circuit Court Interpretations
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

  if (error) {
    console.error('[CircuitInterpretationsPanel] Query error:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const allInterpretations = [...(data.myCircuitInterpretations || []), ...(data.otherCircuitInterpretations || [])];
  const splits = data.circuitSplits || [];

  if (allInterpretations.length === 0 && splits.length === 0) {
    return null;
  }

  const criticalCount = allInterpretations.filter(i => i.impactSeverity === 'critical').length;
  const highCount = allInterpretations.filter(i => i.impactSeverity === 'high').length;
  const pendingCount = allInterpretations.filter(i => i.reviewStatus === 'pending').length;
  const myCircuit = data.myCircuitInterpretations || [];

  return (
    <>
      <Card className={cn(
        "border-violet-200 bg-violet-50/30",
        criticalCount > 0 && "border-red-300 bg-red-50/30",
        criticalCount === 0 && highCount > 0 && "border-orange-300 bg-orange-50/30"
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-violet-600" />
              Circuit Court Interpretations ({allInterpretations.length})
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {data.tenantCircuit?.name && (
                <Badge variant="outline" className="bg-violet-100 text-violet-800 border-violet-200">
                  Your Circuit: {data.tenantCircuit.name}
                </Badge>
              )}
              {splits.length > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {splits.length} Active Split{splits.length !== 1 ? 's' : ''}
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
            Federal circuit court rulings that affect how this regulation is interpreted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Circuit Splits */}
          {splits.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <Scale className="h-4 w-4" />
                Active Circuit Splits
              </div>
              {splits.map((split) => (
                <div
                  key={split.id}
                  className="border border-red-200 rounded-lg p-3 bg-white"
                >
                  <div className="font-medium text-sm">{split.title}</div>
                  {split.description && (
                    <p className="text-xs text-muted-foreground mt-1">{split.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {(split.affectedCircuits || []).map(c => (
                      <Badge key={c} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        Circuit {c}
                      </Badge>
                    ))}
                    {split.scotusPetitionPending && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                        SCOTUS Petition Pending
                      </Badge>
                    )}
                    {split.scotusCertGranted && (
                      <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-200">
                        SCOTUS Cert Granted
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Your Circuit's Interpretations */}
          {myCircuit.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                <Gavel className="h-4 w-4" />
                Your Circuit ({data.tenantCircuit?.name || 'Unknown'})
              </div>
              {myCircuit.map((ci) => renderInterpretation(ci, expandedCI, setExpandedCI, isAdmin, setReviewingCI, setReviewStatus))}
            </div>
          )}

          {/* Other Circuits */}
          {(data.otherCircuitInterpretations || []).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Gavel className="h-4 w-4" />
                Other Circuits
              </div>
              {(data.otherCircuitInterpretations || []).map((ci) => renderInterpretation(ci, expandedCI, setExpandedCI, isAdmin, setReviewingCI, setReviewStatus))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewingCI} onOpenChange={() => setReviewingCI(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Circuit Interpretation</DialogTitle>
            <DialogDescription>
              Mark this circuit court interpretation as reviewed, addressed, or dismissed.
            </DialogDescription>
          </DialogHeader>

          {reviewingCI && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-semibold">{reviewingCI.caseName}</div>
                <div className="text-sm text-muted-foreground">
                  Circuit {reviewingCI.circuitNumber} &bull; {reviewingCI.caseCitation || ''}
                </div>
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
            <Button variant="outline" onClick={() => setReviewingCI(null)}>
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

function renderInterpretation(
  ci: CircuitInterpretation,
  expandedCI: number | null,
  setExpandedCI: (id: number | null) => void,
  isAdmin: boolean | undefined,
  setReviewingCI: (ci: CircuitInterpretation | null) => void,
  setReviewStatus: (s: string) => void,
) {
  const severity = severityConfig[ci.impactSeverity] || severityConfig.medium;
  const typeConfig = typeLabels[ci.interpretationType] || { label: ci.interpretationType, className: 'bg-gray-100 text-gray-800' };
  const reviewConfig = reviewStatusConfig[ci.reviewStatus] || reviewStatusConfig.pending;
  const isExpanded = expandedCI === ci.id;

  return (
    <Collapsible
      key={ci.id}
      open={isExpanded}
      onOpenChange={() => setExpandedCI(isExpanded ? null : ci.id)}
    >
      <div className={cn(
        "border rounded-lg overflow-hidden",
        ci.impactSeverity === 'critical' && "border-red-300",
        ci.impactSeverity === 'high' && "border-orange-300"
      )}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-3">
              {severity.icon}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{ci.caseName}</span>
                  <Badge variant="outline" className="text-xs bg-violet-100 text-violet-800 border-violet-200">
                    Circuit {ci.circuitNumber}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", severity.className)}>
                    {severity.label}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", typeConfig.className)}>
                    {typeConfig.label}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {ci.caseCitation || ''} {ci.caseYear ? `(${ci.caseYear})` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className={cn("text-xs", reviewConfig.className)}>
                {reviewConfig.label}
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3 border-t">
            <div className="bg-background rounded-lg p-3">
              <p className="text-sm text-muted-foreground">{ci.summary}</p>
            </div>

            {ci.complianceImplication && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 mb-1">Compliance Implication</div>
                <p className="text-sm text-blue-700">{ci.complianceImplication}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Court Level:</span>{' '}
                <span className="capitalize">{ci.courtLevel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                <Badge variant="outline" className={
                  ci.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }>
                  {ci.status}
                </Badge>
              </div>
            </div>

            {isAdmin && ci.reviewStatus === 'pending' && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setReviewingCI(ci);
                    setReviewStatus('reviewed');
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Review
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
