import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { marked } from "marked";
import PublicNavigation from "@/components/layout/public-navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Globe,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  BookOpen,
  Info,
  Clock,
  Building,
  FileCheck,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, differenceInDays } from "date-fns";
import { type Regulation, type Deadline } from "@shared/schema";

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

// Calculate compliance score utility function
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

// Circular progress component for compliance score visualization
function CircularProgress({
  value,
  maxValue,
  radius,
  strokeWidth,
  label,
  className,
}: {
  value: number;
  maxValue: number;
  radius: number;
  strokeWidth: number;
  label: string;
  className?: string;
}) {
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / maxValue) * circumference;

  // Determine color based on value
  const getColor = () => {
    if (value >= 70) return "#22c55e"; // Green for good scores
    if (value >= 40) return "#f59e0b"; // Yellow/amber for medium scores
    return "#ef4444"; // Red for poor scores
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress circle */}
        <circle
          stroke={getColor()}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: getColor() }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// Status badge component that shows the appropriate color and icon
function StatusBadge({ status }: { status: string }) {
  let icon;
  let className;

  switch (status) {
    case "completed":
      icon = <CheckCircle2 className="h-3 w-3" />;
      className = "bg-green-50 text-green-700 border-green-200";
      break;
    case "in_progress":
      icon = <Clock className="h-3 w-3" />;
      className = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case "overdue":
      icon = <AlertCircle className="h-3 w-3" />;
      className = "bg-red-50 text-red-700 border-red-200";
      break;
    case "upcoming":
      icon = <Calendar className="h-3 w-3" />;
      className = "bg-purple-50 text-purple-700 border-purple-200";
      break;
    default:
      icon = <AlertTriangle className="h-3 w-3" />;
      className = "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  return (
    <Badge variant="outline" className={`${className} flex items-center gap-1 capitalize`}>
      {icon}
      <span>{status.replace("_", " ")}</span>
    </Badge>
  );
}

export default function PublicRegulationDetailPage() {
  const [location, navigate] = useLocation();
  const regulationId = location.split("/")[3]; // Extract from /public-dashboard/regulation/:id

  // Fetch the regulation details
  const { data: regulation, isLoading: regulationLoading } = useQuery({
    queryKey: ["/api/public/regulations", regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/public/regulations/${regulationId}`);
      if (!response.ok) throw new Error("Failed to fetch regulation");
      return response.json();
    },
  });

  // Fetch deadlines for this regulation
  const { data: deadlines, isLoading: deadlinesLoading } = useQuery({
    queryKey: ["/api/public/regulations", regulationId, "deadlines"],
    queryFn: async () => {
      const response = await fetch(`/api/public/regulations/${regulationId}/deadlines`);
      if (!response.ok) throw new Error("Failed to fetch deadlines");
      return response.json();
    },
    enabled: !!regulationId,
  });

  const isLoading = regulationLoading || deadlinesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-4 pt-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span>Loading regulation details...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!regulation) {
    return (
      <div className="min-h-screen bg-background">
        <PublicNavigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center pt-20">
              <h2 className="text-2xl font-bold">Regulation Not Found</h2>
              <p className="mt-2 text-muted-foreground">
                The regulation you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => navigate("/public-dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const complianceScore = calculateComplianceScore(regulation, deadlines || []);
  const regulationDeadlines = deadlines || [];
  
  // Sort deadlines by due date
  const sortedDeadlines = [...regulationDeadlines].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  // Get next upcoming deadline
  const nextDeadline = sortedDeadlines.find(d => 
    d.status !== "completed" && new Date(d.dueDate) > new Date()
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicNavigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Header with back button */}
            <div>
              <Button
                variant="ghost"
                onClick={() => navigate("/public-dashboard")}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {regulation.name || regulation.topic}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  ID: {regulation.itemId}
                </span>
                <Badge
                  variant="outline"
                  className={`capitalize ${
                    regulation.jurisdiction === "federal"
                      ? "bg-blue-50 text-blue-600 border-blue-200"
                      : "bg-purple-50 text-purple-600 border-purple-200"
                  }`}
                >
                  <Globe className="h-3 w-3 mr-1" />
                  {regulation.jurisdiction}
                </Badge>
                <Badge variant="outline" className="bg-background text-muted-foreground border-border">
                  {regulation.category}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left column - Executive Summary and Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Executive Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 text-muted-foreground mr-2" />
                      Executive Summary
                    </CardTitle>
                    <CardDescription>
                      Key information about this regulation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {regulation.summary ? (
                      <div 
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(regulation.summary) }}
                      />
                    ) : (
                      <div className="bg-background border border-gray-100 rounded-md p-4 text-muted-foreground flex items-center">
                        <Info className="h-5 w-5 text-muted-foreground mr-2" />
                        No executive summary available for this regulation.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Requirements */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground mr-2" />
                      Requirements
                    </CardTitle>
                    <CardDescription>
                      Detailed compliance requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {regulation.requirements ? (
                      <div 
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(regulation.requirements) }}
                      />
                    ) : (
                      <div className="bg-background border border-gray-100 rounded-md p-4 text-muted-foreground flex items-center">
                        <Info className="h-5 w-5 text-muted-foreground mr-2" />
                        No specific requirements listed for this regulation.
                      </div>
                    )}
                    
                    {regulation.regulationUrl && (
                      <div className="mt-4">
                        <Button variant="outline" size="sm" className="text-blue-600" asChild>
                          <a 
                            href={regulation.regulationUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center"
                          >
                            <Globe className="h-4 w-4 mr-2" />
                            View Full Regulation Text
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Dates and Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="h-5 w-5 text-muted-foreground mr-2" />
                      Key Dates
                    </CardTitle>
                    <CardDescription>Important timeline information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-muted-foreground">Origination Date</h4>
                        <p className="font-medium">
                          {regulation.originationDate
                            ? format(new Date(regulation.originationDate), "MMMM d, yyyy")
                            : "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-muted-foreground">Effective Date</h4>
                        <p className="font-medium">
                          {regulation.effectiveDate
                            ? format(new Date(regulation.effectiveDate), "MMMM d, yyyy")
                            : "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-muted-foreground">Last Updated</h4>
                        <p className="font-medium">
                          {regulation.lastUpdated
                            ? format(new Date(regulation.lastUpdated), "MMMM d, yyyy")
                            : "Not recorded"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-muted-foreground">Next Review Date</h4>
                        <p className="font-medium">
                          {regulation.nextReviewDate
                            ? format(new Date(regulation.nextReviewDate), "MMMM d, yyyy")
                            : "Not scheduled"}
                        </p>
                      </div>
                    </div>
                    
                    {nextDeadline && (
                      <div className="mt-6 p-3 border border-yellow-200 bg-yellow-50 rounded-md">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-yellow-800">Upcoming Deadline</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              {nextDeadline.description || "Compliance deadline"} due by {format(new Date(nextDeadline.dueDate), "MMMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Deadlines */}
                {regulationDeadlines.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Clock className="h-5 w-5 text-muted-foreground mr-2" />
                        Deadlines
                      </CardTitle>
                      <CardDescription>
                        Compliance deadlines and their status
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {sortedDeadlines.map((deadline) => (
                          <div
                            key={deadline.id}
                            className="flex items-center justify-between p-3 border border-gray-100 rounded-md"
                          >
                            <div className="space-y-0.5">
                              <div className="font-medium">
                                {deadline.description || "Compliance Deadline"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Due: {format(new Date(deadline.dueDate), "MMMM d, yyyy")}
                              </div>
                            </div>
                            <StatusBadge status={deadline.status} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right column - Compliance Score and Agency Info */}
              <div className="space-y-6">
                {/* Compliance Score */}
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
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${complianceScore.breakdown.documentation}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Review Status</span>
                        <span>{complianceScore.breakdown.review}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${complianceScore.breakdown.review}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Agency Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building className="h-5 w-5 text-muted-foreground mr-2" />
                      Agency Information
                    </CardTitle>
                    <CardDescription>Regulatory authority details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {regulation.agency_name ? (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Agency</h4>
                        <p className="font-medium">{regulation.agency_name}</p>
                        {regulation.agency_department && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {regulation.agency_department}
                          </p>
                        )}
                        
                        {regulation.agency_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3 text-blue-600"
                            asChild
                          >
                            <a 
                              href={regulation.agency_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                            >
                              <Globe className="h-4 w-4 mr-2" />
                              Visit Agency Website
                            </a>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-background border border-gray-100 rounded-md p-4 text-muted-foreground flex items-center">
                        <Info className="h-5 w-5 text-muted-foreground mr-2" />
                        No agency information available.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Statute Reference */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileCheck className="h-5 w-5 text-muted-foreground mr-2" />
                      Statute Reference
                    </CardTitle>
                    <CardDescription>Legal foundation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Statute</h4>
                      <p className="font-medium">{regulation.statute}</p>
                    </div>
                    {regulation.statuteIds && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Statute ID</h4>
                        <p className="font-medium">{regulation.statuteIds}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}