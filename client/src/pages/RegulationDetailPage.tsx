import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, RegulationAction } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  FileText,
  Mail,
  Printer,
  Globe,
  ArrowLeft,
  Loader2,
  History,
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
import { useAuth } from "@/hooks/use-auth";
import { NotificationSettingsForm } from "./regulation-notification-settings";

function calculateComplianceScore(regulation: Regulation | undefined, deadlines: Deadline[] = []): {
  score: number;
  breakdown: {
    deadlines: number;
    documentation: number;
    review: number;
  };
} {
  if (!regulation) {
    return {
      score: 0,
      breakdown: {
        deadlines: 0,
        documentation: 0,
        review: 0
      }
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

  const totalScore = Math.round(deadlineScore + documentationScore + reviewScore);

  return {
    score: totalScore,
    breakdown: {
      deadlines: Math.round(deadlineScore),
      documentation: Math.round(documentationScore),
      review: Math.round(reviewScore)
    }
  };
}

// Main component with all necessary hooks
function RegulationDetailPage() {
  // Basic hooks and state
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const regulationId = Number(location.split("/")[2]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // UI state hooks
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);
  
  // Check if the user has admin role
  const isAdmin = user?.role === 'admin';

  // Initialize all mutations first
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

  const handleActionStatusChange = (action: RegulationAction, newStatus: RegulationAction['status']) => {
    const updatedAction = { ...action, status: newStatus };
    
    // For attestation actions that are being completed, add user information
    if (action.type === 'attestation' && newStatus === 'completed' && user) {
      const now = new Date();
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : undefined;
      
      updatedAction.completedBy = {
        userId: user.id,
        username: user.username,
        fullName
      };
      updatedAction.completedAt = now;
      updatedAction.completedDate = now;
    }
    
    updateActionMutation.mutate({
      regulationId,
      action: updatedAction
    });
  };
  
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

  const regulationDeadlines = deadlines.filter(d => d.regulationId === regulationId) || [];
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

  const complianceScore = calculateComplianceScore(regulation, regulationDeadlines);

  const handleActionClick = (actionType: string) => {
    switch (actionType) {
      case "website_publish":
        setShowWebPublishDialog(true);
        break;
      case "community_communication":
        setShowCommunicationDialog(true);
        break;
      case "agency_submission":
        setShowSubmissionWizard(true);
        break;
    }
  };

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
                {isAdmin && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-bold">
                    Admin Mode Active
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regulation?.regulationUrl && (
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                  onClick={() => regulation.regulationUrl && window.open(regulation.regulationUrl, '_blank')}
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
                  const subject = encodeURIComponent(`Regulation ${regulation?.itemId} - ${regulation?.topic}`);
                  window.location.href = `mailto:compliance@moravian.edu?subject=${subject}`;
                }}
              >
                <Mail className="h-4 w-4" />
                Contact Compliance Office
              </Button>
            </div>

            {/* Timeline */}
            <RegulationTimeline regulation={regulation} />

            {/* Actions Section */}
            {regulation.actions && regulation.actions.length > 0 && (
              <div className="bg-white shadow sm:rounded-lg border border-gray-200">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Action Items</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Required actions for compliance with this regulation
                  </p>
                </div>
                <div className="border-t border-gray-200">
                  <dl>
                    {regulation.actions.map((action, index) => (
                      <div key={index} className={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <dt className="text-sm font-medium text-gray-500">
                          {action.type === 'attestation' && 'Attestation'}
                          {action.type === 'website_publish' && 'Website Publication'}
                          {action.type === 'community_communication' && 'Community Communication'}
                          {action.type === 'agency_submission' && 'Agency Submission'}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                action.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : action.status === 'in_progress' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {action.status === 'completed' ? 'Completed' : action.status === 'in_progress' ? 'In Progress' : 'Pending'}
                              </span>
                              {action.dueDate && (
                                <span className="ml-2 text-xs text-gray-500">
                                  Due: {format(new Date(action.dueDate), "PP")}
                                </span>
                              )}
                              {action.completedBy && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Completed by: {action.completedBy.fullName || action.completedBy.username}
                                  {action.completedAt && (
                                    <span> on {format(new Date(action.completedAt), "PP")}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {action.status !== 'completed' && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActionStatusChange(action, 'completed')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  Complete
                                </Button>
                              )}
                              {action.type !== 'attestation' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleActionClick(action.type)}
                                >
                                  Details
                                </Button>
                              )}
                            </div>
                          </div>
                          {action.notes && (
                            <p className="mt-2 text-sm text-gray-500">{action.notes}</p>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Regulation Sections Card */}
                {regulation.sections && regulation.sections.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Regulation Sections</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {regulation.sections.map((section, index) => (
                          <div key={index} className="border-b pb-4 last:border-b-0">
                            <h3 className="font-semibold text-gray-900">{section.title}</h3>
                            <p className="mt-2 text-gray-700 whitespace-pre-wrap">{section.content}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Summary Card */}
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

                {/* Submission Guidelines Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Submission Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      {regulation.submissionGuidelines ? (
                        <div dangerouslySetInnerHTML={{
                          __html: regulation.submissionGuidelines
                        }} />
                      ) : (
                        <p className="text-gray-500 italic">
                          No submission guidelines available.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Notes & Comments Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Notes & Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <NoteSection regulationId={regulationId.toString()} />
                  </CardContent>
                </Card>

                {/* Additional Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {isAdmin && (
                        <div>
                          <h3 className="font-medium text-gray-900">Version History</h3>
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              className="flex items-center gap-2"
                              onClick={() => setShowVersionHistory(!showVersionHistory)}
                            >
                              <History className="h-4 w-4" />
                              {showVersionHistory ? 'Hide Version History' : 'Show Version History'}
                            </Button>
                            {showVersionHistory && regulation?.previousVersionId && (
                              <div className="mt-4">
                                <RegulationChanges currentRegulation={regulation} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="font-medium text-gray-900">Statute</h3>
                        <p className="text-gray-700 mt-1">
                          {regulation?.statute}
                        </p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-900">Agency</h3>
                        <p className="text-gray-700 mt-1">
                          {regulation?.agency_name || 'No agency specified'}
                          {regulation?.agency_department && (
                            <span> ({regulation.agency_department})</span>
                          )}
                        </p>
                        {regulation?.agency_url && (
                          <a
                            href={regulation.agency_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00267A] hover:text-[#003166] underline inline-flex items-center gap-2 mt-1"
                          >
                            <Globe className="h-4 w-4" />
                            Visit Agency Website
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-900">References</h3>
                        {/* References section - commented out as property doesn't exist in current schema
                        {regulation?.references && regulation.references.length > 0 ? (
                          <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-700">
                            {regulation.references.map((reference: any, index: number) => (
                              <li key={index}>
                                {reference.url ? (
                                  <a
                                    href={reference.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#00267A] hover:text-[#003166] underline"
                                  >
                                    {reference.title || reference.url}
                                  </a>
                                ) : (
                                  reference.title
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : ( */}
                          <p className="text-gray-500 italic mt-1">No references available.</p>
                        {/* )} */}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence Files */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evidence Files</CardTitle>
                    <CardDescription>Upload and manage evidence files for this regulation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EvidenceFiles regulationId={regulationId} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {/* Compliance Score Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center">
                      <CircularProgress 
                        value={complianceScore.score}
                        size={150}
                        strokeWidth={15}
                        color="#00267A"
                        secondaryColor="#F3F4F6"
                      />
                      <div className="mt-6 w-full space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Deadlines</span>
                            <span>{complianceScore.breakdown.deadlines}/40</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-[#00267A] h-2.5 rounded-full" style={{ width: `${(complianceScore.breakdown.deadlines / 40) * 100}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Documentation</span>
                            <span>{complianceScore.breakdown.documentation}/30</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-[#00267A] h-2.5 rounded-full" style={{ width: `${(complianceScore.breakdown.documentation / 30) * 100}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Review Status</span>
                            <span>{complianceScore.breakdown.review}/30</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-[#00267A] h-2.5 rounded-full" style={{ width: `${(complianceScore.breakdown.review / 30) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Deadlines Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Deadlines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulationDeadlines.map((deadline) => (
                        <div key={deadline.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {deadline.description || "Compliance Deadline"}
                              </p>
                              <p className="text-sm text-gray-500">
                                Due: {format(new Date(deadline.dueDate), "PP")}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 text-xs rounded font-medium ${
                                deadline.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : deadline.status === "in_progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {deadline.status === "completed"
                                ? "Completed"
                                : deadline.status === "in_progress"
                                ? "In Progress"
                                : "Pending"}
                            </span>
                          </div>
                        </div>
                      ))}
                      {regulationDeadlines.length === 0 && (
                        <p className="text-gray-500 italic">No deadlines set</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Admin Notification Settings Card */}
                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Notification Settings</CardTitle>
                      <CardDescription>Configure notification settings for this regulation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <NotificationSettingsForm regulation={regulation} regulationId={regulationId} />
                    </CardContent>
                  </Card>
                )}

                {/* Action Required Card */}
                {nextDeadline && nextDeadline.status !== "completed" && (
                  <Card className="border-[#00267A]">
                    <CardHeader>
                      <CardTitle className="text-[#00267A]">
                        Action Required
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          Next deadline:{" "}
                          {format(new Date(nextDeadline.dueDate), "PP")}
                        </p>
                        <Button className="w-full">
                          Complete Compliance Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      {regulation && (
        <>
          <WebPublishDialog
            regulation={regulation}
            open={showWebPublishDialog}
            onOpenChange={setShowWebPublishDialog}
          />
          <CommunicationDialog
            regulation={regulation}
            open={showCommunicationDialog}
            onOpenChange={setShowCommunicationDialog}
          />
          <SubmissionWizard
            regulation={regulation}
            open={showSubmissionWizard}
            onOpenChange={setShowSubmissionWizard}
          />
        </>
      )}
    </div>
  );
}

export default RegulationDetailPage;