import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Deadline, Regulation } from "@shared/schema";
import { format, differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

interface UpcomingDeadlinesProps {
  categoryFilter: string | null;
}

export default function UpcomingDeadlines({ categoryFilter }: UpcomingDeadlinesProps) {
  const [expandedDeadlineId, setExpandedDeadlineId] = useState<number | null>(null);

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"]
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"]
  });

  if (deadlinesLoading || regulationsLoading || !deadlines || !regulations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  const getAgencyName = (url: string | null): string => {
    if (!url) return "N/A";

    const urlMap: Record<string, string> = {
      "www.ed.gov": "Department of Education",
      "www.eeoc.gov": "Equal Employment Opportunity Commission",
      "www.justice.gov": "Department of Justice",
      "www.osha.gov": "Occupational Safety and Health Administration",
      "www.dhs.gov": "Department of Homeland Security"
    };

    try {
      const hostname = new URL(url).hostname;
      return urlMap[hostname] || hostname;
    } catch {
      return "N/A";
    }
  };

  const getStatusDetails = (deadline: Deadline) => {
    if (deadline.status === "completed") {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        bgColor: "bg-green-100",
        textColor: "text-green-800"
      };
    }

    const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());

    if (deadline.status === "overdue" || daysUntilDue < 0) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        bgColor: "bg-red-100",
        textColor: "text-red-800"
      };
    }

    if (daysUntilDue <= 7) {
      return {
        icon: <Clock className="h-5 w-5 text-yellow-500" />,
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800"
      };
    }

    return {
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      bgColor: "bg-blue-100",
      textColor: "text-blue-800"
    };
  };

  let filteredDeadlines = [...deadlines];

  if (categoryFilter) {
    const regulationIds = regulations
      .filter(reg => reg.category === categoryFilter)
      .map(reg => reg.id);

    filteredDeadlines = filteredDeadlines.filter(deadline =>
      regulationIds.includes(deadline.regulationId)
    );
  }

  const sortedDeadlines = filteredDeadlines.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Upcoming Deadlines
          {categoryFilter && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({categoryFilter})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedDeadlines.map((deadline) => {
            const { icon, bgColor, textColor } = getStatusDetails(deadline);
            const daysUntilDue = differenceInDays(new Date(deadline.dueDate), new Date());
            const regulation = regulations.find(r => r.id === deadline.regulationId);
            const isExpanded = expandedDeadlineId === deadline.id;

            return (
              <div key={deadline.id} className="space-y-2">
                <div
                  onClick={() => setExpandedDeadlineId(isExpanded ? null : deadline.id)}
                  className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-[#00267A] hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    {icon}
                    <div>
                      <p className="font-medium text-gray-900 hover:text-[#00267A] transition-colors">
                        {regulation ? (
                          <>
                            {regulation.statuteIds}
                            {regulation.topic && (
                              <span className="text-gray-600 ml-2">
                                {regulation.topic}
                              </span>
                            )}
                          </>
                        ) : (
                          `Regulation #${deadline.regulationId}`
                        )}
                      </p>
                      <p className="text-sm text-gray-500">
                        Due: {format(new Date(deadline.dueDate), "PP")}
                        {daysUntilDue > 0 && deadline.status !== "completed" && (
                          <span className="ml-2">
                            ({daysUntilDue} {daysUntilDue === 1 ? 'day' : 'days'} remaining)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${bgColor} ${textColor}`}
                    >
                      {deadline.status === "completed"
                        ? "Completed"
                        : daysUntilDue < 0
                        ? "Overdue"
                        : daysUntilDue <= 7
                        ? "Due Soon"
                        : "Upcoming"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {isExpanded && regulation && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 ml-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Agency</h4>
                        {regulation.agency_url ? (
                          <a
                            href={regulation.agency_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#00267A] hover:text-[#003166] hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {getAgencyName(regulation.agency_url)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-sm text-gray-600">
                            {getAgencyName(null)}
                          </p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Topic</h4>
                        <p className="text-sm text-gray-600">{regulation.topic}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Category</h4>
                        <p className="text-sm text-gray-600">{regulation.category}</p>
                      </div>
                      {regulation.requirements && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Requirements</h4>
                          <p className="text-sm text-gray-600">{regulation.requirements}</p>
                        </div>
                      )}
                      <div className="pt-2">
                        <Link href={`/regulations/${regulation.id}`}>
                          <a className="text-sm text-[#00267A] hover:underline">
                            View Full Regulation Details
                          </a>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {sortedDeadlines.length === 0 && (
            <div className="text-center text-gray-500">
              No deadlines {categoryFilter ? `for ${categoryFilter}` : ''} found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}