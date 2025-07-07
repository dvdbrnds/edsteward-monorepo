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
  const isAdmin = user?.role === "admin";
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
                Print Regulation Details
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-2"
                onClick={() => setShowVersionHistory(true)}
              >
                <History className="h-4 w-4" />
                View Version History
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Regulation Details</CardTitle>
                    <CardDescription>
                      Key information about this regulation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Statute</h3>
                        <p className="mt-1">{regulation?.statute || "Not specified"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Jurisdiction</h3>
                        <p className="mt-1 capitalize">{regulation?.jurisdiction || "Not specified"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Category</h3>
                        <p className="mt-1">{regulation?.category || "Not categorized"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Agency</h3>
                        <p className="mt-1">{regulation?.agency_name || "Not specified"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
                        <p className="mt-1">
                          {regulation?.lastUpdated
                            ? format(new Date(regulation.lastUpdated), "MMMM d, yyyy")
                            : "Not recorded"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Effective Date</h3>
                        <p className="mt-1">
                          {regulation?.effectiveDate
                            ? format(new Date(regulation.effectiveDate), "MMMM d, yyyy")
                            : "Not specified"}
                        </p>
                      </div>
                    </div>

                    {regulation?.summary && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Summary</h3>
                        <div 
                          className="mt-1 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: marked.parse(regulation.summary || '') 
                          }}
                        />
                      </div>
                    )}

                    {regulation?.requirements && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Requirements</h3>
                        <div 
                          className="mt-1 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: marked.parse(regulation.requirements || '') 
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Actions</CardTitle>
                    <CardDescription>
                      Steps required to maintain compliance with this regulation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {regulation?.actions && regulation.actions.length > 0 ? (
                      <div className="space-y-3">
                        {regulation.actions.map((action) => (
                          <ActionButton 
                            key={action.type} 
                            action={action} 
                            regulationId={regulation.id}
                            isAdmin={isAdmin}
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
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No compliance actions have been defined for this regulation.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <NoteSection regulationId={regulation?.id} userId={user?.id} />
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Score</CardTitle>
                    <CardDescription>
                      Overall compliance readiness assessment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <CircularProgress 
                      value={complianceScore.score} 
                      maxValue={100} 
                      radius={60} 
                      strokeWidth={10}
                      label={`${complianceScore.score}%`}
                      className="mb-4"
                    />

                    <div className="w-full space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Deadlines</span>
                        <span>{complianceScore.breakdown.deadlines}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${complianceScore.breakdown.deadlines}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Documentation</span>
                        <span>{complianceScore.breakdown.documentation}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${complianceScore.breakdown.documentation}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Review Status</span>
                        <span>{complianceScore.breakdown.review}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full"
                          style={{ width: `${complianceScore.breakdown.review}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Deadlines</CardTitle>
                    <CardDescription>
                      Important dates for this regulation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {regulationDeadlines && regulationDeadlines.length > 0 ? (
                      <div className="space-y-4">
                        {regulationDeadlines.map((deadline) => {
                          const isPast = new Date(deadline.dueDate) < new Date();
                          const isWithinMonth = differenceInDays(new Date(deadline.dueDate), new Date()) <= 30;
                          const statusColor = deadline.status === "completed" 
                            ? "text-green-600"
                            : isPast 
                              ? "text-red-600" 
                              : isWithinMonth 
                                ? "text-amber-600" 
                                : "text-blue-600";
                          const statusIcon = deadline.status === "completed" 
                            ? <CheckCircle className="h-4 w-4 text-green-600" />
                            : isPast 
                              ? <AlertCircle className="h-4 w-4 text-red-600" /> 
                              : <Clock className="h-4 w-4 text-blue-600" />;

                          return (
                            <div key={deadline.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {statusIcon}
                                  <span className="font-medium">{deadline.title}</span>
                                </div>
                                <span className={`text-sm ${statusColor}`}>
                                  {format(new Date(deadline.dueDate), "MMM d, yyyy")}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {deadline.description}
                              </p>
                            </div>
                          );
                        })}

                        {regulation?.reportingFrequency && (
                          <div className="text-sm text-gray-600 mt-4">
                            <span className="font-medium">Reporting Frequency: </span>
                            {regulation.reportingFrequency}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No deadlines have been set for this regulation.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Notification Settings</CardTitle>
                      <CardDescription>
                        Configure reminders for this regulation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...overrideForm}>
                        <form
                          onSubmit={overrideForm.handleSubmit((data) => {
                            overrideMutation.mutate(data);
                          })}
                          className="space-y-4"
                        >
                          <FormField
                            control={overrideForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Override Email</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="compliance@example.edu"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Send notifications to a specific email instead of the default
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={overrideForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Override Phone</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="+1 (555) 123-4567"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Send SMS alerts to a specific phone number
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={overrideForm.control}
                            name="notificationSchedule.initialReminder"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Initial Reminder (days before)</FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-4">
                                    <Slider
                                      min={30}
                                      max={365}
                                      step={1}
                                      value={[field.value || 90]}
                                      onValueChange={(value) => field.onChange(value[0])}
                                      className="flex-1"
                                    />
                                    <span className="w-12 text-center">
                                      {field.value || 90}
                                    </span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={overrideForm.control}
                            name="notificationSchedule.weeklyReminder"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Weekly Reminders Starting (days before)</FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-4">
                                    <Slider
                                      min={7}
                                      max={90}
                                      step={1}
                                      value={[field.value || 30]}
                                      onValueChange={(value) => field.onChange(value[0])}
                                      className="flex-1"
                                    />
                                    <span className="w-12 text-center">
                                      {field.value || 30}
                                    </span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={overrideForm.control}
                            name="notificationSchedule.dailyReminder"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Daily Reminders Starting (days before)</FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-4">
                                    <Slider
                                      min={1}
                                      max={30}
                                      step={1}
                                      value={[field.value || 7]}
                                      onValueChange={(value) => field.onChange(value[0])}
                                      className="flex-1"
                                    />
                                    <span className="w-12 text-center">
                                      {field.value || 7}
                                    </span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={overrideForm.control}
                            name="notificationSchedule.finalDayReminders"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between">
                                <div className="space-y-0.5">
                                  <FormLabel>Final Day Hourly Reminders</FormLabel>
                                  <FormDescription>
                                    Send hourly reminders on due date
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value || false}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <Button
                            type="submit"
                            className="w-full"
                            disabled={overrideMutation.isPending}
                          >
                            {overrideMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Bell className="h-4 w-4 mr-2" />
                            )}
                            Save Notification Settings
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-3xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto h-full pr-4">
            <RegulationChanges regulationId={regulation?.id} currentVersion={regulation?.versionNumber} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuideContent() {
  return (
    <div className="space-y-4 mt-2">
      <h3 className="font-medium text-lg">Compliance Guide</h3>
      <p>
        This guide helps you understand the steps required to comply with this regulation.
      </p>
      
      <div className="border-l-4 border-blue-500 pl-4 py-2">
        <h4 className="font-medium">Key Requirements</h4>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Maintain written policies addressing all aspects of the regulation</li>
          <li>Designate responsible personnel for oversight</li>
          <li>Conduct annual training for all relevant staff</li>
          <li>Document all compliance activities and retain records</li>
          <li>Report compliance status as required by governing bodies</li>
        </ul>
      </div>
      
      <div className="border-l-4 border-green-500 pl-4 py-2">
        <h4 className="font-medium">Recommended Timeline</h4>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>90 days before deadline: Begin preparation and documentation review</li>
          <li>60 days before deadline: Update policies and procedures as needed</li>
          <li>30 days before deadline: Conduct final compliance check</li>
          <li>15 days before deadline: Prepare submission materials</li>
          <li>5 days before deadline: Final review by legal counsel</li>
        </ul>
      </div>
      
      <div className="border-l-4 border-amber-500 pl-4 py-2">
        <h4 className="font-medium">Common Pitfalls</h4>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Incomplete documentation of compliance activities</li>
          <li>Failure to update policies to reflect regulatory changes</li>
          <li>Inadequate staff training on compliance requirements</li>
          <li>Missing submission deadlines</li>
          <li>Not maintaining required records for the mandated retention period</li>
        </ul>
      </div>
    </div>
  );
}

type StatusType = {
  icon: JSX.Element;
  label: string;
  className: string;
};

function getDeadlineStatus(deadline: Deadline): StatusType {
  const today = new Date();
  const dueDate = new Date(deadline.dueDate);
  const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (deadline.status === "completed") {
    return {
      icon: <CheckCircle className="h-5 w-5" />,
      label: "Completed",
      className: "bg-green-100 text-green-800",
    };
  } else if (today > dueDate) {
    return {
      icon: <AlertCircle className="h-5 w-5" />,
      label: "Overdue",
      className: "bg-red-100 text-red-800",
    };
  } else if (daysDiff <= 30) {
    return {
      icon: <Clock className="h-5 w-5" />,
      label: "Approaching",
      className: "bg-amber-100 text-amber-800",
    };
  } else {
    return {
      icon: <Clock className="h-5 w-5" />,
      label: "Upcoming",
      className: "bg-blue-100 text-blue-800",
    };
  }
}