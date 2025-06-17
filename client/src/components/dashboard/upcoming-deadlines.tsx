import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Deadline, Regulation } from "@shared/schema";
import { format, differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

interface UpcomingDeadlinesProps {
  categoryFilter: string | null;
  limit?: number;
}

export default function UpcomingDeadlines({ categoryFilter, limit }: UpcomingDeadlinesProps) {
  const [expandedDeadlineId, setExpandedDeadlineId] = useState<number | null>(null);
  const [, setLocation] = useLocation();

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"]
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"]
  });

  if (deadlinesLoading || regulationsLoading || !deadlines || !regulations) {
    return (
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  let filteredDeadlines = [...deadlines];

  if (categoryFilter) {
    const regulationIds = regulations
      .filter(reg => reg.category === categoryFilter)
      .map(reg => reg.id);

    filteredDeadlines = filteredDeadlines.filter(deadline =>
      regulationIds.includes(deadline.regulationId)
    );
  }

  // Remove the limit when scrolling is enabled, or use a higher default
  const sortedDeadlines = filteredDeadlines
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, limit || filteredDeadlines.length);

  return (
    <Card className="h-[600px]">
      <CardHeader>
        <CardTitle>
          Upcoming Deadlines
          {categoryFilter && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({categoryFilter})
            </span>
          )}
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({sortedDeadlines.length} {sortedDeadlines.length === 1 ? 'deadline' : 'deadlines'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-2 max-h-[515px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 pr-3 px-6 pb-4">
            {sortedDeadlines.map((deadline) => {
              const regulation = Array.isArray(regulations) ? regulations.find(r => r.id === deadline.regulationId) : null;
              const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());
              const isExpanded = expandedDeadlineId === deadline.id;

              // Use regulation name from deadline (if enhanced endpoint) or from regulation lookup
              const regulationTitle = (deadline as any).regulationName 
                ? (deadline as any).regulationName
                : regulation 
                  ? regulation.name || regulation.topic || `Regulation #${deadline.regulationId}`
                  : `Regulation #${deadline.regulationId}`;

              return (
                <div key={deadline.id} className="w-full">
                  <div
                    onClick={() => {
                      if (regulation) {
                        setLocation(`/regulations/${regulation.id}`);
                      }
                    }}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-[#00267A] hover:shadow-sm transition-all cursor-pointer w-full"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {deadline.status === "completed" ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : deadline.status === "overdue" || daysUntilDue < 0 ? (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      ) : daysUntilDue <= 7 ? (
                        <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 hover:text-[#00267A] transition-colors truncate text-sm">
                          {regulationTitle}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Due: {deadline.dueDate ? format(new Date(deadline.dueDate), "PP") : "Date not set"}
                          {daysUntilDue > 0 && deadline.status !== "completed" && (
                            <span className="ml-2">
                              ({daysUntilDue} {daysUntilDue === 1 ? 'day' : 'days'} remaining)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                          deadline.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : deadline.status === "overdue" || daysUntilDue < 0
                            ? "bg-red-100 text-red-800"
                            : daysUntilDue <= 7
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {deadline.status === "completed"
                          ? "Completed"
                          : daysUntilDue < 0
                          ? "Overdue"
                          : daysUntilDue <= 7
                          ? "Due Soon"
                          : "Upcoming"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {sortedDeadlines.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No deadlines {categoryFilter ? `for ${categoryFilter}` : ''} found
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}