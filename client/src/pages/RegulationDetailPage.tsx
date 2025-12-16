import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { marked } from "marked";
import type { Regulation, Deadline, RegulationAction } from "@shared/schema";

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Helper to safely render markdown as HTML
function renderMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}

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
  responsibleOffice?: string;
  responsibleOfficeEmail?: string;
  escalationTarget?: string;
  escalationEmail?: string;
};

import Navigation from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Zap,
  Plus,
  Edit,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Scale,
  FolderOpen,
  MessageSquare,
  ListTodo,
  FileCheck
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { EscalateIssueDialog } from "@/components/regulations/escalate-issue-dialog";
import { SendAttestationDialog } from "@/components/regulations/send-attestation-dialog";
import { ComplianceTasksPanel } from "@/components/regulations/compliance-tasks-panel";
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
  const [showCreateDeadlineDialog, setShowCreateDeadlineDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [showAttestationDialog, setShowAttestationDialog] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  
  // Accordion section states - Summary expanded by default, others collapsed
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [complianceTasksOpen, setComplianceTasksOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [deadlinesOpen, setDeadlinesOpen] = useState(false);
  const [evidenceNotesOpen, setEvidenceNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fullTextOpen, setFullTextOpen] = useState(false);
  
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

  // Fetch users for owner assignment dropdown (admins only)
  const { data: users = [] } = useQuery<Array<{ id: number; username: string; firstName?: string; lastName?: string; role: string }>>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
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

  const ownerMutation = useMutation({
    mutationFn: async (ownerId: string | null) => {
      if (!regulation?.id) {
        throw new Error('No regulation ID available');
      }
      
      const response = await fetch(
        `/api/regulations/${regulation.id}/owner`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ownerId: ownerId === "unassigned" ? null : ownerId }),
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to update owner");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Owner Updated",
        description: "The regulation has been assigned successfully.",
      });
      // Force refetch of regulation data
      queryClient.invalidateQueries({ queryKey: ["/api/regulations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulationId] });
      queryClient.refetchQueries({ queryKey: ["/api/regulations", regulationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
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
        fullName,
        email: user.email,
        completedAt: now.toISOString()
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
                  <div className="flex items-center gap-4">
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Assigned to:</span>
                      <Select
                        key={`owner-${regulation.ownerId || 'none'}`}
                        value={regulation.ownerId?.toString() || "unassigned"}
                        onValueChange={(value) => ownerMutation.mutate(value)}
                      >
                        <SelectTrigger className="w-[200px] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                          <SelectValue placeholder="Select owner...">
                            {regulation.ownerId 
                              ? users.find(u => u.id === regulation.ownerId)?.username || `User ${regulation.ownerId}`
                              : "— Unassigned —"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            <span className="text-gray-500">— Unassigned —</span>
                          </SelectItem>
                          {users
                            .filter(u => u.role === 'compliance_officer' || u.role === 'admin')
                            .map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.firstName && user.lastName 
                                  ? `${user.firstName} ${user.lastName}` 
                                  : user.username}
                                <span className="text-xs text-gray-400 ml-2">
                                  ({user.role === 'admin' ? 'Admin' : 'Officer'})
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {regulation.category || 'Uncategorized'}
                  </span>
                )}
              </div>
              {/* Additional metadata row */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                {/* Statute */}
                {regulation?.statute && (
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Statute:</span>
                    <span className="font-medium text-gray-700">{regulation.statute}</span>
                  </div>
                )}
                {/* Agency */}
                {regulation?.agency_name && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-500">Agency:</span>
                    <span>{regulation.agency_name}</span>
                    {regulation?.agency_url && (
                      <a
                        href={regulation.agency_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              {/* Notification toggle - Admin only */}
              {isAdmin && (
                <div className="mt-3">
                  <NotificationOverrideControl 
                    regulationId={parseInt(regulationId)} 
                    regulationName={regulation?.name || regulation?.topic || 'Unknown Regulation'} 
                  />
                </div>
              )}
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
              {isAdmin && (
                <>
                  <Button
                    variant="default"
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowAttestationDialog(true)}
                  >
                    <Mail className="h-4 w-4" />
                    Send Attestation
                  </Button>
                  <Button
                    variant="default"
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => setShowEscalateDialog(true)}
                  >
                    <AlertCircle className="h-4 w-4" />
                    Escalate Issue
                  </Button>
                </>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                HERO SECTION - Compliance Status + Quick Actions
            ═══════════════════════════════════════════════════════════════════ */}
            {(() => {
              const complianceStatus = calculateComplianceStatus(regulation.actions || [], regulationDeadlines);
              const requiredActions = regulation.actions?.filter(a => a.required) || [];
              const completedActions = requiredActions.filter(a => a.status === 'completed');
              const nextDeadline = regulationDeadlines
                .filter(d => d.status === 'pending')
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
              
              // Find the attestation action and who completed it (DRI signature)
              const attestationAction = regulation.actions?.find(a => a.type === 'attestation');
              const attestedBy = attestationAction?.status === 'completed' && attestationAction?.completedBy 
                ? attestationAction.completedBy 
                : null;
              
              return (
                <div className={`rounded-xl border-2 p-6 mb-6 ${
                  complianceStatus.color === 'red' ? 'bg-red-50 border-red-300' :
                  complianceStatus.color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
                  complianceStatus.color === 'blue' ? 'bg-blue-50 border-blue-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  {/* Status Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-full ${
                        complianceStatus.color === 'red' ? 'bg-red-100' :
                        complianceStatus.color === 'yellow' ? 'bg-yellow-100' :
                        complianceStatus.color === 'blue' ? 'bg-blue-100' :
                        'bg-green-100'
                      }`}>
                        {complianceStatus.color === 'red' ? (
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        ) : complianceStatus.color === 'yellow' ? (
                          <Clock className="h-6 w-6 text-yellow-600" />
                        ) : complianceStatus.color === 'blue' ? (
                          <Calendar className="h-6 w-6 text-blue-600" />
                        ) : (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h2 className={`text-xl font-bold ${
                          complianceStatus.color === 'red' ? 'text-red-800' :
                          complianceStatus.color === 'yellow' ? 'text-yellow-800' :
                          complianceStatus.color === 'blue' ? 'text-blue-800' :
                          'text-green-800'
                        }`}>
                          {complianceStatus.status === 'compliant' ? 'Compliant' :
                           complianceStatus.status === 'partial-compliance' ? 'Partial Compliance' :
                           complianceStatus.status === 'compliant-with-upcoming' ? 'Compliant' :
                           'Non-Compliant'}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {completedActions.length}/{requiredActions.length} actions complete
                          {nextDeadline && ` • Next deadline ${format(new Date(nextDeadline.dueDate), "MMM d")}`}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => setShowEscalateDialog(true)}
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Escalate
                      </Button>
                    )}
                  </div>
                  
                  {/* DRI Attestation Signature - Prominent display of who attested */}
                  {attestedBy ? (
                    <div className="bg-white/80 rounded-lg p-4 mb-4 border border-green-200 flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <FileCheck className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Attested by (Directly Responsible Individual)</p>
                        <p className="text-xl font-bold text-slate-800">
                          {attestedBy.fullName || attestedBy.username || attestedBy.email || 'Unknown'}
                        </p>
                        {attestedBy.email && attestedBy.fullName && (
                          <p className="text-sm text-gray-600">{attestedBy.email}</p>
                        )}
                        {attestedBy.completedAt ? (
                          <p className="text-sm text-green-700 font-medium mt-1">
                            Signed: {format(new Date(attestedBy.completedAt), "EEEE, MMMM d, yyyy 'at' h:mm:ss a")}
                          </p>
                        ) : attestationAction?.completedAt ? (
                          <p className="text-sm text-green-700 font-medium mt-1">
                            Signed: {format(new Date(attestationAction.completedAt), "EEEE, MMMM d, yyyy 'at' h:mm:ss a")}
                          </p>
                        ) : (
                          <button
                            onClick={() => attestationAction && handleActionStatusChange(attestationAction, 'completed')}
                            className="text-sm text-amber-600 hover:text-amber-700 underline mt-1"
                          >
                            Click to update signature with full details
                          </button>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => attestationAction && handleActionStatusChange(attestationAction, 'completed')}
                        >
                          Re-attest
                        </Button>
                      )}
                    </div>
                  ) : attestationAction ? (
                    <div className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200 flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <FileCheck className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Attestation Required</p>
                        <p className="text-base font-medium text-amber-800">No attestation on file</p>
                        <p className="text-sm text-amber-600">A DRI must attest to institutional compliance</p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleActionStatusChange(attestationAction, 'completed')}
                      >
                        <FileCheck className="h-4 w-4 mr-1" />
                        Attest Now
                      </Button>
                    </div>
                  ) : null}

                  {/* Quick Actions Row */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {regulation.actions?.map((action) => {
                      const isComplete = action.status === 'completed';
                      const isRequired = action.required;
                      return (
                        <button
                          key={action.type}
                          onClick={() => {
                            if (action.type === 'attestation') {
                              if (!isComplete) {
                                handleActionStatusChange(action, 'completed');
                              }
                            } else {
                              handleActionClick(action.type);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isComplete 
                              ? 'bg-green-100 text-green-800 border border-green-300' 
                              : isRequired
                              ? 'bg-white text-gray-800 border-2 border-red-300 hover:border-red-400'
                              : 'bg-white/50 text-gray-600 border border-gray-300 hover:bg-white'
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : action.type === 'attestation' ? (
                            <FileCheck className="h-4 w-4" />
                          ) : action.type === 'website_publish' ? (
                            <Globe className="h-4 w-4" />
                          ) : action.type === 'community_communication' ? (
                            <Mail className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          {action.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          {/* Attestation is always required - no toggle. Other actions can be toggled by admin */}
                          {isAdmin && action.type !== 'attestation' && (
                            <Switch
                              checked={action.required}
                              onCheckedChange={(required) => {
                                updateActionMutation.mutate({
                                  regulationId,
                                  action: { ...action, required },
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-1 scale-75"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Deadline Highlight */}
                  {nextDeadline && (
                    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-white">
                      <Calendar className={`h-5 w-5 ${nextDeadline.isDefault ? 'text-orange-500' : 'text-blue-500'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Next: {format(new Date(nextDeadline.dueDate), "MMMM d, yyyy")}
                          {nextDeadline.isDefault && <span className="ml-2 text-xs text-orange-600">🎃 Default</span>}
                        </p>
                        {nextDeadline.description && (
                          <p className="text-xs text-gray-500">{nextDeadline.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {Math.ceil((new Date(nextDeadline.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════════════════
                ACCORDION SECTIONS
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
              
              {/* SUMMARY - Expanded by default */}
              <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Summary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullTextOpen(!fullTextOpen);
                      }}
                    >
                      Full Text
                    </Button>
                    {summaryOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                  <div 
                    className="prose prose-sm max-w-none text-gray-700 pt-4"
                    dangerouslySetInnerHTML={{ 
                      __html: regulation.summary 
                        ? renderMarkdown(regulation.summary) 
                        : "No summary available." 
                    }}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* COMPLIANCE TASKS - For complex regulations like Clery Act */}
              <Collapsible open={complianceTasksOpen} onOpenChange={setComplianceTasksOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ListTodo className="h-5 w-5 text-indigo-600" />
                    <span className="font-semibold text-gray-900">Compliance Tasks</span>
                    <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">
                      Complex Workflow
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {complianceTasksOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b p-4">
                  <ComplianceTasksPanel
                    regulationId={regulation.id}
                    regulationName={regulation.name || regulation.topic || 'Unknown'}
                    isAdmin={isAdmin}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* REQUIREMENTS */}
              <Collapsible open={requirementsOpen} onOpenChange={setRequirementsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ListTodo className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">Requirements</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {regulation.requirementsUrl && (
                      <a
                        href={regulation.requirementsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {requirementsOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                  <div className="prose max-w-none pt-4">
                    {regulation.requirements ? (
                      <div 
                        className="text-gray-700"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(regulation.requirements) }}
                      />
                    ) : (
                      <p className="text-gray-500 italic">No specific requirements listed.</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* DEADLINES */}
              <Collapsible open={deadlinesOpen} onOpenChange={setDeadlinesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-gray-900">Deadlines</span>
                    <Badge variant="secondary" className="text-xs">
                      {regulationDeadlines.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreateDeadlineDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    )}
                    {deadlinesOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                  <div className="space-y-3 pt-4">
                    {regulationDeadlines.map((deadline) => (
                      <div
                        key={deadline.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          deadline.isDefault ? 'bg-orange-50 border-orange-200' :
                          deadline.status === 'completed' ? 'bg-green-50 border-green-200' :
                          deadline.status === 'overdue' ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {deadline.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : deadline.status === 'overdue' ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className={`h-5 w-5 ${deadline.isDefault ? 'text-orange-500' : 'text-yellow-500'}`} />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{format(new Date(deadline.dueDate), "MMMM d, yyyy")}</p>
                            {deadline.description && <p className="text-xs text-gray-500">{deadline.description}</p>}
                            {deadline.isDefault && <span className="text-xs text-orange-600">🎃 Default Oct 31</span>}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            {deadline.status !== 'completed' && (
                              <Button size="sm" variant="ghost" onClick={() => updateDeadlineMutation.mutate({ id: deadline.id, status: 'completed' })}>
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setEditingDeadline(deadline)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm('Delete?') && deleteDeadlineMutation.mutate(deadline.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {regulationDeadlines.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">No deadlines set</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* EVIDENCE & NOTES */}
              <Collapsible open={evidenceNotesOpen} onOpenChange={setEvidenceNotesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-gray-900">Evidence & Notes</span>
                  </div>
                  {evidenceNotesOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                  <div className="pt-4 space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" /> Evidence Files
                      </h4>
                      <EvidenceFiles regulationId={regulationId} />
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Notes & Comments
                      </h4>
                      <NoteSection regulationId={regulationId} />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* VERSION HISTORY */}
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">Version History</span>
                    <Badge variant="secondary" className="text-xs">
                      v{regulation.versionNumber || 1}
                    </Badge>
                  </div>
                  {historyOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                  <div className="pt-4">
                    {isAdmin ? (
                      <EnhancedRegulationTimeline regulation={regulation} />
                    ) : (
                      <RegulationTimeline regulation={regulation} />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* FULL REGULATION TEXT */}
              <Collapsible open={fullTextOpen} onOpenChange={setFullTextOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">Full Regulation Text</span>
                  </div>
                  {fullTextOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                  <div className="prose prose-sm max-w-none pt-4 text-gray-800">
                    {regulation.regulationText ? (
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(regulation.regulationText) }} />
                    ) : (
                      <p className="text-gray-500 italic">Full regulation text is not available.</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* SUBMISSION GUIDELINES - Only show if content exists */}
              {regulation.submissionGuidelines && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-600" />
                      <span className="font-semibold text-gray-900">Submission Guidelines</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="bg-white rounded-b-lg border-x border-b px-4 pb-4">
                    <div className="prose max-w-none pt-4" dangerouslySetInnerHTML={{ __html: regulation.submissionGuidelines }} />
                  </CollapsibleContent>
                </Collapsible>
              )}

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

          {/* Escalate Issue Dialog */}
          <EscalateIssueDialog
            open={showEscalateDialog}
            onOpenChange={setShowEscalateDialog}
            regulation={{
              id: regulation.id,
              name: regulation.name,
              topic: regulation.topic,
              responsibleOffice: regulation.responsibleOffice,
              responsibleOfficeEmail: regulation.responsibleOfficeEmail,
              escalationTarget: regulation.escalationTarget,
              escalationEmail: regulation.escalationEmail,
              ownerId: regulation.ownerId,
              actions: regulation.actions,
            }}
            deadlines={regulationDeadlines}
            assignedUser={regulation.ownerId ? users.find(u => u.id === regulation.ownerId) : null}
          />

          {/* Send Attestation Request Dialog */}
          <SendAttestationDialog
            open={showAttestationDialog}
            onOpenChange={setShowAttestationDialog}
            regulationId={regulation.id}
            regulationName={regulation.name || regulation.topic || 'Unknown Regulation'}
            riskLevel={(regulation as any).riskLevel || 'medium'}
            assignedUserId={regulation.ownerId || undefined}
            responsibleOffice={regulation.responsibleOffice}
            responsibleOfficeEmail={regulation.responsibleOfficeEmail}
          />
        </>
      )}
    </div>
  );
}

export default RegulationDetailPage;