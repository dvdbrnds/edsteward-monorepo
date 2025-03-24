import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Regulation, Deadline, RegulationAction } from "@shared/schema";

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  Bell,
  Shield,
  History,
  Check,
  CheckCircle2,
  Clock4
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast } from "@/hooks/use-toast";
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

function RegulationDetailPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);
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

  console.log("Regulation data:", regulation);
  console.log("User role:", user?.role, "isAdmin:", isAdmin);
  
  // Check if regulation exists 
  const hasRegulation = regulation != null;
  
  // Ensure actions is always available (initialize if missing)
  const actions = regulation?.actions || [];
  
  // Make admin tools visible if the user is an admin and regulation exists
  const categoryVisible = isAdmin && hasRegulation;
  const notificationOverrideVisible = isAdmin && hasRegulation;
  
  console.log("Admin tools visibility check:", { 
    hasRegulation, 
    isAdmin, 
    categoryVisible,
    actionsLength: actions.length
  });

  // Initialize the notification override form
  const overrideForm = useForm<z.infer<typeof notificationOverrideSchema>>({
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

  // Mutation for updating notification override
  const overrideMutation = useMutation({
    mutationFn: async (data: z.infer<typeof notificationOverrideSchema>) => {
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
                {categoryVisible ? (
                  <Select
                    defaultValue={regulation.category || "Other"}
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
                    {regulation.category || 'Uncategorized'}
                  </span>
                )}
                {categoryVisible && (
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

            {/* Timeline */}
            <RegulationTimeline regulation={regulation} />

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
                      
                      {/* Notification Override Section - Admin only */}
                      {notificationOverrideVisible && (
                        <div className="pt-4 pb-4 border-2 border-[#5B2C8F] border-dashed rounded-md p-4 relative">
                          <div className="absolute -top-2 -right-2 bg-[#5B2C8F] text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Admin
                          </div>
                          <h3 className="font-medium text-gray-900">Notification Override</h3>
                          <p className="text-sm text-gray-500 mb-4">
                            Set custom notification settings for this regulation. These settings will override the system defaults.
                          </p>
                          <Form {...overrideForm}>
                            <form onSubmit={overrideForm.handleSubmit(data => overrideMutation.mutate(data))} className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={overrideForm.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Notification Email</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="admin@example.com"
                                          {...field}
                                          className="w-full"
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Override default notification email
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
                                      <FormLabel>Notification Phone</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="+12345678901"
                                          {...field}
                                          className="w-full"
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Override default notification phone
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              <div className="pt-2">
                                <h4 className="font-medium text-sm text-gray-900 mb-2">Notification Schedule</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <FormField
                                    control={overrideForm.control}
                                    name="notificationSchedule.initialReminder"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Initial Reminder (days)</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={1}
                                            max={365}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                            className="w-full"
                                          />
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
                                        <FormLabel>Weekly Reminder (days)</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={1}
                                            max={52}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                            className="w-full"
                                          />
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
                                        <FormLabel>Daily Reminder (days)</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={1}
                                            max={14}
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                            className="w-full"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="mt-4">
                                  <FormField
                                    control={overrideForm.control}
                                    name="notificationSchedule.finalDayReminders"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel>Enable Final Day Reminders</FormLabel>
                                          <FormDescription>
                                            Send additional reminders on the due date
                                          </FormDescription>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-end">
                                <Button 
                                  type="submit" 
                                  disabled={overrideMutation.isPending}
                                  className="flex items-center gap-2"
                                >
                                  {overrideMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                  Save Notification Settings
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </div>
                      )}

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
                {/* Compliance Score Card */}
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

                {/* Evidence Files Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evidence Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EvidenceFiles regulationId={regulationId} />
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
                        <div
                          key={deadline.id}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <div
                            className={`p-2 rounded-full ${
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
                          <div>
                            <p className="font-medium">
                              Due: {format(new Date(deadline.dueDate), "PP")}
                            </p>
                            <span
                              className={`text-sm ${
                                deadline.status === "completed"
                                  ? "text-green-600"
                                  : deadline.status === "overdue"
                                  ? "text-red-600"
                                  : "text-yellow-600"
                              }`}
                            >
                              {deadline.status.charAt(0).toUpperCase() +
                                deadline.status.slice(1)}
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