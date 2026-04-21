import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline, RegulationAction } from "@shared/schema";
import { useLocation } from "wouter";
import { Search, CheckCircle, AlertCircle, Clock, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Check, Globe, Mail, FileText, X, Filter, Eye, EyeOff, Columns, RotateCcw, MapPin } from "lucide-react";
import { JURISDICTION_SOURCES } from "@/components/filters/enhanced-jurisdiction-filter";
import { useInstitutionFilter } from "@/hooks/use-institution-filter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DeadlineTimelineBar } from "./deadline-timeline-bar";

// Column definitions for visibility control
type ColumnKey = 'id' | 'name' | 'riskScore' | 'category' | 'dro' | 'status' | 'nextDeadline' | 'lastUpdated' | 'jurisdiction' | 'appliesTo';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  required?: boolean;
}

const COLUMN_DEFINITIONS: ColumnDef[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', required: true },
  { key: 'riskScore', label: 'Risk' },
  { key: 'category', label: 'Category' },
  { key: 'dro', label: 'DRO' },
  { key: 'status', label: 'Status' },
  { key: 'nextDeadline', label: 'Next Deadline' },
  { key: 'lastUpdated', label: 'Last Updated' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
  { key: 'appliesTo', label: 'Applies To' },
];

const STORAGE_KEY = 'edsteward-regulation-columns';

// Column header component with inline hide button
interface ColumnHeaderProps {
  columnKey: ColumnKey;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  activeSortKey?: string | null;
  activeSortDirection?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
  onHide: (key: ColumnKey) => void;
  canHide?: boolean;
}

function ColumnHeader({ columnKey, label, sortable, sortKey, activeSortKey, activeSortDirection, onSort, onHide, canHide = true }: ColumnHeaderProps) {
  const isActive = sortable && sortKey && activeSortKey === sortKey;

  const SortIcon = isActive
    ? (activeSortDirection === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown;

  return (
    <div className="flex items-center gap-1 group">
      <div 
        className={cn("flex items-center gap-2 flex-1", sortable && "cursor-pointer")}
        onClick={() => sortable && sortKey && onSort?.(sortKey)}
      >
        {label}
        {sortable && <SortIcon className={cn("h-4 w-4", isActive && "text-foreground")} />}
      </div>
      {canHide && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onHide(columnKey);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity"
          title={`Hide ${label} column`}
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}

const getDefaultVisibility = (): Record<ColumnKey, boolean> => ({
  id: true,
  name: true,
  riskScore: true,
  category: true,
  dro: true,
  status: true,
  nextDeadline: true,
  lastUpdated: true,
  jurisdiction: true,
  appliesTo: false,
});

interface RegulationListProps {
  categoryFilter: string | null;
  jurisdictionFilter: 'federal' | 'state' | null;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;



type StatusFilter = 'all' | 'overdue' | 'upcoming' | 'no-deadlines';

const HIDE_COMPLIANT_KEY = 'edsteward-hide-compliant';

export default function RegulationList({ categoryFilter, jurisdictionFilter }: RegulationListProps) {
  const { regulationsQueryKey } = useInstitutionFilter();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'lastUpdated', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [jurisdictionSourceFilter, setJurisdictionSourceFilter] = useState<string>('all');
  const [hideCompliant, setHideCompliant] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HIDE_COMPLIANT_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [, navigate] = useLocation();
  
  // Persist hide compliant preference
  useEffect(() => {
    localStorage.setItem(HIDE_COMPLIANT_KEY, String(hideCompliant));
  }, [hideCompliant]);
  
  // Column visibility state - load from localStorage
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...getDefaultVisibility(), ...JSON.parse(saved) };
      }
    } catch {
      // Ignore parse errors
    }
    return getDefaultVisibility();
  });

  // Persist column visibility to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const toggleColumn = (key: ColumnKey) => {
    const column = COLUMN_DEFINITIONS.find(c => c.key === key);
    if (column?.required) return; // Can't hide required columns
    
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const resetColumns = () => {
    setColumnVisibility(getDefaultVisibility());
  };

  const hiddenColumnCount = COLUMN_DEFINITIONS.filter(col => !columnVisibility[col.key]).length;
  const isColumnVisible = (key: ColumnKey) => columnVisibility[key];

  const { data: regulations = [], isLoading: regulationsLoading, error: regulationsError } = useQuery<Regulation[]>({
    queryKey: regulationsQueryKey,
  });

  const { data: deadlinesData = [], isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
    staleTime: 1000 * 60, // 1 minute
  });



  const handleRowClick = (regulation: Regulation) => {
    if (regulation && regulation.id) {
      navigate(`/regulations/${regulation.id}`);
    }
  };

  // Get compliance status based on attestation/required actions
  // NOTE: Must be defined before filteredRegulations which references it
  const getComplianceStatus = (regulation: Regulation): 'compliant' | 'partial' | 'non-compliant' => {
    const actions: RegulationAction[] = regulation.actions || [
      { type: 'attestation', enabled: true, required: true, status: 'pending' },
      { type: 'website_publish', enabled: false, required: false, status: 'pending' },
      { type: 'community_communication', enabled: false, required: false, status: 'pending' },
      { type: 'agency_submission', enabled: false, required: false, status: 'pending' }
    ];
    
    const requiredActions = actions.filter((a: RegulationAction) => a.required && a.enabled);
    const completedRequired = requiredActions.filter((a: RegulationAction) => a.status === 'completed');
    
    if (requiredActions.length === 0) {
      // No required actions - check if attestation is complete
      const attestation = actions.find((a: RegulationAction) => a.type === 'attestation');
      if (attestation?.status === 'completed') return 'compliant';
      return 'non-compliant';
    }
    
    if (completedRequired.length === requiredActions.length) {
      return 'compliant'; // All required actions complete
    } else if (completedRequired.length > 0) {
      return 'partial'; // Some required actions complete
    }
    return 'non-compliant'; // No required actions complete
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

  // Helper to get deadline status for a regulation
  const getRegulationDeadlineStatus = (regulationId: number): 'overdue' | 'upcoming' | 'no-deadlines' => {
    const regDeadlines = deadlinesData.filter(d => d.regulationId === regulationId);
    if (regDeadlines.length === 0) return 'no-deadlines';
    
    const now = new Date();
    const hasOverdue = regDeadlines.some(d => 
      d.status !== 'completed' && new Date(d.dueDate) < now
    );
    if (hasOverdue) return 'overdue';
    return 'upcoming';
  };

  const filteredRegulations = Array.isArray(regulations) ? regulations.filter((reg: Regulation) => {
    if (categoryFilter && reg.category !== categoryFilter) {
      return false;
    }
    if (jurisdictionFilter && reg.jurisdictionSource !== jurisdictionFilter) {
      return false;
    }
    if (jurisdictionSourceFilter !== 'all') {
      const regSource = reg.jurisdictionSource || 'federal';
      if (regSource !== jurisdictionSourceFilter) return false;
    }
    // Status filter
    if (statusFilter !== 'all') {
      const deadlineStatus = getRegulationDeadlineStatus(reg.id);
      if (statusFilter !== deadlineStatus) {
        return false;
      }
    }
    // Hide compliant filter
    if (hideCompliant && getComplianceStatus(reg) === 'compliant') {
      return false;
    }
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const regKey = ((reg as any).regKey || (reg as any).reg_key || '') as string;
      return (
        regKey.toLowerCase().includes(searchLower) ||
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

    // Sort by regKey for the ID column.
    // REG-XXX entries first (sorted by number), then state codes alphabetically
    // (each state group sorted by number).
    if (sortConfig.key === 'id' as any) {
      const aKey = ((a as any).regKey || (a as any).reg_key || '') as string;
      const bKey = ((b as any).regKey || (b as any).reg_key || '') as string;
      const parseKey = (k: string) => {
        const m = k.match(/^([A-Z]{2,3})-(\d+)$/i);
        if (!m) return { prefix: k, num: 0 };
        return { prefix: m[1].toUpperCase(), num: parseInt(m[2], 10) };
      };
      const ap = parseKey(aKey);
      const bp = parseKey(bKey);
      let comparison: number;
      if (ap.prefix === bp.prefix) {
        comparison = ap.num - bp.num;
      } else {
        // REG sorts before any state code
        const aIsReg = ap.prefix === 'REG' ? 0 : 1;
        const bIsReg = bp.prefix === 'REG' ? 0 : 1;
        comparison = aIsReg !== bIsReg ? aIsReg - bIsReg : ap.prefix.localeCompare(bp.prefix);
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }

    // Numeric sort for risk score
    if (sortConfig.key === 'riskScore' as any) {
      const aScore = ((a as any).riskScore ?? (a as any).risk_score ?? 0) as number;
      const bScore = ((b as any).riskScore ?? (b as any).risk_score ?? 0) as number;
      const comparison = aScore - bScore;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }

    const aValue = (a as Record<string, any>)[sortConfig.key];
    const bValue = (b as Record<string, any>)[sortConfig.key];

    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    if (sortConfig.key === 'lastUpdated') {
      const aTime = new Date(aValue as string).getTime();
      const bTime = new Date(bValue as string).getTime();
      const comparison = aTime - bTime;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }

    const comparison = String(aValue).localeCompare(String(bValue));
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const handleSort = (key: string) => {
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

    // All completed actions use bright green - no dimming!
    if (action.status === 'completed') {
      return 'text-emerald-600';
    }

    // Non-required incomplete actions use neutral colors
    if (!action.required) {
      return 'text-muted-foreground opacity-40';
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
        return 'bg-gray-100 text-foreground border-border';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Get row background tint based on compliance status
  const getComplianceRowClass = (regulation: Regulation): string => {
    const status = getComplianceStatus(regulation);
    switch (status) {
      case 'compliant':
        return 'bg-green-50/50 hover:bg-green-100/50 border-l-4 border-l-green-500';
      case 'partial':
        return 'bg-yellow-50/50 hover:bg-yellow-100/50 border-l-4 border-l-yellow-500';
      case 'non-compliant':
        return 'bg-red-50/50 hover:bg-red-100/50 border-l-4 border-l-red-500';
      default:
        return '';
    }
  };

  const hasActiveFilters = search || statusFilter !== 'all' || jurisdictionSourceFilter !== 'all' || hideCompliant || categoryFilter || jurisdictionFilter;
  const totalCount = Array.isArray(regulations) ? regulations.length : 0;

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter('all');
    setJurisdictionSourceFilter('all');
    setHideCompliant(false);
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 mb-6">
          {/* Search and filters row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, category, DRO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9"
                aria-label="Search regulations"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="overdue">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    Overdue
                  </span>
                </SelectItem>
                <SelectItem value="upcoming">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-yellow-500" />
                    Upcoming
                  </span>
                </SelectItem>
                <SelectItem value="no-deadlines">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    No Deadlines
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={jurisdictionSourceFilter} onValueChange={setJurisdictionSourceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Jurisdiction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jurisdictions</SelectItem>
                {JURISDICTION_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Column visibility dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" className="w-full sm:w-auto">
                  <Columns className="h-4 w-4 mr-2" />
                  Columns
                  {hiddenColumnCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {hiddenColumnCount} hidden
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Toggle Columns</span>
                  {hiddenColumnCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetColumns}
                      className="h-6 px-2 text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore All
                    </Button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMN_DEFINITIONS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={columnVisibility[column.key]}
                    onCheckedChange={() => toggleColumn(column.key)}
                    disabled={column.required}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {columnVisibility[column.key] ? (
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      )}
                      {column.label}
                      {column.required && (
                        <span className="text-xs text-muted-foreground">(required)</span>
                      )}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Hide compliant checkbox and results count */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Showing {sortedRegulations.length} of {totalCount} regulations
                {hasActiveFilters && " (filtered)"}
              </span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideCompliant}
                  onChange={(e) => setHideCompliant(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                />
                <span className="text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  Hide compliant
                </span>
              </label>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isColumnVisible('id') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="id" 
                      label="ID" 
                      sortable 
                      sortKey="id" 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('name') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="name" 
                      label="Name" 
                      sortable 
                      sortKey="name" 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                      canHide={false}
                    />
                  </TableHead>
                )}
                {isColumnVisible('riskScore') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="riskScore" 
                      label="Risk" 
                      sortable 
                      sortKey={'riskScore' as any} 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('category') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="category" 
                      label="Category" 
                      sortable 
                      sortKey="category" 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('dro') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="dro" 
                      label="DRO" 
                      sortable 
                      sortKey="dro" 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('status') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="status" 
                      label="Status" 
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('nextDeadline') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="nextDeadline" 
                      label="Next Deadline" 
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('lastUpdated') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="lastUpdated" 
                      label="Last Updated" 
                      sortable 
                      sortKey="lastUpdated" 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('jurisdiction') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="jurisdiction" 
                      label="Jurisdiction" 
                      sortable 
                      sortKey="jurisdictionSource" 
                      activeSortKey={(sortConfig?.key as string) ?? null}
                      activeSortDirection={sortConfig?.direction ?? null}
                      onSort={handleSort}
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
                {isColumnVisible('appliesTo') && (
                  <TableHead>
                    <ColumnHeader 
                      columnKey="appliesTo" 
                      label="Applies To" 
                      onHide={toggleColumn}
                    />
                  </TableHead>
                )}
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
                    className={cn(
                      "cursor-pointer transition-colors",
                      getComplianceRowClass(regulation)
                    )}
                    onClick={() => handleRowClick(regulation)}
                  >
                    {isColumnVisible('id') && (
                      <TableCell>
                        <div className="text-sm font-mono font-semibold text-foreground">
                          {(regulation as any).regKey || (regulation as any).reg_key || regulation.id}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('name') && (
                      <TableCell>
                        <div className="text-base font-medium text-foreground">
                          {regulation.name || regulation.statute || 'Untitled Regulation'}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('riskScore') && (
                      <TableCell>
                        {(() => {
                          const score = (regulation as any).riskScore ?? (regulation as any).risk_score;
                          const level = ((regulation as any).riskLevel ?? (regulation as any).risk_level ?? '') as string;
                          if (score == null) return <span className="text-muted-foreground text-xs">--</span>;
                          const colorClass =
                            level === 'CRITICAL' ? 'bg-red-100 text-red-800 border-red-300' :
                            level === 'SEVERE' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                            level === 'HIGH' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            level === 'MODERATE' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                            'bg-green-100 text-green-800 border-green-300';
                          return (
                            <Badge variant="outline" className={`text-xs font-medium ${colorClass}`}>
                              {score} {level}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                    )}
                    {isColumnVisible('category') && (
                      <TableCell>{regulation.category || 'Uncategorized'}</TableCell>
                    )}
                    {isColumnVisible('dro') && (
                      <TableCell>
                        <div className="text-sm text-blue-600">
                          {regulation.dro || getDroEmailByCategory(regulation.category)}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('status') && (
                      <TableCell>
                        <div className="flex gap-3">
                          {(regulation.actions || [
                            { type: 'attestation', enabled: true, required: true, status: 'pending' },
                            { type: 'website_publish', enabled: false, required: false, status: 'pending' },
                            { type: 'community_communication', enabled: false, required: false, status: 'pending' },
                            { type: 'agency_submission', enabled: false, required: false, status: 'pending' }
                          ]).map((action: RegulationAction) => (
                            <div
                              key={action.type}
                              className={cn(
                                "relative flex items-center gap-1 transition-all duration-200",
                                getActionStatus(action)
                              )}
                              title={`${action.type.replace('_', ' ')} ${action.required ? '(Required)' : '(Optional)'} - ${action.status}`}
                            >
                              {getActionIcon(action.type)}
                              {/* Show green dot for completed OR red dot for required incomplete */}
                              {(action.status === 'completed' || action.required) && (
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
                    )}
                    {isColumnVisible('nextDeadline') && (
                      <TableCell>
                        {nextDeadline ? (
                          <DeadlineTimelineBar
                            dueDate={nextDeadline.dueDate}
                            status={nextDeadline.status}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">No deadlines</span>
                        )}
                      </TableCell>
                    )}
                    {isColumnVisible('lastUpdated') && (
                      <TableCell>
                        {regulation.lastUpdated ? (
                          <div className="text-sm text-blue-700">
                            {format(new Date(regulation.lastUpdated), "PP")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not updated</span>
                        )}
                      </TableCell>
                    )}
                    {isColumnVisible('jurisdiction') && (
                      <TableCell>
                        <div className={`text-sm ${regulation.jurisdictionSource === 'federal' ? 'text-blue-600' : 'text-green-600'}`}>
                          {regulation.jurisdictionSource === 'federal' ? 'Federal' : 'State'}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('appliesTo') && (
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
                              className="text-xs bg-background text-muted-foreground border-border"
                            >
                              +{regulation.applicableInstitutions.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
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