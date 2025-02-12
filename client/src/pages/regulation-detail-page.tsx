import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  FileText,
  Mail,
  Printer,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function RegulationDetailPage() {
  const params = useParams();
  const regulationId = parseInt(params.id || "0");

  const { data: regulations, isLoading: regulationLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  if (regulationLoading || deadlinesLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const regulation = regulations?.find(r => r.id === regulationId);

  if (!regulation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Regulation Not Found</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  The regulation you're looking for doesn't exist or has been removed.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const regulationDeadlines = deadlines?.filter(d => d.regulationId === regulationId) || [];
  const nextDeadline = regulationDeadlines.length > 0
    ? regulationDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    : null;

  const getDeadlineStatus = (deadline: Deadline) => {
    if (deadline.status === "completed") {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        label: "Completed",
        className: "text-green-600 bg-green-100"
      };
    }

    const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());

    if (deadline.status === "overdue" || daysUntilDue < 0) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        label: "Overdue",
        className: "text-red-600 bg-red-100"
      };
    }

    return {
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      label: daysUntilDue <= 7 ? "Due Soon" : "Upcoming",
      className: daysUntilDue <= 7 ? "text-yellow-600 bg-yellow-100" : "text-blue-600 bg-blue-100"
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Header Section */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {regulation.topic}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  ID: {regulation.itemId}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {regulation.category}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {regulation.regulationUrl && (
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                  onClick={() => {
                    if (regulation.regulationUrl) {
                      window.open(regulation.regulationUrl, '_blank');
                    }
                  }}
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

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Information */}
              <div className="lg:col-span-2 space-y-6">
                {/* Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">
                      {regulation.summary || "No summary available."}
                    </p>
                  </CardContent>
                </Card>

                {/* Requirements Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Requirements</CardTitle>
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

                {/* Statute Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Statutory Reference</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">
                      {regulation.statute}
                      {regulation.statuteIds && (
                        <span className="block text-sm text-gray-500 mt-1">
                          Reference: {regulation.statuteIds}
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Timeline and Actions */}
              <div className="space-y-6">
                {/* Deadlines Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Deadlines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulationDeadlines.length > 0 ? (
                        regulationDeadlines.map((deadline) => {
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
                                  <span
                                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}
                                  >
                                    {status.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-gray-500 italic">No deadlines set</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Required Card */}
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
                            onClick={() => window.open('https://moravian.edu/submit-compliance', '_blank')}
                          >
                            Submit Compliance Report
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => window.open('/help/compliance-guide', '_blank')}
                          >
                            View Submission Guide
                          </Button>
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