/**
 * @module RegulationDetailPage
 * @description Displays detailed information about a specific regulation and provides administrative controls
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SubmissionWizard } from "@/components/regulations/submission-wizard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  ExternalLink,
  FileText,
  Mail,
  Printer,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Bell,
  Shield,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { NoteSection } from "@/components/regulations/note-section";
import { RegulationTimeline } from "@/components/regulations/regulation-timeline";
import { RegulationChanges } from "@/components/regulations/regulation-changes";
import Navigation from "@/components/layout/navigation";

interface Action {
  type: string;
  status: string;
}

interface RegulationType extends Regulation {
  actions?: Action[];
}

export default function RegulationDetailPage() {
  const [location, navigate] = useLocation();
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const regulationId = location.split("/")[2];

  const { data: regulation, isLoading } = useQuery<RegulationType>({
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
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulationId] });
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
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-4">
              <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
              <span>Loading...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!regulation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p>Regulation not found.</p>
            </div>
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
          <div className="space-y-8">
            {/* Header Section */}
            <div>
              <Button
                variant="ghost"
                onClick={() => navigate("/regulations")}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Regulations
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {regulation.name || regulation.topic}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  ID: {regulation.itemId}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {regulation.category}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regulation.regulationUrl && (
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                  onClick={() => window.open(regulation.regulationUrl || '', '_blank')}
                >
                  <Globe className="h-4 w-4" />
                  View Regulation Website
                </Button>
              )}
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Print Report
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2"
                onClick={() => {
                  const subject = encodeURIComponent(`Regulation ${regulation.itemId} - ${regulation.topic}`);
                  window.location.href = `mailto:compliance@moravian.edu?subject=${subject}`;
                }}
              >
                <Mail className="h-4 w-4" />
                Contact Compliance Office
              </Button>
            </div>

            {/* Required Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Required Actions</CardTitle>
                <CardDescription>Track and manage compliance requirements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <input 
                        type="checkbox" 
                        checked={regulation.actions?.find(a => a.type === 'attestation')?.status === 'completed'}
                        onChange={() => handleActionUpdate('attestation')}
                        className="mt-1" 
                      />
                      <div>
                        <p className="font-medium">Attestation</p>
                        <p className="text-sm text-gray-600">Confirm review of requirements</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <input 
                        type="checkbox"
                        checked={regulation.actions?.find(a => a.type === 'website_publish')?.status === 'completed'}
                        onChange={() => handleActionUpdate('website_publish')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">Website Publication</p>
                        <p className="text-sm text-gray-600">Public disclosure requirements</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <input 
                        type="checkbox"
                        checked={regulation.actions?.find(a => a.type === 'community_communication')?.status === 'completed'}
                        onChange={() => handleActionUpdate('community_communication')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">Community Communication</p>
                        <p className="text-sm text-gray-600">Required notifications</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <input 
                        type="checkbox"
                        checked={regulation.actions?.find(a => a.type === 'agency_submission')?.status === 'completed'}
                        onChange={() => handleActionUpdate('agency_submission')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">Agency Submission</p>
                        <p className="text-sm text-gray-600">Submit required documentation</p>
                      </div>
                    </div>
                  </div>

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

            <RegulationTimeline regulation={regulation} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      {regulation.summary
                        ?.replace(/<[^>]*>/g, '')
                        ?.split(/\n+/)
                        .map((paragraph, index) => (
                          <p key={index} className="mb-4 leading-relaxed">
                            {paragraph.trim()}
                          </p>
                        ))
                        || "No summary available."}
                    </div>
                  </CardContent>
                </Card>

                {/* Requirements Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <div className="space-y-4">
                        {regulation.requirements ? (
                          <>
                            <p className="text-gray-700">{regulation.requirements}</p>
                            {regulation.requirementsUrl && (
                              <a
                                href={regulation.requirementsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00267A] hover:text-[#003166] underline inline-flex items-center gap-2"
                              >
                                <FileText className="h-4 w-4" />
                                View Detailed Requirements
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-500 italic">
                            No specific requirements listed.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Diary</CardTitle>
                    <CardDescription>
                      Keep a running journal of how this regulation affects your institution.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NoteSection regulationId={Number(regulationId)} />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Version History */}
                {regulation.previousVersionId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Version History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => setShowVersionHistory(!showVersionHistory)}
                      >
                        <History className="h-4 w-4" />
                        {showVersionHistory ? 'Hide Changes' : 'Show Changes'}
                      </Button>
                      {showVersionHistory && (
                        <div className="mt-4">
                          <RegulationChanges currentRegulation={regulation} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}