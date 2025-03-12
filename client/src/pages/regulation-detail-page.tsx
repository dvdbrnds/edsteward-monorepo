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
import type { Regulation, Deadline, Guide, RegulationAction } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Clock4,
  Ban
} from "lucide-react";
import CircularProgress from "@/components/common/circular-progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, differenceInDays } from "date-fns";
import { marked } from 'marked';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { NoteSection } from "@/components/regulations/note-section";
import { RegulationChanges } from "@/components/regulations/regulation-changes";
import { RegulationTimeline } from "@/components/regulations/regulation-timeline";

/**
 * @interface RegulationWithOverride
 * @extends {Regulation}
 * @description Extends the base Regulation type with notification override capabilities
 */
interface RegulationWithOverride extends Regulation {
  notificationOverride?: {
    email: string | null;
    phone: string | null;
  };
  notificationSchedule?: {
    initialReminder: number;
    weeklyReminder: number;
    dailyReminder: number;
    finalDayReminders: boolean;
  }
  actions?: RegulationAction[];
}

/**
 * Calculates the compliance score for a regulation based on various factors
 * @param {Regulation | undefined} regulation - The regulation to calculate the score for
 * @param {Deadline[]} deadlines - Associated deadlines for the regulation
 * @returns {Object} The calculated score and breakdown
 */
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

const notificationOverrideSchema = z.object({
  email: z.string().email("Invalid email").optional().nullable(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number").optional().nullable(),
  notificationSchedule: z.object({
    initialReminder: z.number().min(1).max(365).optional(),
    weeklyReminder: z.number().min(1).max(90).optional(),
    dailyReminder: z.number().min(1).max(30).optional(),
    finalDayReminders: z.boolean().optional()
  }).optional().nullable()
});

type NotificationOverride = z.infer<typeof notificationOverrideSchema>;

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

interface ActionButtonProps {
  action: RegulationAction;
  regulationId: number;
  isAdmin: boolean;
  onToggle?: (enabled: boolean) => void;
  onStatusChange?: (status: RegulationAction['status']) => void;
  onRequiredChange?: (required: boolean) => void;
}

function ActionButton({ action, regulationId, isAdmin, onToggle, onStatusChange, onRequiredChange }: ActionButtonProps) {
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

  const getStatusIcon = () => {
    switch (action.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock4 className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Clock4 className="h-4 w-4 text-gray-400" />;
    }
  };

  const getActionLabel = () => {
    return action.type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={`flex items-center justify-between p-3 border rounded-lg ${!action.enabled ? 'bg-gray-50' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${action.enabled ? 'bg-blue-50' : 'bg-gray-100'}`}>
          {getIcon()}
        </div>
        <div>
          <p className="font-medium flex items-center gap-2">
            {getActionLabel()}
            {action.required && <span className="text-xs text-red-500">*Required</span>}
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {getStatusIcon()}
            <span>{action.status.charAt(0).toUpperCase() + action.status.slice(1)}</span>
          </div>
        </div>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Select
            value={action.status}
            onValueChange={(value) => onStatusChange?.(value as RegulationAction['status'])}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle?.(!action.enabled)}
            title={action.enabled ? 'Disable action' : 'Enable action'}
          >
            {action.enabled ? (
              <ToggleRight className="h-5 w-5 text-green-500" />
            ) : (
              <ToggleLeft className="h-5 w-5 text-gray-400" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRequiredChange?.(!action.required)}
            title={action.required ? 'Make optional' : 'Make required'}
          >
            {action.required ? (
              <Check className="h-5 w-5 text-red-500" />
            ) : (
              <Ban className="h-5 w-5 text-gray-400" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function RegulationDetailPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const regulationId = location.split("/")[2];


  if (!user) {
    navigate("/auth");
    return null;
  }

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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const overrideForm = useForm<NotificationOverride>({
    resolver: zodResolver(notificationOverrideSchema),
    defaultValues: {
      email: regulation?.notificationOverride?.email || "",
      phone: regulation?.notificationOverride?.phone || "",
      notificationSchedule: regulation?.notificationSchedule || {
        initialReminder: 90,
        weeklyReminder: 30,
        dailyReminder: 7,
        finalDayReminders: true
      }
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: NotificationOverride) => {
      const response = await fetch(
        `/api/regulations/${regulation?.id}/notification-override`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
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
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulation?.id] });
    },
    onError: (error) => {
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
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || errorJson.error || 'Failed to update category');
        } catch (e) {
          throw new Error(`Failed to update category: ${errorText}`);
        }
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Category Updated",
        description: "The regulation category has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulation?.id] });
    },
    onError: (error: Error) => {
      console.error("Error updating category:", error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: async ({ regulationId, action }: { regulationId: number, action: RegulationAction }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/regulations", regulation?.id] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const regulationDeadlines = deadlines?.filter(d => d.regulationId === regulation?.id) || [];
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
                {regulation?.name || regulation?.topic}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  ID: {regulation?.itemId}
                </span>
                {user?.role === "admin" ? (
                  <Select
                    defaultValue={regulation?.category}
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
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {regulation?.category}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regulation?.regulationUrl && (
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
                  const subject = encodeURIComponent(`Regulation ${regulation?.itemId} - ${regulation?.topic}`);
                  window.location.href = `mailto:compliance@moravian.edu?subject=${subject}`;
                }}
              >
                <Mail className="h-4 w-4" />
                Contact Compliance Office
              </Button>
            </div>

            <RegulationTimeline regulation={regulation} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      {regulation?.summary
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

                <Card>
                  <CardHeader>
                    <CardTitle>Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <div className="space-y-4">
                        {regulation?.requirements ? (
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

                <Card>
                  <CardHeader>
                    <CardTitle>Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {user?.role === "admin" && (
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
                          {regulation?.statuteIds && (
                            <span className="block text-sm text-gray-500">
                              Reference: {regulation.statuteIds}
                            </span>
                          )}
                        </p>
                      </div>

                      {regulation?.filingDeadlines && regulation.filingDeadlines.length > 0 && (
                        <div>
                          <h3 className="font-medium text-gray-900">Filing Deadlines</h3>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {regulation.filingDeadlines.map((deadline, index) => (
                              <li key={index} className="text-gray-700">
                                {deadline.date}: {deadline.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {regulation?.reportingFrequency && (
                        <div>
                          <h3 className="font-medium text-gray-900">Reporting Frequency</h3>
                          <p className="text-gray-700 mt-1">{regulation.reportingFrequency}</p>
                        </div>
                      )}

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
                        {regulation?.lastUpdated && (
                          <div>
                            <h3 className="font-medium text-gray-900">Last Updated</h3>
                            <p className="text-gray-700 mt-1">
                              {format(new Date(regulation.lastUpdated), "PP")}
                            </p>
                          </div>
                        )}
                        {regulation?.nextReviewDate && (
                          <div>
                            <h3 className="font-medium text-gray-900">Next Review Date</h3>
                            <p className="text-gray-700 mt-1">
                              {format(new Date(regulation.nextReviewDate), "PP")}
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-900">Agency Information</h3>
                        <div className="mt-2 space-y-2">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Submission Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GuideContent />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Diary</CardTitle>
                    <CardDescription>
                      Keep a running journal of how this regulation affects your institution. Use this space to document observations, challenges, and progress in meeting compliance requirements.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NoteSection regulationId={Number(regulationId)} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Deadlines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulationDeadlines.map((deadline) => {
                        const status = getDeadlineStatus(deadline);
                        return (
                          <div
                            key={deadline.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {status.icon}
                              <div>
                                <p className="font-medium">
                                  Due: {format(new Date(deadline.dueDate), "PP")}
                                </p>
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}>
                                  {status.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {regulationDeadlines.length === 0 && (
                        <p className="text-gray-500 italic">No deadlines set</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
                          regulationId={regulation.id}
                          isAdmin={user?.role === "admin"}
                          onToggle={(enabled) => {
                            updateActionMutation.mutate({
                              regulationId: regulation.id,
                              action: { ...action, enabled }
                            });
                          }}
                          onStatusChange={(status) => {
                            updateActionMutation.mutate({
                              regulationId: regulation.id,
                              action: { ...action, status }
                            });
                          }}
                          onRequiredChange={(required) => {
                            updateActionMutation.mutate({
                              regulationId: regulation.id,
                              action: { ...action, required }
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
                {nextDeadline && nextDeadline.status !== "completed" && (
                  <Card className="border-[#00267A]">
                    <CardHeader>
                      <CardTitle className="text-[#00267A]">Action Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          Next deadline: {format(new Date(nextDeadline.dueDate), "PP")}
                        </p>
                        <div className="flex flex-col gap-3">
                          <Button
                            className="w-full"
                            onClick={() => navigate(`/compliance-wizard/${regulation?.id}`)}
                          >
                            Submit Compliance Report
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {user?.role === "admin" && (
                  <Card className="border-2 border-[#5B2C8F] shadow-md bg-purple-50/30 relative hover:bg-purple-50/50 transition-colors">
                    <div className="absolute top-3 right-3 bg-[#5B2C8F] text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Admin Only
                    </div>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-[#5B2C8F]">
                        <Bell className="h-5 w-5" />
                        Notification Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="mb-6 space-y-2">
                          <h3 className="font-medium">Reminder Schedule</h3>
                          <p className="text-sm text-gray-600">
                            Configure when reminder notifications are sent for this regulation.
                            Leave empty to use system defaults.
                          </p>
                        </div>

                        <Form {...overrideForm}>
                          <form onSubmit={overrideForm.handleSubmit((data) => overrideMutation.mutate(data))} className="space-y-6">
                            <FormField
                              control={overrideForm.control}
                              name="notificationSchedule.initialReminder"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Initial Reminder (days before)</FormLabel>
                                  <FormControl>
                                    <Slider
                                      min={1}
                                      max={365}
                                      step={1}
                                      value={[field.value || 90]}
                                      onValueChange={([value]) => field.onChange(value)}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Send first reminder {field.value || 90} days before deadline
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={overrideForm.control}
                              name="notificationSchedule.weeklyReminder"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Weekly Reminders Start (days before)</FormLabel>
                                  <FormControl>
                                    <Slider
                                      min={1}
                                      max={90}
                                      step={1}
                                      value={[field.value || 30]}
                                      onValueChange={([value]) => field.onChange(value)}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Start weekly reminders {field.value || 30} days before deadline
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={overrideForm.control}
                              name="notificationSchedule.dailyReminder"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Daily Reminders Start (days before)</FormLabel>
                                  <FormControl>
                                    <Slider
                                      min={1}
                                      max={30}
                                      step={1}
                                      value={[field.value || 7]}
                                      onValueChange={([value]) => field.onChange(value)}
                                                                     className="w-full"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Start daily reminders {field.value || 7} days before deadline
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={overrideForm.control}
                              name="notificationSchedule.finalDayReminders"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">Final Day Reminders</FormLabel>
                                    <FormDescription>
                                      Send three reminders on the final day (9am, 1pm, 5pm)
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <Button
                              type="submit"
                              className="w-full"                              disabled={overrideMutation.isPending}
                            >
                              {overrideMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Save Notification Settings"
                              )}
                            </Button>
                          </form>
                        </Form>
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

function GuideContent() {
  const { data: guides, isLoading } = useQuery<Guide[]>({
    queryKey: ["/api/guides", { category: "submission" }],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
      </div>
    );
  }

  const submissionGuide = guides?.find(guide => guide.category === "submission");

  if (!submissionGuide) {
    return (
      <div className="p-4 text-gray-600">
        <p>No submission guidelines available for this regulation.</p>
        <p className="mt-2">Please contact the compliance office for assistance with your submission.</p>
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: marked.parse(submissionGuide.content) }}
    />
  );
}

type StatusType = {
  icon: JSX.Element;
  label: string;
  className: string;
};

function getDeadlineStatus(deadline: Deadline): StatusType {
  const daysLeft = differenceInDays(new Date(deadline.dueDate), new Date());
  if (daysLeft < 0) {
    return { icon: <AlertCircle className="h-5 w-5 text-red-500" />, label: "Overdue", className: "bg-red-100 text-red-500" };
  } else if (daysLeft <= 7) {
    return { icon: <Clock className="h-5 w-5 text-yellow-500" />, label: "Approaching", className: "bg-yellow-100 text-yellow-500" };
  } else {
    return { icon: <CheckCircle className="h-5 w-5 text-green-500" />, label: "Upcoming", className: "bg-green-100 text-green-500" };
  }
}