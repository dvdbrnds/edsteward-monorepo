import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Regulation, Deadline, RegulationAction } from "@shared/schema";

// Helper function to calculate compliance status
function calculateComplianceStatus(actions: RegulationAction[], deadlines: Deadline[]) {
  const requiredActions = actions.filter(action => action.required);
  const completedRequiredActions = requiredActions.filter(action => action.status === 'completed');
  
  const overdueDeadlines = deadlines.filter(deadline => 
    deadline.status === 'overdue' || 
    (deadline.status === 'pending' && new Date(deadline.dueDate) < new Date())
  );
  
  const upcomingDeadlines = deadlines.filter(deadline => 
    deadline.status === 'pending' && 
    new Date(deadline.dueDate) >= new Date() &&
    new Date(deadline.dueDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
  );
  
  // Determine overall status
  if (overdueDeadlines.length > 0) {
    return {
      status: 'non-compliant' as const,
      level: 'critical' as const,
      message: `${overdueDeadlines.length} overdue deadline${overdueDeadlines.length > 1 ? 's' : ''}`,
      color: 'red'
    };
  }
  
  if (requiredActions.length > 0 && completedRequiredActions.length < requiredActions.length) {
    return {
      status: 'partial-compliance' as const,
      level: 'warning' as const,
      message: `${requiredActions.length - completedRequiredActions.length} required action${requiredActions.length - completedRequiredActions.length > 1 ? 's' : ''} pending`,
      color: 'yellow'
    };
  }
  
  if (upcomingDeadlines.length > 0) {
    return {
      status: 'compliant-with-upcoming' as const,
      level: 'info' as const,
      message: `${upcomingDeadlines.length} deadline${upcomingDeadlines.length > 1 ? 's' : ''} due within 30 days`,
      color: 'blue'
    };
  }
  
  return {
    status: 'compliant' as const,
    level: 'success' as const,
    message: 'All requirements met',
    color: 'green'
  };
}

// Extended type that includes actions and other UI-specific properties
type RegulationWithOverride = Regulation & {
  actions: RegulationAction[];
  sections?: { title: string; content: string }[];
  notificationOverride?: {
    email?: string;
    phone?: string;
  };
  notificationSchedule?: {
    initialReminder: number;
    weeklyReminder: number;
    dailyReminder: number;
    finalDayReminders: boolean;
  };
};

// Schema for notification override form
const notificationOverrideSchema = z.object({
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  notificationSchedule: z.object({
    initialReminder: z.number().int().min(1).max(365),
    weeklyReminder: z.number().int().min(1).max(52),
    dailyReminder: z.number().int().min(1).max(14),
    finalDayReminders: z.boolean()
  })
});
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CheckCircle2,
  Zap,
  Plus,
  Edit,
  Trash2,
  Calendar
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { NoteSection } from "@/components/regulations/note-section";
import { RegulationTimeline } from "@/components/regulations/regulation-timeline";
import { EnhancedRegulationTimeline } from "@/components/regulations/enhanced-regulation-timeline";
import { WebPublishDialog } from "@/components/regulations/web-publish-dialog";
import DeadlineForm from "@/components/regulations/deadline-form";
import { CommunicationDialog } from "@/components/regulations/communication-dialog";
import { SubmissionWizard } from "@/components/regulations/submission-wizard";
import { EvidenceFiles } from "@/components/regulations/evidence-files";
import { NotificationOverrideControl } from "@/components/regulations/notification-override-control";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIES = [
  "Other",
  "Campus Safety",
  "Accounting",
  "Human Resources",
  "Student Life",
  "Academic Programs",
  "Admissions",
  "Athletics",
  "Financial Aid",
];



function RegulationDetailPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);
  const [showFullTextDialog, setShowFullTextDialog] = useState(false);
  const [showCreateDeadlineDialog, setShowCreateDeadlineDialog] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const regulationId = location.split("/")[2];
  const isAdmin = user?.role?.toLowerCase() === "admin";

  const { data: regulation, isLoading } = useQuery<RegulationWithOverride>({
    queryKey: ["/api/regulations", regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${regulationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch regulation');
      }
      return response.json();
    },
    enabled: !!user && !!regulationId,
  });

  // Fetch pending updates for this regulation
  const { data: pendingUpdates = [] } = useQuery({
    queryKey: ['/api/regulations', regulationId, 'pending-updates'],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${regulationId}/pending-updates`);
      if (!response.ok) throw new Error('Failed to fetch pending updates');
      return response.json();
    },
    enabled: !!regulationId && !!user
  });

  console.log("Regulation data:", regulation);
  console.log("User role:", user?.role, "isAdmin:", isAdmin);
  
  // Check if regulation exists 
  const hasRegulation = regulation != null;
  
  // Ensure actions is always available (initialize if missing)
  const actions = regulation?.actions || [];
  
  // Make admin tools visible if the user is an admin and regulation exists
  const categoryVisible = isAdmin && hasRegulation;
  // Note: notificationOverrideVisible removed - now using NotificationOverrideControl component
  
  console.log("Admin tools visibility check:", { 
    hasRegulation, 
    isAdmin, 
    categoryVisible,
    actionsLength: actions.length
  });

  // Note: overrideForm and overrideMutation moved to NotificationOverrideControl component

  // Placeholder for backward compatibility
  const _overrideMutation = useMutation({
    mutationFn: async (_data: z.infer<typeof notificationOverrideSchema>) => {
      if (!regulation?.id) {
        throw new Error('No regulation ID available');
      }
      
      const response = await fetch(
        `/api/regulations/${regulation.id}/notification-override`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(_data),
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to update notification override");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Override Updated",
        description: "Notification settings have been updated for this regulation.",
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

  const categoryMutation = useMutation({
    mutationFn: async (category: string) => {
      console.log('Updating category for regulation:', regulation?.id, 'to:', category);
      
      if (!regulation?.id) {
        throw new Error('No regulation ID available');
      }
      
      const response = await fetch(
        `/api/regulations/${regulation.id}/category`,
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
        description: "The category has been updated successfully.",
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
  
  const updateActionMutation = useMutation({
    mutationFn: async ({ regulationId, action }: { regulationId: number; action: RegulationAction }) => {
      const response = await fetch(
        `/api/regulations/${regulationId}/actions/${action.type}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify(action),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Action update failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || errorData.message || "Failed to update action");
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

  // Deadline management mutations
  const createDeadlineMutation = useMutation({
    mutationFn: async (deadlineData: { dueDate: string; status: string; assignedTo: number }) => {
      const response = await fetch('/api/deadlines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...deadlineData,
          regulationId: parseInt(regulationId),
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create deadline');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Deadline Created",
        description: "New deadline has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      setShowCreateDeadlineDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: async ({ id, ...deadlineData }: { id: number; dueDate?: string; status?: string; assignedTo?: number }) => {
      const response = await fetch(`/api/deadlines/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(deadlineData),
      });
      if (!response.ok) {
        throw new Error('Failed to update deadline');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Deadline Updated",
        description: "Deadline has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
      setEditingDeadline(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDeadlineMutation = useMutation({
    mutationFn: async (deadlineId: number) => {
      const response = await fetch(`/api/deadlines/${deadlineId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete deadline');
      }
    },
    onSuccess: () => {
      toast({
        title: "Deadline Deleted",
        description: "Deadline has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deadlines"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
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


  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"]
  });

  if (isLoading || deadlinesLoading) {
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

  const regulationDeadlines = deadlines.filter(d => d.regulationId === parseInt(regulationId)) || [];
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
            {/* Pending Updates Notification Banner */}
            {pendingUpdates.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-yellow-800">
                        {pendingUpdates.length} Pending Update{pendingUpdates.length > 1 ? 's' : ''} Available
                      </h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        This regulation has updates waiting for review and approval. 
                        {pendingUpdates.some((update) => update.name?.includes('MCP Engine')) && 
                          ' Some updates are from the MCP Engine with enhanced Federal Register data.'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/regulations/updates')}
                      className="bg-white hover:bg-yellow-50 border-yellow-300"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Review Updates
                    </Button>
                    {isAdmin && (
                      <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          // Scroll to the enhanced timeline section
                          const timelineElement = document.querySelector('[data-testid="enhanced-timeline"]');
                          if (timelineElement) {
                            timelineElement.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        <History className="h-4 w-4 mr-2" />
                        View Timeline
                      </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(`/audit-trail?regulationId=${regulationId}`, '_blank');
                          }}
                          className="gap-2"
                        >
                          <Shield className="h-4 w-4" />
                          Audit Trail
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Quick preview of recent updates */}
                <div className="mt-3 space-y-2">
                  {pendingUpdates.slice(0, 2).map((update) => (
                    <div key={update.id} className="flex items-center justify-between text-sm bg-white bg-opacity-50 rounded px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">{update.name}</span>
                        {update.name?.includes('MCP Engine') && (
                          <Badge variant="secondary" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            Enhanced
                          </Badge>
                        )}
                      </div>
                      <span className="text-yellow-600 text-xs">
                        {new Date(update.updateDate).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {pendingUpdates.length > 2 && (
                    <div className="text-sm text-yellow-700 text-center py-1">
                      +{pendingUpdates.length - 2} more update{pendingUpdates.length - 2 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {regulation.name || regulation.topic}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="px-3 py-1 bg-gray-100 rounded-md font-medium">
                  ID: {regulation.itemId || regulation.item_id || regulation.id || 'N/A'}
                </span>
                {categoryVisible ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Category:</span>
                    <Select
                      defaultValue={regulation.category || "Other"}
                      onValueChange={(value) => categoryMutation.mutate(value)}
                    >
                      <SelectTrigger className="w-[180px] bg-gray-100 border rounded-md hover:bg-gray-50 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {regulation.category || 'Uncategorized'}
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
                  const subject = encodeURIComponent(`Regulation ${regulation?.itemId} - ${regulation?.topic}`);
                  window.location.href = `mailto:compliance@moravian.edu?subject=${subject}`;
                }}
              >
                <Mail className="h-4 w-4" />
                Contact Compliance Office
              </Button>
            </div>

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
                    <CardTitle className="flex justify-between items-center">
                      <span>Summary</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => setShowFullTextDialog(true)}
                      >
                        <FileText className="h-4 w-4" />
                        View Full Text
                      </Button>
                    </CardTitle>
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

                {/* Enhanced Timeline for Admins, Basic Timeline for Users */}
                {isAdmin ? (
                  <div data-testid="enhanced-timeline">
                    <EnhancedRegulationTimeline regulation={regulation} />
                  </div>
                ) : (
                  <div className="border-4 border-yellow-500 p-4 rounded">
                    <div className="bg-yellow-100 border border-yellow-300 rounded p-4 mb-4 text-lg font-bold">
                      📋 Regular User - Basic Timeline
                    </div>
                    <RegulationTimeline regulation={regulation} />
                  </div>
                )}

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
                    <NoteSection regulationId={regulationId} />
                  </CardContent>
                </Card>

                {/* Additional Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {categoryVisible && (
                        <div>
                          <h3 className="font-medium text-gray-900">Admin Tools</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Enhanced version control timeline is shown above for admin users.
                            Use the timeline to view version history, compare versions, and rollback changes.
                          </p>
                        </div>
                      )}
                      
                      {/* Notification Override Control */}
                      <NotificationOverrideControl 
                        regulationId={parseInt(regulationId)} 
                        regulationName={regulation?.name || regulation?.topic || 'Unknown Regulation'} 
                      />

                      <div>
                        <h3 className="font-medium text-gray-900">Statute</h3>
                        <p className="text-gray-700 mt-1">
                          {regulation?.statute}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {regulation?.originationDate && (
                          <div>
                            <h3 className="font-medium text-gray-900">Origination Date</h3>
                            <p className="text-gray-700 mt-1">
                              {format(new Date(regulation.originationDate), "PP")}
                            </p>
                          </div>
                        )}
                        {regulation?.effectiveDate && (
                          <div>
                            <h3 className="font-medium text-gray-900">Effective Date</h3>
                            <p className="text-gray-700 mt-1">
                              {format(new Date(regulation.effectiveDate), "PP")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Agency Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Agency Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {regulation?.agency_name && (
                        <p className="text-gray-700">
                          <span className="font-medium">Agency:</span> {regulation.agency_name}
                        </p>
                      )}
                      {regulation?.agency_url && (
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
                      {regulation?.agency_contact && (
                        <p className="text-gray-700">
                          <span className="font-medium">Contact:</span> {regulation.agency_contact}
                        </p>
                      )}
                      {regulation?.agency_department && (
                        <p className="text-gray-700">
                          <span className="font-medium">Department:</span> {regulation.agency_department}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">

                {/* Actions Required Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Actions Required</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulation.actions?.map((action) => (
                        <div
                          key={action.type}
                          className={`p-4 border rounded-lg ${
                            action.required ? "border-red-200" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-2 rounded-full ${
                                  action.status === "completed"
                                    ? "bg-green-50"
                                    : "bg-blue-50"
                                }`}
                              >
                                {action.type === "attestation" ? (
                                  <Check className="h-4 w-4" />
                                ) : action.type === "website_publish" ? (
                                  <Globe className="h-4 w-4" />
                                ) : action.type === "community_communication" ? (
                                  <Mail className="h-4 w-4" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </div>
                              <span className="font-medium">
                                {action.type
                                  .split("_")
                                  .map(
                                    (word) =>
                                      word.charAt(0).toUpperCase() + word.slice(1)
                                  )
                                  .join(" ")}
                              </span>
                            </div>
                            {categoryVisible && (
                              <Switch
                                checked={action.required}
                                onCheckedChange={(required) =>
                                  updateActionMutation.mutate({
                                    regulationId,
                                    action: { ...action, required },
                                  })
                                }
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            {action.type === "attestation" ? (
                              <div className="space-y-4">
                                <div className="text-sm text-gray-600">
                                  <p>
                                    By checking this box, you attest that your
                                    institution is in compliance with all
                                    requirements specified in this regulation.
                                  </p>
                                  <p className="mt-1">
                                    This attestation will be recorded and
                                    timestamped.
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="attestation"
                                    checked={action.status === "completed"}
                                    onCheckedChange={(checked) =>
                                      handleActionStatusChange(
                                        action,
                                        checked ? "completed" : "pending"
                                      )
                                    }
                                  />
                                  <label
                                    htmlFor="attestation"
                                    className="text-sm font-medium leading-none"
                                  >
                                    I attest that we are in compliance
                                  </label>
                                </div>

                                {/* Digital signature information */}
                                {action.status === "completed" && action.completedBy && (
                                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                    <div className="text-xs text-gray-500">
                                      <div className="flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                                        <span className="text-green-600 font-medium">Digitally signed</span>
                                      </div>
                                      <div className="mt-1">
                                        <p>
                                          <span className="font-medium">Signed by:</span>{" "}
                                          {action.completedBy.fullName || action.completedBy.username}
                                        </p>
                                        <p>
                                          <span className="font-medium">Username:</span>{" "}
                                          {action.completedBy.username}
                                        </p>
                                        <p>
                                          <span className="font-medium">Date:</span>{" "}
                                          {action.completedAt 
                                            ? format(new Date(action.completedAt), "PPpp") 
                                            : "Unknown"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleActionClick(action.type)}
                              >
                                {action.type === "website_publish"
                                  ? "Publish to Website"
                                  : action.type === "community_communication"
                                  ? "Send Communication"
                                  : "Submit to Agency"}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance Status Card */}
                {(() => {
                  const complianceStatus = calculateComplianceStatus(regulation.actions || [], regulationDeadlines);
                  return (
                <Card>
                  <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span>Compliance Status</span>
                          <Badge 
                            variant={complianceStatus.level === 'critical' ? 'destructive' : 
                                   complianceStatus.level === 'warning' ? 'secondary' :
                                   complianceStatus.level === 'info' ? 'outline' : 'default'}
                            className={
                              complianceStatus.color === 'red' ? 'bg-red-100 text-red-800 border-red-200' :
                              complianceStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                              complianceStatus.color === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              'bg-green-100 text-green-800 border-green-200'
                            }
                          >
                            {complianceStatus.status === 'compliant' ? 'Compliant' :
                             complianceStatus.status === 'partial-compliance' ? 'Partial Compliance' :
                             complianceStatus.status === 'compliant-with-upcoming' ? 'Compliant' :
                             'Non-Compliant'}
                          </Badge>
                        </CardTitle>
                  </CardHeader>
                  <CardContent>
                        <div className="space-y-4">
                          <div className={`p-4 rounded-lg border-l-4 ${
                            complianceStatus.color === 'red' ? 'bg-red-50 border-red-400' :
                            complianceStatus.color === 'yellow' ? 'bg-yellow-50 border-yellow-400' :
                            complianceStatus.color === 'blue' ? 'bg-blue-50 border-blue-400' :
                            'bg-green-50 border-green-400'
                          }`}>
                            <div className="flex items-center gap-2">
                              {complianceStatus.color === 'red' ? (
                                <AlertCircle className="h-5 w-5 text-red-600" />
                              ) : complianceStatus.color === 'yellow' ? (
                                <Clock className="h-5 w-5 text-yellow-600" />
                              ) : complianceStatus.color === 'blue' ? (
                                <Calendar className="h-5 w-5 text-blue-600" />
                              ) : (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              )}
                              <span className={`font-medium ${
                                complianceStatus.color === 'red' ? 'text-red-800' :
                                complianceStatus.color === 'yellow' ? 'text-yellow-800' :
                                complianceStatus.color === 'blue' ? 'text-blue-800' :
                                'text-green-800'
                              }`}>
                                {complianceStatus.message}
                              </span>
                            </div>
                          </div>
                          
                          {/* Quick stats */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-gray-500">Required Actions</p>
                              <p className="font-medium">
                                {regulation.actions?.filter(a => a.status === 'completed' && a.required).length || 0} / {regulation.actions?.filter(a => a.required).length || 0} Complete
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-gray-500">Active Deadlines</p>
                              <p className="font-medium">
                                {regulationDeadlines.filter(d => d.status === 'pending').length} Pending
                              </p>
                            </div>
                          </div>
                        </div>
                  </CardContent>
                </Card>
                  );
                })()}

                {/* Deadlines Card */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                    <CardTitle>Deadlines</CardTitle>
                      {isAdmin && (
                        <Button
                          size="sm"
                          onClick={() => setShowCreateDeadlineDialog(true)}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Deadline
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulationDeadlines.map((deadline) => (
                        <div
                          key={deadline.id}
                          className="p-4 border rounded-lg space-y-3"
                        >
                          {/* Main deadline info */}
                          <div className="flex items-start gap-3">
                          <div
                              className={`p-2 rounded-full flex-shrink-0 ${
                              deadline.status === "completed"
                                ? "bg-green-50"
                                : deadline.status === "overdue"
                                ? "bg-red-50"
                                : "bg-yellow-50"
                            }`}
                          >
                            {deadline.status === "completed" ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : deadline.status === "overdue" ? (
                              <AlertCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <Clock className="h-5 w-5 text-yellow-500" />
                            )}
                          </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 break-words">
                              Due: {format(new Date(deadline.dueDate), "PP")}
                            </p>
                            <span
                                className={`inline-block text-sm font-medium px-2 py-1 rounded-full mt-1 ${
                                deadline.status === "completed"
                                    ? "bg-green-100 text-green-700"
                                  : deadline.status === "overdue"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {deadline.status.charAt(0).toUpperCase() +
                                deadline.status.slice(1)}
                            </span>
                          </div>
                          </div>
                          
                          {/* Action buttons */}
                          {isAdmin && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                              {deadline.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateDeadlineMutation.mutate({ 
                                    id: deadline.id, 
                                    status: "completed" 
                                  })}
                                  className="gap-2 text-xs"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Complete
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingDeadline(deadline)}
                                className="gap-2 text-xs"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this deadline?')) {
                                    deleteDeadlineMutation.mutate(deadline.id);
                                  }
                                }}
                                className="gap-2 text-xs text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {regulationDeadlines.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No deadlines set for this regulation</p>
                          {isAdmin && (
                            <p className="text-sm mt-1">Click "Add Deadline" to create one</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence Files Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evidence Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EvidenceFiles regulationId={regulationId} />
                  </CardContent>
                </Card>

                {/* Notes Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Notes & Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <NoteSection regulationId={regulationId} />
                  </CardContent>
                </Card>

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
            onComplete={() => {
              const action = regulation.actions?.find(a => a.type === 'website_publish');
              if (action) {
                handleActionStatusChange(action, 'completed');
              }
              setShowWebPublishDialog(false);
            }}
          />
          <CommunicationDialog
            regulation={regulation}
            open={showCommunicationDialog}
            onOpenChange={setShowCommunicationDialog}
            onComplete={() => {
              const action = regulation.actions?.find(a => a.type === 'community_communication');
              if (action) {
                handleActionStatusChange(action, 'completed');
              }
              setShowCommunicationDialog(false);
            }}
          />
          <SubmissionWizard
            regulation={regulation}
            open={showSubmissionWizard}
            onOpenChange={(open) => {
              setShowSubmissionWizard(open);
              // If dialog was closed by successful submission, mark action as completed
              if (!open && showSubmissionWizard) {
                const action = regulation.actions?.find(a => a.type === 'agency_submission');
                if (action) {
                  handleActionStatusChange(action, 'completed');
                }
              }
            }}
          />
          
          {/* Full Regulation Text Dialog */}
          <Dialog open={showFullTextDialog} onOpenChange={setShowFullTextDialog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Full Regulation Text</DialogTitle>
                <DialogDescription>
                  Complete text of {regulation.name || regulation.topic}
                </DialogDescription>
              </DialogHeader>
              <div className="prose prose-sm max-w-none mt-4 text-gray-800 whitespace-pre-wrap">
                {regulation.regulationText ? (
                  <div className="space-y-4">
                    {regulation.regulationText}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">
                    Full regulation text is not available.
                  </p>
                )}
              </div>
              <DialogFooter className="mt-6">
                <Button onClick={() => setShowFullTextDialog(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Deadline Dialog */}
          <Dialog open={showCreateDeadlineDialog} onOpenChange={setShowCreateDeadlineDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Deadline</DialogTitle>
                <DialogDescription>
                  Add a new deadline for {regulation.name || regulation.topic}
                </DialogDescription>
              </DialogHeader>
              <DeadlineForm
                regulationId={parseInt(regulationId)}
                onSubmit={(data) => createDeadlineMutation.mutate(data)}
                onCancel={() => setShowCreateDeadlineDialog(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Edit Deadline Dialog */}
          <Dialog open={!!editingDeadline} onOpenChange={() => setEditingDeadline(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Deadline</DialogTitle>
                <DialogDescription>
                  Update deadline for {regulation.name || regulation.topic}
                </DialogDescription>
              </DialogHeader>
              {editingDeadline && (
                <DeadlineForm
                  regulationId={parseInt(regulationId)}
                  initialData={editingDeadline}
                  onSubmit={(data) => updateDeadlineMutation.mutate({ id: editingDeadline.id, ...data })}
                  onCancel={() => setEditingDeadline(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default RegulationDetailPage;