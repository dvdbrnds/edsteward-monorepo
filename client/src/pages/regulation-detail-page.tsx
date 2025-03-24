import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, RegulationAction, Deadline } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// Notification override schema for admin settings
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
  regulation: Regulation;
  onStatusChange: (status: RegulationAction['status']) => void;
}

function ActionButton({ action, regulation, onStatusChange }: ActionButtonProps) {
  const [showWebPublishDialog, setShowWebPublishDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showSubmissionWizard, setShowSubmissionWizard] = useState(false);
  const { toast } = useToast();

  const handleActionClick = () => {
    console.log(`Handling action click for type: ${action.type}`);

    switch (action.type) {
      case 'website_publish':
        console.log('Opening web publish dialog');
        setShowWebPublishDialog(true);
        onStatusChange('in_progress');
        break;
      case 'community_communication':
        console.log('Opening communication dialog');
        setShowCommunicationDialog(true);
        onStatusChange('in_progress');
        break;
      case 'agency_submission':
        console.log('Opening submission wizard');
        setShowSubmissionWizard(true);
        onStatusChange('in_progress');
        break;
    }
  };

  const handleActionComplete = () => {
    console.log(`Action completed: ${action.type}`);
    onStatusChange('completed');

    switch (action.type) {
      case 'website_publish':
        setShowWebPublishDialog(false);
        toast({
          title: "Website Publication Complete",
          description: "The content has been prepared for website publishing.",
        });
        break;
      case 'community_communication':
        setShowCommunicationDialog(false);
        toast({
          title: "Communication Generated",
          description: "The communication statement has been generated.",
        });
        break;
      case 'agency_submission':
        setShowSubmissionWizard(false);
        toast({
          title: "Submission Process Complete",
          description: "The agency submission process has been completed.",
        });
        break;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={handleActionClick}
      >
        {action.type === 'website_publish' && (
          <>
            <Globe className="h-4 w-4" />
            <span>Publish to Website</span>
          </>
        )}
        {action.type === 'community_communication' && (
          <>
            <Mail className="h-4 w-4" />
            <span>Generate Communication</span>
          </>
        )}
        {action.type === 'agency_submission' && (
          <>
            <FileText className="h-4 w-4" />
            <span>Submit to Agency</span>
          </>
        )}
      </Button>

      {action.type === 'website_publish' && (
        <WebPublishDialog
          regulation={regulation}
          open={showWebPublishDialog}
          onOpenChange={setShowWebPublishDialog}
          onComplete={handleActionComplete}
        />
      )}

      {action.type === 'community_communication' && (
        <CommunicationDialog
          regulation={regulation}
          open={showCommunicationDialog}
          onOpenChange={setShowCommunicationDialog}
          onComplete={handleActionComplete}
        />
      )}

      {action.type === 'agency_submission' && (
        <SubmissionWizard
          regulation={regulation}
          open={showSubmissionWizard}
          onOpenChange={setShowSubmissionWizard}
          onComplete={handleActionComplete}
        />
      )}
    </>
  );
}

function RegulationDetailPage() {
  const [location] = useLocation();
  const regulationId = Number(location.split("/")[2]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showVersionHistory, setShowVersionHistory] = useState(false);

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
      // Invalidate both the specific regulation and the full list
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
    updateActionMutation.mutate({
      regulationId,
      action: { ...action, status: newStatus }
    });
  };
  
  // Notification override mutation
  const overrideMutation = useMutation({
    mutationFn: async (data: NotificationOverride) => {
      const response = await fetch(
        `/api/regulations/${regulationId}/notification-override`,
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
        title: "Notification Settings Updated",
        description: "The notification settings have been updated successfully.",
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
  
  // Form for notification override settings
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

  const { data: user } = useQuery({
    queryKey: ["/api/user"]
  });
  
  // Debug user information
  console.log("Current user data:", user);

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

  // Initialize form with data after regulation is loaded
  React.useEffect(() => {
    if (regulation) {
      overrideForm.reset({
        email: regulation.notificationOverride?.email || "",
        phone: regulation.notificationOverride?.phone || "",
        notificationSchedule: regulation.notificationSchedule || {
          initialReminder: 90,
          weeklyReminder: 30,
          dailyReminder: 7,
          finalDayReminders: true
        }
      });
    }
  }, [regulation, overrideForm]);

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
                          regulation={regulation}
                          onStatusChange={(status) => handleActionStatusChange(action, status)}
                        />
                      ))}
                      {(!regulation?.actions || regulation.actions.length === 0) && (
                        <p className="text-gray-500 italic">No actions configured</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <EvidenceFiles regulationId={regulationId} />
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
                
                {/* Admin Notification Settings - only visible for admin users */}
                {user && user.role === "admin" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
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
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>
                                      Enable final day reminders
                                    </FormLabel>
                                    <FormDescription>
                                      Send urgent reminders on the final day before deadline
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <Button
                              type="submit"
                              className="w-full"
                              disabled={overrideMutation.isPending}
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

export default RegulationDetailPage;