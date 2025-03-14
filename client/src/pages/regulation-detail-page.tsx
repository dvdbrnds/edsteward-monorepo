import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, Guide, RegulationAction } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Check,
  CheckCircle2,
  Clock4
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CircularProgress from "@/components/common/circular-progress";
import { format, differenceInDays } from "date-fns";
import { NoteSection } from "@/components/regulations/note-section";
import { RegulationChanges } from "@/components/regulations/regulation-changes";
import { RegulationTimeline } from "@/components/regulations/regulation-timeline";
import { WebPublishDialog } from "@/components/regulations/web-publish-dialog";
import { CommunicationDialog } from "@/components/regulations/communication-dialog";
import { SubmissionWizard } from "@/components/regulations/submission-wizard";
import { EvidenceFiles } from "@/components/regulations/evidence-files";

interface AttestationActionProps {
  action: RegulationAction;
  regulationId: number;
  onStatusChange: (status: RegulationAction['status']) => void;
}

function AttestationAction({ action, regulationId, onStatusChange }: AttestationActionProps) {
  const handleAttestation = (checked: boolean) => {
    onStatusChange(checked ? 'completed' : 'pending');
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 space-y-2">
        <p>
          By checking this box, you attest that your institution is in compliance with all
          requirements specified in this regulation. This attestation will be recorded and
          timestamped.
        </p>
        <p>
          Please ensure you have reviewed all requirements and have sufficient documentation
          to support this attestation.
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="attestation"
          checked={action.status === 'completed'}
          onCheckedChange={handleAttestation}
        />
        <label
          htmlFor="attestation"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Yes, I attest that we are in compliance with this regulation
        </label>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  action: RegulationAction;
  regulationId: number;
  regulation: Regulation;
  isAdmin: boolean;
  onRequiredChange?: (required: boolean) => void;
  onStatusChange?: (status: RegulationAction['status']) => void;
}

function ActionButton({ action, regulationId, regulation, isAdmin, onRequiredChange, onStatusChange }: ActionButtonProps) {
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);

  const getIcon = () => {
    switch (action.type) {
      case 'attestation':
        return <Check className="h-5 w-5" />;
      case 'website_publish':
        return <Globe className="h-5 w-5" />;
      case 'community_communication':
        return <Mail className="h-5 w-5" />;
      case 'agency_submission':
        return <FileText className="h-5 w-5" />;
    }
  };

  const getActionLabel = () => {
    return action.type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleActionClick = () => {
    if (action.type === 'website_publish') {
      setShowWebPublishDialog(true);
    } else if (action.type === 'community_communication') {
      setShowCommunicationDialog(true);
    } else if (action.type === 'agency_submission') {
      setShowSubmissionWizard(true);
      onStatusChange?.('in_progress');
    }
  };

  return (
    <>
      <div className={`flex flex-col space-y-4 p-4 border rounded-lg ${action.required ? 'border-red-200' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${action.status === 'completed' ? 'bg-green-50' : 'bg-blue-50'}`}>
              {getIcon()}
            </div>
            <div>
              <span className="font-medium">{getActionLabel()}</span>
              {action.required && <span className="ml-2 text-xs text-red-500">*Required</span>}
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch
                checked={action.required}
                onCheckedChange={onRequiredChange}
                aria-label="Toggle required"
              />
              <span className="text-sm text-gray-500">Required</span>
            </div>
          )}
        </div>

        {action.type === 'attestation' ? (
          <AttestationAction
            action={action}
            regulationId={regulationId}
            onStatusChange={onStatusChange!}
          />
        ) : action.type === 'website_publish' ? (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={() => {
              handleActionClick();
              onStatusChange?.('in_progress');
            }}
          >
            <Globe className="h-4 w-4 mr-2" />
            Publish to Website
          </Button>
        ) : action.type === 'community_communication' ? (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={() => {
              handleActionClick();
              onStatusChange?.('in_progress');
            }}
          >
            <Mail className="h-4 w-4 mr-2" />
            Generate Statement
          </Button>
        ) : action.type === 'agency_submission' ? (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleActionClick}
          >
            <FileText className="h-4 w-4 mr-2" />
            Begin Submission
          </Button>
        ) : null}
      </div>

      {action.type === 'website_publish' && (
        <WebPublishDialog
          regulation={regulation}
          open={showWebPublishDialog}
          onOpenChange={setShowWebPublishDialog}
        />
      )}

      {action.type === 'community_communication' && (
        <CommunicationDialog
          regulation={regulation}
          open={showCommunicationDialog}
          onOpenChange={setShowCommunicationDialog}
        />
      )}

      {action.type === 'agency_submission' && (
        <SubmissionWizard
          regulation={regulation}
          open={showSubmissionWizard}
          onOpenChange={setShowSubmissionWizard}
        />
      )}
    </>
  );
}

export default function RegulationDetailPage() {
  const [location] = useLocation();
  const regulationId = location.split("/")[2];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["/api/user"]
  });

  const { data: regulation, isLoading: regulationLoading } = useQuery<Regulation>({
    queryKey: ["/api/regulations", regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${regulationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch regulation');
      }
      return response.json();
    },
    enabled: !!regulationId
  });

  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"]
  });

  const updateActionMutation = useMutation({
    mutationFn: async ({ regulationId, action }: { regulationId: number; action: RegulationAction }) => {
      const response = await fetch(
        `/api/regulations/${regulationId}/actions/${action.type}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(action),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update action");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Updated",
        description: "The action has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (regulationLoading || deadlinesLoading) {
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

  const regulationDeadlines = deadlines.filter(d => d.regulationId === Number(regulationId)) || [];
  const nextDeadline = regulationDeadlines.length > 0
    ? regulationDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    : null;

  if (!regulation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900">Regulation Not Found</h2>
              <p className="mt-2 text-gray-600">The regulation you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="mt-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
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
            <div>
              <Button
                variant="ghost"
                onClick={() => window.history.back()}
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
                  {regulation.category || 'Uncategorized'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      {regulation.summary || "No summary available."}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <div className="space-y-4">
                        {regulation.requirements ? (
                          <p className="text-gray-700">{regulation.requirements}</p>
                        ) : (
                          <p className="text-gray-500 italic">
                            No specific requirements listed.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                    <CardDescription>Required actions and their current status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulation?.actions?.map((action) => (
                        <ActionButton
                          key={action.type}
                          action={action}
                          regulationId={Number(regulationId)}
                          regulation={regulation}
                          isAdmin={user?.role === "admin"}
                          onRequiredChange={(required) => {
                            updateActionMutation.mutate({
                              regulationId: Number(regulationId),
                              action: { ...action, required }
                            });
                          }}
                          onStatusChange={(status) => {
                            updateActionMutation.mutate({
                              regulationId: Number(regulationId),
                              action: { ...action, status }
                            });
                          }}
                        />
                      ))}
                      {(!regulation?.actions || regulation.actions.length === 0) && (
                        <p className="text-gray-500 italic">No actions configured</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <EvidenceFiles regulationId={Number(regulationId)} />
                {nextDeadline && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Next Deadline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          nextDeadline.status === 'completed' ? 'bg-green-50' :
                          nextDeadline.status === 'overdue' ? 'bg-red-50' : 'bg-yellow-50'
                        }`}>
                          {nextDeadline.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : nextDeadline.status === 'overdue' ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            Due: {format(new Date(nextDeadline.dueDate), "PP")}
                          </p>
                          <span className={`text-sm ${
                            nextDeadline.status === 'completed' ? 'text-green-600' :
                            nextDeadline.status === 'overdue' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {nextDeadline.status.charAt(0).toUpperCase() + nextDeadline.status.slice(1)}
                          </span>
                        </div>
                      </div>
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