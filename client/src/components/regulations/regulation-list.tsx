import { useQuery, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, InsertDeadline, RegulationAction } from "@shared/schema";
import { useLocation } from "wouter";
import { Search, ExternalLink, CheckCircle, AlertCircle, Clock, Loader2, ArrowUpDown, Check, Globe, Mail, FileText } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RegulationListProps {
  categoryFilter: string | null;
  jurisdictionFilter: 'federal' | 'state' | null;
  deadlines?: Deadline[];
}

type SortConfig = {
  key: keyof Regulation;
  direction: 'asc' | 'desc';
} | null;

export default function RegulationList({ categoryFilter, jurisdictionFilter, deadlines = [] }: RegulationListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  const { data: regulations = [], isLoading: regulationsLoading, error: regulationsError } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  const { data: deadlinesData = [], isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: user = {} } = useQuery({
    queryKey: ["/api/user"]
  });

  const isAdmin = user?.role === "admin";

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

  const filteredRegulations = regulations.filter((reg: Regulation) => {
    if (categoryFilter && reg.category !== categoryFilter) {
      return false;
    }
    if (jurisdictionFilter && reg.jurisdiction !== jurisdictionFilter) {
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

  const sortedRegulations = [...filteredRegulations].sort((a: Regulation, b: Regulation) => {
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

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'attestation':
        return <Check className="h-4 w-4" />;
      case 'website_publish':
        return <Globe className="h-4 w-4" />;
      case 'community_communication':
        return <Mail className="h-4 w-4" />;
      case 'agency_submission':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionStatus = (action: RegulationAction) => {
    if (!action.enabled) return 'opacity-30';

    // All completed actions use cool green color
    if (action.status === 'completed') {
      return cn(
        'text-emerald-600',
        !action.required && 'opacity-75' // Slightly dim non-required completed actions
      );
    }

    // Non-required incomplete actions use neutral colors
    if (!action.required) {
      return 'text-gray-400 opacity-40';
    }

    // Required incomplete actions use red
    return 'text-rose-500'; // Warm color for attention needed
  };

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
                <TableHead className="cursor-pointer" onClick={() => handleSort('jurisdiction')}>
                  <div className="flex items-center gap-2">
                    Jurisdiction
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Status & Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRegulations.map((regulation: Regulation) => {
                const regulationDeadlines = deadlinesData.filter(d => d.regulationId === regulation.id);
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
                      <div className={`text-sm ${regulation.jurisdiction === 'federal' ? 'text-blue-600' : 'text-green-600'}`}>
                        {regulation.jurisdiction === 'federal' ? 'Federal' : 'State'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
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
                        <div className="flex gap-3">
                          {regulation.actions?.map(action => (
                            <div
                              key={action.type}
                              className={cn(
                                "relative flex items-center gap-1 transition-all duration-200",
                                getActionStatus(action),
                                action.required ? "scale-110" : "scale-90"
                              )}
                              title={`${action.type.replace('_', ' ')} ${action.required ? '(Required)' : '(Optional)'} - ${action.status}`}
                            >
                              {getActionIcon(action.type)}
                              {action.required && (
                                <div className="absolute -top-1 -right-1 flex items-center justify-center">
                                  <div
                                    className={cn(
                                      "h-2 w-2 rounded-full",
                                      action.status === 'completed'
                                        ? "bg-emerald-600"
                                        : "bg-rose-500 animate-pulse"
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
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