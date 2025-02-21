import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, Guide } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
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

// Extend Regulation type to include notification override
interface RegulationWithOverride extends Regulation {
  notificationOverride?: {
    email: string | null;
    phone: string | null;
  };
}

interface RegulationDetailPageProps {
  regulation: RegulationWithOverride;
}

// Add notification override schema
const notificationOverrideSchema = z.object({
  email: z.string().email("Invalid email").optional().nullable(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number").optional().nullable(),
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

export default function RegulationDetailPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const regulationId = location.split("/")[2]; // Extract from /regulations/:id

  // Redirect to login if not authenticated
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
    enabled: !!user && !!regulationId, // Only fetch when user is authenticated and we have an ID
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
      const response = await fetch(
        `/api/regulations/${regulation?.id}/category`,
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
                    <SelectTrigger className="w-[180px] bg-gray-100">
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

            {/* Quick Actions */}
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

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      {regulation?.summary
                        ?.replace(/<[^>]*>/g, '')  // Remove HTML tags
                        ?.split(/\n+/)             // Split on one or more newlines
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

                {/* Additional Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Statute Information */}
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

                      {/* Filing Deadlines */}
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

                      {/* Reporting Frequency */}
                      {regulation?.reportingFrequency && (
                        <div>
                          <h3 className="font-medium text-gray-900">Reporting Frequency</h3>
                          <p className="text-gray-700 mt-1">{regulation.reportingFrequency}</p>
                        </div>
                      )}

                      {/* Dates */}
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

                      {/* Agency Information */}
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

                {/* Submission Guide Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Submission Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GuideContent />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
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

                {/* Notification Override Section - Only visible to admins */}
                {user?.role === "admin" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Override
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6 space-y-2">
                        <p className="text-sm text-gray-700">
                          Configure regulation-specific notification settings that will override the default category-level notifications.
                        </p>
                        <p className="text-sm text-gray-600">
                          Use this feature when you need to route notifications for this specific regulation to different contacts than the category default. Leave fields empty to use category defaults.
                        </p>
                      </div>
                      <Form {...overrideForm}>
                        <form
                          onSubmit={overrideForm.handleSubmit((data) =>
                            overrideMutation.mutate(data)
                          )}
                          className="space-y-6"
                        >
                          <FormField
                            control={overrideForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Override Email</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder="Enter override email"
                                    className="w-full"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription className="text-sm text-gray-500">
                                  Email notifications for this regulation will be sent to this address instead of the category default
                                </FormDescription>
                                <FormMessage className="text-sm text-red-500" />
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
                                    type="tel"
                                    placeholder="Enter override phone"
                                    className="w-full"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription className="text-sm text-gray-500">
                                  SMS notifications for this regulation will be sent to this number instead of the category default
                                </FormDescription>
                                <FormMessage className="text-sm text-red-500" />
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
                              "Save Override Settings"
                            )}
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
    </div>
  );
}

// Guide Content Component
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