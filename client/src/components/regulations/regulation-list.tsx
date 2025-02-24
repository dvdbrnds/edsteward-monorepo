import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { useLocation } from "wouter";
import { Search, ExternalLink, CheckCircle, AlertCircle, Clock, Loader2, ArrowUpDown } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { cn } from "@/lib/utils";
import HealthScoreIndicator from "./health-score-indicator";

interface RegulationListProps {
  categoryFilter: string | null;
}

type SortConfig = {
  key: keyof Regulation;
  direction: 'asc' | 'desc';
} | null;

// Helper functions for health score calculation
function calculateHealthScore(regulation: Regulation): number {
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

  const dataCompleteness = Math.round((completedFields.length / requiredFields.length) * 100);

  // Add weights to different aspects of health
  const weights = {
    dataCompleteness: 0.4,
    hasDeadlines: 0.2,
    hasAgencyInfo: 0.2,
    hasUrls: 0.2
  };

  const hasDeadlines = regulation.filingDeadlines && regulation.filingDeadlines.length > 0 ? 100 : 0;
  const hasAgencyInfo = (regulation.agency_name && regulation.agency_url) ? 100 : 0;
  const hasUrls = (regulation.regulationUrl || regulation.requirementsUrl) ? 100 : 0;

  const score = (
    dataCompleteness * weights.dataCompleteness +
    hasDeadlines * weights.hasDeadlines +
    hasAgencyInfo * weights.hasAgencyInfo +
    hasUrls * weights.hasUrls
  );

  return Math.round(score);
}

// Helper function to get agency name from URL
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

export default function RegulationList({ categoryFilter }: RegulationListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [_, navigate] = useLocation();

  const { data: regulations, isLoading: regulationsLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
    staleTime: 1000 * 60, // 1 minute
  });

  const requestSort = (key: keyof Regulation) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const sortData = (data: Regulation[]) => {
    if (!sortConfig || !data) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  if (regulationsLoading || deadlinesLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-4">
            <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
            <span>Loading regulations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleRowClick = (regulation: Regulation) => {
    if (regulation && regulation.id) {
      navigate(`/regulations/${regulation.id}`);
    }
  };

  // Filter regulations based on category and search
  let filteredRegulations = regulations || [];

  if (categoryFilter) {
    filteredRegulations = filteredRegulations.filter(reg => reg.category === categoryFilter);
  }

  if (search.trim()) {
    const searchLower = search.toLowerCase();
    filteredRegulations = filteredRegulations.filter(reg =>
      reg.topic?.toLowerCase().includes(searchLower) ||
      reg.itemId?.toLowerCase().includes(searchLower) ||
      reg.category?.toLowerCase().includes(searchLower) ||
      reg.statute?.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting
  filteredRegulations = sortData(filteredRegulations);

  const getColumnHeaderProps = (key: keyof Regulation) => ({
    onClick: () => requestSort(key),
    className: cn(
      "cursor-pointer select-none",
      sortConfig?.key === key && "font-bold"
    ),
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search regulations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead {...getColumnHeaderProps("itemId")}>
                  <div className="flex items-center gap-2">
                    ID
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Health</TableHead>
                <TableHead {...getColumnHeaderProps("jurisdiction")}>
                  <div className="flex items-center gap-2">
                    Jurisdiction
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead {...getColumnHeaderProps("topic")}>
                  <div className="flex items-center gap-2">
                    Topic
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead {...getColumnHeaderProps("agency_name")}>
                  <div className="flex items-center gap-2">
                    Agency
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead {...getColumnHeaderProps("statute")}>
                  <div className="flex items-center gap-2">
                    Regulation
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead {...getColumnHeaderProps("category")}>
                  <div className="flex items-center gap-2">
                    Category
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Next Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegulations.map((regulation) => {
                const regulationDeadlines = deadlines?.filter(d => d.regulationId === regulation.id) || [];
                const nextDeadline = regulationDeadlines.length > 0
                  ? regulationDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
                  : null;

                const healthScore = calculateHealthScore(regulation);

                return (
                  <TableRow
                    key={regulation.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(regulation)}
                  >
                    <TableCell>{regulation.itemId}</TableCell>
                    <TableCell>
                      <HealthScoreIndicator score={healthScore} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{regulation.jurisdiction}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-base font-medium text-gray-900">
                        {regulation.statute}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {regulation.topic}
                      </div>
                    </TableCell>
                    <TableCell>
                      {regulation.agency_url ? (
                        <a
                          href={regulation.agency_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00267A] hover:text-[#003166] underline inline-flex items-center gap-2 group"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {regulation.agency_name || getAgencyName(regulation.agency_url)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {regulation.statute || 'N/A'}
                      {regulation.statuteIds && (
                        <span className="text-gray-500 text-sm block">
                          {regulation.statuteIds}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{regulation.category || 'N/A'}</TableCell>
                    <TableCell>
                      {nextDeadline ? (
                        <div className="flex items-center gap-2">
                          {nextDeadline.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : nextDeadline.status === "overdue" ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className={
                            nextDeadline.status === "completed"
                              ? "text-green-600"
                              : nextDeadline.status === "overdue"
                              ? "text-red-600"
                              : "text-yellow-600"
                          }>
                            {format(new Date(nextDeadline.dueDate), "PP")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">No deadlines</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRegulations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    No regulations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}