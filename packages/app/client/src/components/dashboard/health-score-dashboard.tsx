/**
 * @module HealthScoreDashboard
 * @description A sophisticated dashboard component that displays compliance health scores and metrics
 * @compliance ISO/IEC/IEEE 26514 4.3.4 - Data Visualization Documentation
 * 
 * @securityControl Data Presentation & Analytics
 * - Implements secure data visualization
 * - Provides category-based compliance scoring
 * - Handles real-time score calculations
 */

import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CircularProgress from "@/components/common/circular-progress";
import { AlertTriangle, CheckCircle, Clock, ChevronDown, FileText, Calendar } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * @interface CategoryScore
 * @description Represents the compliance score and metrics for a specific category
 */
interface CategoryScore {
  /** The name of the category */
  category: string;
  /** Overall compliance score for the category (0-100) */
  score: number;
  /** Detailed breakdown of the score components */
  breakdown: {
    /** Score based on deadline completion (0-40) */
    deadlines: number;
    /** Score based on documentation completeness (0-30) */
    documentation: number;
    /** Score based on review status (0-30) */
    review: number;
  };
  /** Total number of regulations in this category */
  regulations: number;
  /** Number of regulations with score >= 90 */
  completed: number;
  /** Number of regulations with score > 0 and < 90 */
  inProgress: number;
  /** Number of regulations with score = 0 */
  notStarted: number;
}

/**
 * Calculates the compliance score for a specific regulation
 * @param {Regulation} regulation - The regulation to calculate the score for
 * @param {Deadline[]} deadlines - Associated deadlines for the regulation
 * @returns {Object} The calculated score and its breakdown
 */
function calculateRegulationScore(regulation: Regulation, deadlines: Deadline[]): {
  score: number;
  breakdown: { deadlines: number; documentation: number; review: number };
} {
  // Calculate deadline completion rate (40% of total score)
  const regulationDeadlines = deadlines.filter(d => d.regulationId === regulation.id);
  const completedDeadlines = regulationDeadlines.filter(d => d.status === "completed").length;
  const deadlineScore = regulationDeadlines.length > 0
    ? (completedDeadlines / regulationDeadlines.length) * 40
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

/**
 * Calculates compliance scores for all categories
 * @param {Regulation[]} regulations - List of all regulations
 * @param {Deadline[]} deadlines - List of all deadlines
 * @returns {CategoryScore[]} Array of category scores
 */
function calculateCategoryScores(regulations: Regulation[], deadlines: Deadline[]): CategoryScore[] {
  const categoryMap = new Map<string, CategoryScore>();

  regulations.forEach(regulation => {
    if (!regulation.category) return;

    const { score, breakdown } = calculateRegulationScore(regulation, deadlines);

    const existing = categoryMap.get(regulation.category) || {
      category: regulation.category,
      score: 0,
      breakdown: { deadlines: 0, documentation: 0, review: 0 },
      regulations: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0
    };

    existing.regulations += 1;
    existing.score = (existing.score * (existing.regulations - 1) + score) / existing.regulations;

    // Update breakdown averages
    Object.keys(breakdown).forEach(key => {
      existing.breakdown[key as keyof typeof breakdown] = (existing.breakdown[key as keyof typeof breakdown] * (existing.regulations - 1) + breakdown[key as keyof typeof breakdown]) / existing.regulations;
    });

    if (score >= 90) existing.completed += 1;
    else if (score > 0) existing.inProgress += 1;
    else existing.notStarted += 1;

    categoryMap.set(regulation.category, existing);
  });

  return Array.from(categoryMap.values());
}

/**
 * @component HealthScoreDashboard
 * @description Main dashboard component showing compliance health metrics
 * @returns {JSX.Element} The rendered dashboard
 * 
 * @example
 * ```tsx
 * <HealthScoreDashboard />
 * ```
 */
export default function HealthScoreDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  if (regulationsLoading || deadlinesLoading) {
    return <div>Loading health scores...</div>;
  }

  if (!regulations || !deadlines) {
    return <div>No data available</div>;
  }

  const categoryScores = calculateCategoryScores(regulations, deadlines);
  const overallScore = categoryScores.reduce((acc, cat) => acc + cat.score, 0) / categoryScores.length;

  return (
    <Card className="transition-all duration-300 ease-in-out">
      <div 
        className="cursor-pointer hover:bg-background/50 transition-colors"
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded); }}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Overall Compliance Health
            <ChevronDown 
              className={cn(
                "h-6 w-6 text-muted-foreground transition-transform duration-300",
                isExpanded && "transform rotate-180"
              )} 
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex items-center justify-center w-32 h-32">
              <CircularProgress
                progress={Math.round(overallScore)}
                size="lg"
                showPercentage={true}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Regulations</p>
                <p className="text-2xl font-bold">{regulations.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{categoryScores.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Deadlines</p>
                <p className="text-2xl font-bold">
                  {deadlines.filter(d => d.status !== "completed").length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </div>

      {/* Collapsible Section */}
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryScores.map((category) => (
              <div 
                key={category.category} 
                className={cn(
                  "bg-background rounded-lg p-4 cursor-pointer transition-colors",
                  selectedCategory === category.category && "ring-2 ring-[#00267A] bg-gray-100"
                )}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCategory(
                  selectedCategory === category.category ? null : category.category
                )}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCategory(selectedCategory === category.category ? null : category.category); }}
              >
                <h4 className="font-medium text-foreground mb-3">{category.category}</h4>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20">
                    <CircularProgress
                      progress={Math.round(category.score)}
                      size="md"
                      showPercentage={true}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{category.completed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        <span>{category.inProgress}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span>{category.notStarted}</span>
                      </div>
                    </div>
                    {selectedCategory === category.category && (
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span>Deadlines</span>
                          </div>
                          <span className="font-medium">{category.breakdown.deadlines}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span>Documentation</span>
                          </div>
                          <span className="font-medium">{category.breakdown.documentation}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span>Review Status</span>
                          </div>
                          <span className="font-medium">{category.breakdown.review}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}