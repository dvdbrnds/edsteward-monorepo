import { useQuery, useMutation } from "@tanstack/react-query";
import type { Regulation, Deadline, InsertDeadline, RegulationAction } from "@shared/schema";
import { useLocation } from "wouter";
import { Search, ExternalLink, CheckCircle, AlertCircle, Clock, Loader2, ArrowUpDown, Check, Globe, Mail, FileText, AlertTriangle, Info } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

// Calculate compliance status with beautiful icons
function calculateComplianceStatus(regulation: Regulation): {
  status: "compliant" | "needs-attention" | "at-risk" | "unknown";
  icon: JSX.Element;
  label: string;
  className: string;
} {
  // If no last update or verification, it's unknown
  if (!regulation.lastUpdated && !regulation.lastVerified) {
    return {
      status: "unknown",
      icon: <Info className="h-4 w-4 text-gray-500" />,
      label: "Unknown",
      className: "text-gray-500 bg-gray-100",
    };
  }

  // Calculate days since last update
  const daysSinceUpdate = regulation.lastUpdated
    ? differenceInDays(new Date(), new Date(regulation.lastUpdated))
    : 999;

  // Check if next review date is past due
  const isReviewOverdue = regulation.nextReviewDate
    ? differenceInDays(new Date(), new Date(regulation.nextReviewDate)) > 0
    : false;

  // At risk if overdue by more than 90 days or review date is past due
  if (daysSinceUpdate > 90 || isReviewOverdue) {
    return {
      status: "at-risk",
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      label: "At Risk",
      className: "text-red-600 bg-red-50",
    };
  }

  // Needs attention if overdue by more than 30 days
  if (daysSinceUpdate > 30) {
    return {
      status: "needs-attention",
      icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
      label: "Needs Attention",
      className: "text-yellow-600 bg-yellow-50",
    };
  }

  // Compliant - recently updated
  return {
    status: "compliant",
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    label: "Compliant",
    className: "text-green-600 bg-green-50",
  };
}

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

  const { data: user } = useQuery<{ role?: string }>({
    queryKey: ["/api/user"]
  });

  const isAdmin = user?.role?.toLowerCase() === "admin";

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

  const filteredRegulations = Array.isArray(regulations) ? regulations.filter((reg: Regulation) => {
    if (categoryFilter && reg.category !== categoryFilter) {
      return false;
    }
    if (jurisdictionFilter && reg.jurisdictionSource !== jurisdictionFilter) {
      return false;
    }
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      return (
        reg.itemId?.toLowerCase().includes(searchLower) ||
        reg.name?.toLowerCase().includes(searchLower) ||
        reg.topic?.toLowerCase().includes(searchLower) ||
        reg.category?.toLowerCase().includes(searchLower) ||
        reg.statute?.toLowerCase().includes(searchLower) ||
        reg.dro?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  }) : [];

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

  const getDroEmailByCategory = (category: string) => {
    switch(category) {
      case 'Campus Safety':
        return 'campus.safety@university.edu';
      case 'Academic Programs':
        return 'academic.affairs@university.edu';
      case 'Finance':
        return 'finance@university.edu';
      case 'Human Resources':
        return 'hr@university.edu';
      case 'Information Technology':
        return 'it.security@university.edu';
      case 'Research':
        return 'research.compliance@university.edu';
      default:
        return 'compliance@university.edu';
    }
  };

  const getInstitutionTypeColor = (type: string) => {
    switch(type) {
      case 'public-universities':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'private-universities':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'community-colleges':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'religious-institutions':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'for-profit-institutions':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'conservatories':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'technical-institutes':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'professional-schools':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'research-institutes':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'all-institutions':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
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
                <TableHead className="cursor-pointer" onClick={() => handleSort('itemId')}>
                  <div className="flex items-center gap-2">
                    ID
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">
                    Name
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('category')}>
                  <div className="flex items-center gap-2">
                    Category
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('dro')}>
                  <div className="flex items-center gap-2">
                    DRO
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Deadline</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('jurisdictionSource')}>
                  <div className="flex items-center gap-2">
                    Jurisdiction
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Applies To</TableHead>
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
                      <div className="text-sm text-gray-500">
                        {regulation.itemId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-base font-medium text-gray-900">
                        {regulation.name || regulation.statute || 'Untitled Regulation'}
                      </div>
                    </TableCell>
                    <TableCell>{regulation.category || 'Uncategorized'}</TableCell>
                    <TableCell>
                      <div className="text-sm text-blue-600">
                        {regulation.dro || getDroEmailByCategory(regulation.category)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-3">
                        {(regulation.actions || [
                          { type: 'attestation', enabled: true, required: true, status: 'pending' },
                          { type: 'website_publish', enabled: true, required: false, status: 'pending' },
                          { type: 'community_communication', enabled: true, required: false, status: 'pending' },
                          { type: 'agency_submission', enabled: true, required: true, status: 'pending' }
                        ]).map(action => (
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
                    </TableCell>
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
                    <TableCell>
                      <div className={`text-sm ${regulation.jurisdictionSource === 'federal' ? 'text-blue-600' : 'text-green-600'}`}>
                        {regulation.jurisdictionSource === 'federal' ? 'Federal' : 'State'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {regulation.applicableInstitutions && Array.isArray(regulation.applicableInstitutions) ? (
                          regulation.applicableInstitutions.slice(0, 3).map((type: string) => (
                            <Badge 
                              key={type} 
                              variant="outline" 
                              className={`text-xs ${getInstitutionTypeColor(type)}`}
                            >
                              {type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Badge>
                          ))
                        ) : (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getInstitutionTypeColor('all-institutions')}`}
                          >
                            All Institutions
                          </Badge>
                        )}
                        {regulation.applicableInstitutions && regulation.applicableInstitutions.length > 3 && (
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-gray-50 text-gray-600 border-gray-300"
                          >
                            +{regulation.applicableInstitutions.length - 3} more
                          </Badge>
                        )}
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