import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
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
import { RegulationDiffViewer } from "@/components/regulations/regulation-diff-viewer";
import { NoteSection } from "@/components/regulations/note-section";
import { RegulationChanges } from "@/components/regulations/regulation-changes";
import { RegulationTimeline } from "@/components/regulations/regulation-timeline";

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

export function RegulationDetailPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const regulationId = location.split("/")[2];
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!user) {
    navigate("/auth");
    return null;
  }

  const { data: regulation, isLoading } = useQuery<Regulation>({
    queryKey: ["/api/regulations", regulationId],
    enabled: !!user && !!regulationId,
  });

  const { data: deadlines } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

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

  if (isLoading) {
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

  const regulationDeadlines = deadlines?.filter(d => d.regulationId === Number(regulationId)) || [];
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
                    <div className="prose max-w-none">
                      {regulation?.submissionGuidelines ? (
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

                <Card>
                  <CardHeader>
                    <CardTitle>Diary</CardTitle>
                    <CardDescription>
                      Keep a running journal of how this regulation affects your institution.
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

                <Card>
                  <CardHeader>
                    <CardTitle>Deadlines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {regulationDeadlines.map((deadline) => (
                        <div
                          key={deadline.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-gray-100">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                Due: {format(new Date(deadline.dueDate), "PP")}
                              </p>
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                                deadline.status === 'completed' ? 'bg-green-100 text-green-800' :
                                deadline.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {deadline.status.charAt(0).toUpperCase() + deadline.status.slice(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {regulationDeadlines.length === 0 && (
                        <p className="text-gray-500 italic">No deadlines set</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {regulation?.filingDeadlines && regulation.filingDeadlines.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Filing Deadlines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        {regulation.filingDeadlines.map((deadline, index) => (
                          <li key={index} className="text-gray-700">
                            {deadline.date}: {deadline.description}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

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
                            onClick={() => navigate(`/compliance-wizard/${regulationId}`)}
                          >
                            Submit Compliance Report
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