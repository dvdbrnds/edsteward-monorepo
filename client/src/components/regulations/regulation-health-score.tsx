import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Regulation } from "@shared/schema";

interface RegulationHealthScoreProps {
  regulation: Regulation;
}

interface HealthMetric {
  name: string;
  score: number;
  weight: number;
  details: string;
}

export default function RegulationHealthScore({ regulation }: RegulationHealthScoreProps) {
  const healthMetrics = useMemo(() => {
    const metrics: HealthMetric[] = [
      {
        name: "Data Completeness",
        score: calculateDataCompleteness(regulation),
        weight: 0.3,
        details: "Measures the completeness of regulation data fields"
      },
      {
        name: "Documentation",
        score: calculateDocumentationScore(regulation),
        weight: 0.2,
        details: "Assesses the presence and quality of supporting documentation"
      },
      {
        name: "Deadline Status",
        score: calculateDeadlineScore(regulation),
        weight: 0.3,
        details: "Evaluates compliance with deadlines"
      },
      {
        name: "Verification Status",
        score: calculateVerificationScore(regulation),
        weight: 0.2,
        details: "Checks if regulation has been recently verified"
      }
    ];

    return metrics;
  }, [regulation]);

  const overallScore = useMemo(() => {
    return Math.round(
      healthMetrics.reduce((acc, metric) => {
        return acc + (metric.score * metric.weight);
      }, 0)
    );
  }, [healthMetrics]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Regulation Health Score
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                A composite score indicating the overall health and compliance status of this regulation
              </p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 border-gray-100">
              <div className="text-4xl font-bold">{overallScore}</div>
            </div>
          </div>

          {/* Individual Metrics */}
          <div className="space-y-4">
            {healthMetrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Tooltip>
                    <TooltipTrigger className="text-sm font-medium">
                      {metric.name}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{metric.details}</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm">{metric.score}%</span>
                </div>
                <Progress
                  value={metric.score}
                  className={getScoreColor(metric.score)}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Scoring Functions
function calculateDataCompleteness(regulation: Regulation): number {
  const requiredFields = [
    'itemId',
    'topic',
    'statute',
    'requirements',
    'category',
    'summary'
  ];

  const completedFields = requiredFields.filter(field => 
    regulation[field as keyof Regulation] != null && 
    regulation[field as keyof Regulation] !== ''
  );

  return Math.round((completedFields.length / requiredFields.length) * 100);
}

function calculateDocumentationScore(regulation: Regulation): number {
  const documentationFields = [
    'regulationUrl',
    'requirementsUrl',
    'submissionGuideUrl',
    'formsUrl',
    'submissionGuidelines',
    'regulationText'
  ];

  const completedDocs = documentationFields.filter(field =>
    regulation[field as keyof Regulation] != null &&
    regulation[field as keyof Regulation] !== ''
  );

  return Math.round((completedDocs.length / documentationFields.length) * 100);
}

function calculateDeadlineScore(regulation: Regulation): number {
  if (!regulation.filingDeadlines || regulation.filingDeadlines.length === 0) {
    return 0;
  }

  const now = new Date();
  const deadlines = regulation.filingDeadlines;
  const totalDeadlines = deadlines.length;
  let missedDeadlines = 0;

  deadlines.forEach(deadline => {
    const dueDate = new Date(deadline.date);
    if (dueDate < now && !deadline.type.includes('completed')) {
      missedDeadlines++;
    }
  });

  return Math.round(((totalDeadlines - missedDeadlines) / totalDeadlines) * 100);
}

function calculateVerificationScore(regulation: Regulation): number {
  if (!regulation.lastVerified) {
    return 0;
  }

  const lastVerified = new Date(regulation.lastVerified);
  const now = new Date();
  const monthsSinceVerification = 
    (now.getFullYear() - lastVerified.getFullYear()) * 12 + 
    (now.getMonth() - lastVerified.getMonth());

  // Score decreases the longer it's been since verification
  // Assumes verification should happen at least every 12 months
  const score = Math.max(0, 100 - (monthsSinceVerification / 12 * 100));
  return Math.round(score);
}