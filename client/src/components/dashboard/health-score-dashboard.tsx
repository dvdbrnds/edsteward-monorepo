import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CircularProgress from "@/components/common/circular-progress";
import { AlertTriangle, CheckCircle, Clock, ChevronDown } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CategoryScore {
  category: string;
  score: number;
  regulations: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}

function calculateCategoryScores(regulations: Regulation[], deadlines: Deadline[]): CategoryScore[] {
  const categoryMap = new Map<string, CategoryScore>();

  regulations.forEach(regulation => {
    if (!regulation.category) return;

    const regulationDeadlines = deadlines.filter(d => d.regulationId === regulation.id);
    const completedDeadlines = regulationDeadlines.filter(d => d.status === "completed").length;
    const score = regulationDeadlines.length > 0
      ? (completedDeadlines / regulationDeadlines.length) * 100
      : 0;

    const existing = categoryMap.get(regulation.category) || {
      category: regulation.category,
      score: 0,
      regulations: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0
    };

    existing.regulations += 1;
    existing.score = (existing.score * (existing.regulations - 1) + score) / existing.regulations;

    if (score === 100) existing.completed += 1;
    else if (score > 0) existing.inProgress += 1;
    else existing.notStarted += 1;

    categoryMap.set(regulation.category, existing);
  });

  return Array.from(categoryMap.values());
}

export default function HealthScoreDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);

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
        className="cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Overall Compliance Health
            <ChevronDown 
              className={cn(
                "h-6 w-6 text-gray-400 transition-transform duration-300",
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
                <p className="text-sm text-gray-500">Total Regulations</p>
                <p className="text-2xl font-bold">{regulations.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Categories</p>
                <p className="text-2xl font-bold">{categoryScores.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Deadlines</p>
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
              <div key={category.category} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{category.category}</h4>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20">
                    <CircularProgress
                      progress={Math.round(category.score)}
                      size="md"
                      showPercentage={true}
                    />
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}