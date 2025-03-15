import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, RegulationAction } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
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
  Shield,
  History,
  Check,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteSection } from "@/components/regulations/note-section";
import { RegulationChanges } from "@/components/regulations/regulation-changes";
import { RegulationTimeline } from "@/components/regulations/regulation-timeline";
import { WebPublishDialog } from "@/components/regulations/web-publish-dialog";
import { CommunicationDialog } from "@/components/regulations/communication-dialog";
import { SubmissionWizard } from "@/components/regulations/submission-wizard";
import { EvidenceFiles } from "@/components/regulations/evidence-files";

function calculateComplianceScore(regulation: Regulation | undefined, deadlines: Deadline[] = []) {
  if (!regulation) {
    return {
      score: 0,
      breakdown: { deadlines: 0, documentation: 0, review: 0 }
    };
  }

  // Calculate deadline completion rate (40% of total score)
  const completedDeadlines = deadlines.filter(d => d.status === "completed").length;
  const deadlineScore = deadlines.length > 0
    ? (completedDeadlines / deadlines.length) * 40
    : 0;

  // Calculate documentation score (30% of total score)
  const documentationFields = [
    regulation.requirements,
    regulation.regulationUrl,
    regulation.requirementsUrl,
    regulation.submissionGuidelines
  ];
  const filledFields = documentationFields.filter(field => field && field.length > 0).length;
  const documentationScore = (filledFields / documentationFields.length) * 30;

  // Calculate review status score (30% of total score)
  const reviewScore = regulation.lastUpdated
    ? Math.max(0, 30 - Math.floor(differenceInDays(new Date(), new Date(regulation.lastUpdated)) / 30))
    : 0;

  return {
    score: Math.round(deadlineScore + documentationScore + reviewScore),
    breakdown: {
      deadlines: Math.round(deadlineScore),
      documentation: Math.round(documentationScore),
      review: Math.round(reviewScore)
    }
  };
}

function AttestationAction({ action, regulationId, onStatusChange }: {
  action: RegulationAction;
  regulationId: number;
  onStatusChange: (status: RegulationAction['status']) => void;
}) {
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

function ActionButton({ action, regulationId, regulation, isAdmin, onRequiredChange, onStatusChange }: {
  action: RegulationAction;
  regulationId: number;
  regulation: Regulation;
  isAdmin: boolean;
  onRequiredChange?: (required: boolean) => void;
  onStatusChange?: (status: RegulationAction['status']) => void;
}) {
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);

  const getIcon = () => {
    switch (action.type) {
      case 'attestation': return <Check className="h-5 w-5" />;
      case 'website_publish': return <Globe className="h-5 w-5" />;
      case 'community_communication': return <Mail className="h-5 w-5" />;
      case 'agency_submission': return <FileText className="h-5 w-5" />;
    }
  };

  const getActionLabel = () => {
    return action.type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleActionClick = () => {
    switch (action.type) {
      case 'website_publish':
        setShowWebPublishDialog(true);
        break;
      case 'community_communication':
        setShowCommunicationDialog(true);
        break;
      case 'agency_submission':
        setShowSubmissionWizard(true);
        break;
    }
    onStatusChange?.('in_progress');
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
        ) : (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleActionClick}
          >
            {getIcon()}
            <span className="ml-2">
              {action.type === 'website_publish' && 'Publish to Website'}
              {action.type === 'community_communication' && 'Generate Statement'}
              {action.type === 'agency_submission' && 'Begin Submission'}
            </span>
          </Button>
        )}
      </div>

      <WebPublishDialog
        regulation={regulation}
        open={showWebPublishDialog}
        onOpenChange={setShowWebPublishDialog}
        onComplete={() => onStatusChange?.('completed')}
      />

      <CommunicationDialog
        regulation={regulation}
        open={showCommunicationDialog}
        onOpenChange={setShowCommunicationDialog}
        onComplete={() => onStatusChange?.('completed')}
      />

      <SubmissionWizard
        regulation={regulation}
        open={showSubmissionWizard}
        onOpenChange={setShowSubmissionWizard}
        onComplete={() => onStatusChange?.('completed')}
      />
    </>
  );
}

export function RegulationDetailPage() {
  const [location] = useLocation();
  const regulationId = Number(location.split("/")[2]);
  const { user } = useAuth();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update action mutation
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
      queryClient.invalidateQueries({ queryKey: ["/api/regulations"] });
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

  // Category mutation
  const categoryMutation = useMutation({
    mutationFn: async (category: string) => {
      const response = await fetch(
        `/api/regulations/${regulationId}/category`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update category");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Category Updated",
        description: "The regulation category has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulationId] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: regulation, isLoading: regulationLoading } = useQuery<Regulation>({
    queryKey: ["/api/regulations", regulationId],
    enabled: !!regulationId,
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const handleActionStatusChange = (action: RegulationAction, newStatus: RegulationAction['status']) => {
    updateActionMutation.mutate({
      regulationId,
      action: { ...action, status: newStatus }
    });
  };

  if (!user) {
    location.replace("/auth");
    return null;
  }

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

  const regulationDeadlines = deadlines?.filter(d => d.regulationId === regulationId) || [];
  const nextDeadline = regulationDeadlines.length > 0
    ? regulationDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    : null;

  const complianceScore = calculateComplianceScore(regulation, regulationDeadlines);

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
                {user.role === "admin" ? (
                  <Select
                    defaultValue={regulation.category}
                    onValueChange={(value) => categoryMutation.mutate(value)}
                  >
                    <SelectTrigger className="w-[180px] bg-gray-100 border-2 border-[#5B2C8F] rounded-md relative group hover:bg-purple-50/50 transition-colors">
                      <div className="absolute -top-2 -right-2 bg-[#5B2C8F] text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Admin
                      </div>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Academic Programs",
                        "Campus Safety",
                        "Civil Rights",
                        "Student Services",
                        "Administrative",
                        "Other"
                      ].map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {regulation.category || 'Uncategorized'}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regulation.regulationUrl && (
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                  onClick={() => window.open(regulation.regulationUrl, '_blank')}
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

            <RegulationTimeline regulation={regulation} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
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

                {/* Version History */}
                {user.role === "admin" && regulation.previousVersionId && (
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
                        {showVersionHistory ? 'Hide Version History' : 'Show Version History'}
                      </Button>
                      {showVersionHistory && (
                        <div className="mt-4">
                          <RegulationChanges currentRegulation={regulation} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Agency Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Agency Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {regulation.agency_name && (
                        <p className="text-gray-700">
                          <span className="font-medium">Agency:</span> {regulation.agency_name}
                        </p>
                      )}
                      {regulation.agency_url && (
                        <a
                          href={regulation.agency_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00267A] hover:text-[#003166] underline inline-flex items-center gap-2"
                        >
                          Visit Agency Website
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {regulation.agency_contact && (
                        <p className="text-gray-700">
                          <span className="font-medium">Contact:</span> {regulation.agency_contact}
                        </p>
                      )}
                      {regulation.agency_department && (
                        <p className="text-gray-700">
                          <span className="font-medium">Department:</span> {regulation.agency_department}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Submission Guidelines */}
                <Card>
                  <CardHeader>
                    <CardTitle>Submission Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      {regulation.submissionGuidelines ? (
                        <div 
                          className="text-gray-700"
                          dangerouslySetInnerHTML={{ __html: regulation.submissionGuidelines }} 
                        />
                      ) : (
                        <p className="text-gray-500 italic">
                          No submission guidelines available.
                        </p>
                      )}
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
                    <NoteSection regulationId={regulationId} />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Compliance Score */}
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-[#00267A]">
                        {complianceScore.score}%
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Deadlines</span>
                          <span>{complianceScore.breakdown.deadlines}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Documentation</span>
                          <span>{complianceScore.breakdown.documentation}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Review Status</span>
                          <span>{complianceScore.breakdown.review}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                    <CardDescription>Required actions and their current status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulation.actions?.map((action) => (
                        <ActionButton
                          key={action.type}
                          action={action}
                          regulationId={regulationId}
                          regulation={regulation}
                          isAdmin={user.role === "admin"}
                          onRequiredChange={(required) => {
                            updateActionMutation.mutate({
                              regulationId,
                              action: { ...action, required }
                            });
                          }}
                          onStatusChange={(status) => handleActionStatusChange(action, status)}
                        />
                      ))}
                      {(!regulation.actions || regulation.actions.length === 0) && (
                        <p className="text-gray-500 italic">No actions configured</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence Files */}
                <EvidenceFiles regulationId={regulationId} />

                {/* Deadlines */}
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

export default RegulationDetailPage;