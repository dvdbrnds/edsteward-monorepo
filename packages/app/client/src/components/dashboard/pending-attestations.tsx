/**
 * Pending Attestations Component
 * Shows regulations that need attestation with quick action buttons
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  ChevronRight, 
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Send,
  // CheckCheck - used by Quick Attest button (currently disabled)
} from "lucide-react";
import { Link } from "wouter";
import type { Regulation, RegulationAction } from "@shared/schema";
import { SendAttestationDialog } from "@/components/regulations/send-attestation-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function PendingAttestations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'compliance_officer';
  
  const [attestationDialog, setAttestationDialog] = useState<{
    open: boolean;
    regulation: Regulation | null;
  }>({ open: false, regulation: null });

  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  // Quick attest mutation - marks attestation as complete directly (currently disabled)
   
  const _quickAttestMutation = useMutation({
    mutationFn: async (regulationId: number) => {
      const now = new Date().toISOString();
      const userWithDetails = user as { firstName?: string; lastName?: string; email?: string };
      const fullName = `${userWithDetails?.firstName || ''} ${userWithDetails?.lastName || ''}`.trim() || user?.username;
      
      return await apiRequest("PATCH", `/api/regulations/${regulationId}/actions/attestation`, {
        status: 'completed',
        completedDate: now,
        completedAt: now,
        completedBy: {
          userId: user?.id,
          username: user?.username,
          email: userWithDetails?.email || user?.username,
          fullName,
          completedAt: now, // Include timestamp in completedBy for signature display
        },
        notes: `Quick attested by ${fullName} on ${new Date().toLocaleString()}`
      });
    },
    onSuccess: () => {
      toast({
        title: "Attestation Complete",
        description: "The regulation has been attested successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Attestation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pending Attestations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Find regulations needing attestation (attestation action not completed)
  const needsAttestation = (regulations || []).filter(reg => {
    const actions: RegulationAction[] = reg.actions || [];
    const attestationAction = actions.find((a: RegulationAction) => a.type === 'attestation');
    return !attestationAction || attestationAction.status !== 'completed';
  }).slice(0, 5);

  const completedCount = (regulations || []).filter(reg => {
    const actions: RegulationAction[] = reg.actions || [];
    const attestationAction = actions.find((a: RegulationAction) => a.type === 'attestation');
    return attestationAction?.status === 'completed';
  }).length;

  const totalCount = (regulations || []).length;

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Pending Attestations
            </CardTitle>
            <Badge variant="outline" className="font-normal">
              {completedCount}/{totalCount} attested
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {needsAttestation.length > 0 ? (
            <div className="space-y-3 flex-1">
              {needsAttestation.map((regulation) => {
                const actions: RegulationAction[] = regulation.actions || [];
                const attestationAction = actions.find((a: RegulationAction) => a.type === 'attestation');
                const isRequired = attestationAction?.required ?? true;

                return (
                  <div
                    key={regulation.id}
                    className="p-3 rounded-lg border border-border hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link href={`/regulations/${regulation.id}`}>
                          <p className="font-medium text-sm text-foreground truncate hover:text-primary cursor-pointer">
                            {regulation.name || regulation.topic || `Regulation #${regulation.id}`}
                          </p>
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {regulation.category || 'Uncategorized'}
                          </Badge>
                          {isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Required
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 flex-shrink-0">
                          {/* Quick Attest button - disabled for now, may re-enable later
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              _quickAttestMutation.mutate(regulation.id);
                            }}
                            disabled={_quickAttestMutation.isPending}
                          >
                            {_quickAttestMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCheck className="h-4 w-4 mr-1" />
                                Attest
                              </>
                            )}
                          </Button>
                          */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAttestationDialog({ open: true, regulation });
                            }}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Request
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-muted-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All regulations have been attested
                </p>
              </div>
            </div>
          )}

          {needsAttestation.length > 0 && (
            <div className="pt-3 mt-auto border-t border-border">
              <Link href="/attestations">
                <Button variant="ghost" className="w-full text-sm">
                  View all pending attestations
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attestation Dialog */}
      {attestationDialog.regulation && (
        <SendAttestationDialog
          open={attestationDialog.open}
          onOpenChange={(open) => setAttestationDialog({ ...attestationDialog, open })}
          regulationId={attestationDialog.regulation.id}
          regulationName={attestationDialog.regulation.name || attestationDialog.regulation.topic || ''}
          riskLevel="medium"
          assignedUserId={attestationDialog.regulation.ownerId || undefined}
          responsibleOffice={attestationDialog.regulation.dro || undefined}
        />
      )}
    </>
  );
}



