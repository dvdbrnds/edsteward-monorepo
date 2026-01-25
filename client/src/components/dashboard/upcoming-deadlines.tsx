import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Deadline, Regulation, User } from "@shared/schema";
import { format, differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";


interface UpcomingDeadlinesProps {
  categoryFilter: string | null;
  limit?: number;
}

type ViewMode = 'my' | 'all';

export default function UpcomingDeadlines({ categoryFilter, limit }: UpcomingDeadlinesProps) {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>('my');

  // Check if user is logged in
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/users/me"],
  });

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"]
  });

  // Fetch deadlines based on view mode
  const { data: allDeadlines, isLoading: allDeadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
    enabled: viewMode === 'all' || !currentUser, // Always fetch all if not logged in
  });

  const { data: myDeadlines, isLoading: myDeadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines/my-deadlines"],
    enabled: viewMode === 'my' && !!currentUser, // Only fetch when logged in and viewing my deadlines
  });

  const deadlinesLoading = viewMode === 'my' && currentUser ? myDeadlinesLoading : allDeadlinesLoading;
  const deadlines = viewMode === 'my' && currentUser ? myDeadlines : allDeadlines;

  if (deadlinesLoading || regulationsLoading || !regulations) {
    return (
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  let filteredDeadlines = [...(deadlines || [])];

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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">
            Deadlines
            <span className="text-sm font-normal text-muted-foreground ml-1">
              ({sortedDeadlines.length})
            </span>
          </span>
          {currentUser && (
            <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 flex-shrink-0">
              <Button
                variant={viewMode === 'my' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('my')}
                className="h-6 px-1.5 text-xs"
              >
                Mine
              </Button>
              <Button
                variant={viewMode === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('all')}
                className="h-6 px-1.5 text-xs"
              >
                All
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-2 max-h-[515px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 pr-3 px-6 pb-4">
            {sortedDeadlines.map((deadline) => {
              const regulation = Array.isArray(regulations) ? regulations.find(r => r.id === deadline.regulationId) : null;
              const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());


              // Use regulation name from deadline (if enhanced endpoint) or from regulation lookup
              const deadlineWithName = deadline as Deadline & { regulationName?: string };
              const regulationTitle = deadlineWithName.regulationName 
                ? deadlineWithName.regulationName
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
                    className="flex items-center justify-between p-3 bg-background dark:bg-secondary border rounded-lg hover:border-primary hover:shadow-sm transition-all cursor-pointer w-full"
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
                        <p className="font-medium text-foreground hover:text-primary transition-colors truncate text-sm">
                          {regulationTitle}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
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
              <div className="text-center text-muted-foreground py-8">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">
                  {viewMode === 'my' && currentUser 
                    ? 'No deadlines assigned to you'
                    : 'No deadlines found'}
                </p>
                <p className="text-xs mt-1">
                  {viewMode === 'my' && currentUser
                    ? 'Switch to "All" to see institution-wide deadlines'
                    : categoryFilter 
                      ? `No deadlines for ${categoryFilter}` 
                      : 'Deadlines will appear here when regulations have upcoming due dates'}
                </p>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}