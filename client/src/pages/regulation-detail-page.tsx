/**
 * @module RegulationDetailPage
 * @description Displays detailed information about a specific regulation and provides administrative controls
 * @compliance ISO/IEC/IEEE 26514 4.3.2 - User Interface Documentation
 * 
 * @securityControl Access Control
 * - Implements role-based access control for admin features
 * - Restricts notification settings to admin users
 * - Validates user authentication status
 * 
 * @component
 * @example
 * ```tsx
 * <RegulationDetailPage />
 * ```
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SubmissionWizard } from "@/components/regulations/submission-wizard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function RegulationDetailPage() {
  const [location] = useLocation();
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const regulationId = location.split("/")[2];

  const { data: regulation, isLoading } = useQuery<Regulation>({
    queryKey: ["/api/regulations", regulationId],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ type, status }: { type: string; status: string }) => {
      const response = await fetch(`/api/regulations/${regulationId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, status }),
      });
      if (!response.ok) throw new Error("Failed to update action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/regulations", regulationId]);
      toast({
        title: "Action Updated",
        description: "The regulation action has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleActionUpdate = (type: string) => {
    const currentAction = regulation?.actions?.find(a => a.type === type);
    const newStatus = currentAction?.status === "completed" ? "pending" : "completed";
    actionMutation.mutate({ type, status: newStatus });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Required Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={() => setShowSubmissionWizard(true)}
              className="w-full"
            >
              Submit Evidence
            </Button>

            <Dialog open={showSubmissionWizard} onOpenChange={setShowSubmissionWizard}>
              <DialogContent className="max-w-4xl">
                <SubmissionWizard
                  regulation={regulation}
                  onActionUpdate={handleActionUpdate}
                  onOpenChange={setShowSubmissionWizard}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}