import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { useLocation } from "wouter";
import { Search, ExternalLink, CheckCircle, AlertCircle, Clock, Loader2, ArrowUpDown } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import CircularProgress from "@/components/common/circular-progress";
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
import { useToast } from "@/hooks/use-toast";

interface RegulationListProps {
  categoryFilter: string | null;
}

type SortConfig = {
  key: keyof Regulation;
  direction: 'asc' | 'desc';
} | null;

export default function RegulationList({ categoryFilter }: RegulationListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  const { data: regulations, isLoading: regulationsLoading, error: regulationsError } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
    retry: 2,
    onError: (error) => {
      console.error("Error fetching regulations:", error);
      toast({
        title: "Error Loading Regulations",
        description: "Please try refreshing the page. If the problem persists, contact support.",
        variant: "destructive",
      });
    }
  });

  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
    staleTime: 1000 * 60, // 1 minute
  });

  const handleRowClick = (regulation: Regulation) => {
    if (regulation && regulation.id) {
      navigate(`/regulations/${regulation.id}`);
    }
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

  if (regulationsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <h3 className="text-lg font-semibold mb-2">Unable to Load Regulations</h3>
            <p>Please try refreshing the page. If the problem persists, contact support.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredRegulations = (regulations || []).filter(reg => {
    if (categoryFilter && reg.category !== categoryFilter) {
      return false;
    }
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      return (
        reg.name?.toLowerCase().includes(searchLower) ||
        reg.topic?.toLowerCase().includes(searchLower) ||
        reg.category?.toLowerCase().includes(searchLower) ||
        reg.statute?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const sortedRegulations = filteredRegulations.sort((a, b) => {
    if (!sortConfig) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    const comparison = String(aValue).localeCompare(String(bValue));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const handleSort = (key: keyof Regulation) => {
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

  // Show empty state if no regulations exist or match filters
  if (filteredRegulations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-600">
            <h3 className="text-lg font-semibold mb-2">
              {search.trim() || categoryFilter
                ? "No matching regulations found"
                : "No regulations available"}
            </h3>
            <p>
              {search.trim() || categoryFilter
                ? "Try adjusting your search criteria or filters"
                : "There are currently no regulations in the system."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                <TableHead>Status</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">
                    Name
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('topic')}>
                  <div className="flex items-center gap-2">
                    Topic
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('category')}>
                  <div className="flex items-center gap-2">
                    Category
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Next Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRegulations.map((regulation) => {
                const regulationDeadlines = deadlines.filter(d => d.regulationId === regulation.id);
                const nextDeadline = regulationDeadlines.length > 0
                  ? regulationDeadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
                  : null;

                return (
                  <TableRow
                    key={regulation.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(regulation)}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <CircularProgress
                          progress={nextDeadline?.status === 'completed' ? 100 : 0}
                          size="sm"
                          showPercentage={true}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-base font-medium text-gray-900">
                        {regulation.name || regulation.statute || 'Untitled Regulation'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {regulation.topic || 'No topic specified'}
                      </div>
                    </TableCell>
                    <TableCell>{regulation.category || 'Uncategorized'}</TableCell>
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
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}