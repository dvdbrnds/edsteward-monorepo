import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  FileText,
  Building,
  Calendar,
  ExternalLink,
  ArrowUpDown
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

// Simple interfaces
interface Regulation {
  id: string;
  name: string;
  category: string;
  jurisdiction: string;
  agency_name: string;
  lastVerified?: string;
  last_updated?: string;
  nextReviewDate?: string;
  regulationUrl?: string;
  applicableInstitutions?: string[];
}

interface Stats {
  total: number;
  compliant: number;
  needsAttention: number;
  atRisk: number;
}

// Calculate compliance status
function calculateComplianceStatus(regulation: Regulation) {
  const today = new Date();
  
  if (regulation.nextReviewDate) {
    const reviewDate = new Date(regulation.nextReviewDate);
    const daysUntilReview = differenceInDays(reviewDate, today);
    
    if (daysUntilReview < 0) {
      return { status: "at-risk", message: "Review overdue", daysUntilReview };
    } else if (daysUntilReview <= 30) {
      return { status: "needs-attention", message: "Review due soon", daysUntilReview };
    }
  }
  
  if (regulation.lastVerified) {
    const lastVerified = new Date(regulation.lastVerified);
    const daysSinceVerified = differenceInDays(today, lastVerified);
    
    if (daysSinceVerified > 365) {
      return { status: "at-risk", message: "Not verified in over a year", daysSinceVerified };
    } else if (daysSinceVerified > 180) {
      return { status: "needs-attention", message: "Verification needed", daysSinceVerified };
    }
  }
  
  return { status: "compliant", message: "Up to date" };
}

function getStatusColor(status: string) {
  switch (status) {
    case "compliant":
      return "text-green-600 bg-green-50";
    case "needs-attention":
      return "text-yellow-600 bg-yellow-50";
    case "at-risk":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "compliant":
      return <CheckCircle2 className="h-4 w-4" />;
    case "needs-attention":
      return <Clock className="h-4 w-4" />;
    case "at-risk":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export default function TrusteesDashboard() {
  // Simple state management - no complex hooks
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch regulations on component mount - client-side only
  useEffect(() => {
    async function fetchRegulations() {
      try {
        setLoading(true);
        const response = await fetch('/api/regulations');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch regulations: ${response.status}`);
        }
        
        const data = await response.json();
        setRegulations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching regulations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load regulations');
        setRegulations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchRegulations();
  }, []);

  // Calculate stats - only run when not loading to avoid empty data calculations
  const stats: Stats = React.useMemo(() => {
    if (loading || error) return { total: 0, compliant: 0, needsAttention: 0, atRisk: 0 };
    
    const total = regulations.length;
    let compliant = 0;
    let needsAttention = 0;
    let atRisk = 0;

    regulations.forEach(reg => {
      const status = calculateComplianceStatus(reg);
      switch (status.status) {
        case "compliant":
          compliant++;
          break;
        case "needs-attention":
          needsAttention++;
          break;
        case "at-risk":
          atRisk++;
          break;
      }
    });

    return { total, compliant, needsAttention, atRisk };
  }, [regulations, loading, error]);

  // Get unique categories and jurisdictions - safe defaults when loading
  const categories = React.useMemo(() => {
    if (loading || error) return [];
    const cats = Array.from(new Set(regulations.map(reg => reg.category).filter(Boolean)));
    return cats.sort();
  }, [regulations, loading, error]);

  const jurisdictions = React.useMemo(() => {
    if (loading || error) return [];
    const juris = Array.from(new Set(regulations.map(reg => reg.jurisdiction).filter(Boolean)));
    return juris.sort();
  }, [regulations, loading, error]);

  // Filter and sort regulations - safe defaults when loading
  const filteredRegulations = React.useMemo(() => {
    if (loading || error) return [];
    
    let filtered = regulations.filter(reg => {
      const matchesSearch = !searchQuery || 
        reg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.agency_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || reg.category === categoryFilter;
      const matchesJurisdiction = jurisdictionFilter === "all" || reg.jurisdiction === jurisdictionFilter;
      
      let matchesCompliance = true;
      if (complianceFilter !== "all") {
        const status = calculateComplianceStatus(reg).status;
        matchesCompliance = status === complianceFilter;
      }
      
      return matchesSearch && matchesCategory && matchesJurisdiction && matchesCompliance;
    });

    // Sort regulations
    filtered.sort((a, b) => {
      let aValue = a[sortBy as keyof Regulation] || "";
      let bValue = b[sortBy as keyof Regulation] || "";
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [regulations, searchQuery, categoryFilter, jurisdictionFilter, complianceFilter, sortBy, sortDirection, loading, error]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setJurisdictionFilter("all");
    setComplianceFilter("all");
  };

  // Now we can safely use early returns after ALL hooks have been called
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trustees dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Trustees Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Regulatory compliance overview for institutional governance
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Regulations</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Compliant</p>
                  <p className="text-3xl font-bold text-green-600">{stats.compliant}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Needs Attention</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.needsAttention}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">At Risk</p>
                  <p className="text-3xl font-bold text-red-600">{stats.atRisk}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search regulations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Jurisdiction Filter */}
              <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Jurisdictions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jurisdictions</SelectItem>
                  {jurisdictions.map(jurisdiction => (
                    <SelectItem key={jurisdiction} value={jurisdiction}>
                      {jurisdiction}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Compliance Filter */}
              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="needs-attention">Needs Attention</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Regulations Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Regulatory Compliance Overview ({filteredRegulations.length} regulations)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Regulation Name
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-2">
                        Category
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('jurisdiction')}
                    >
                      <div className="flex items-center gap-2">
                        Jurisdiction
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Compliance Status</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('lastVerified')}
                    >
                      <div className="flex items-center gap-2">
                        Last Verified
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('last_updated')}
                    >
                      <div className="flex items-center gap-2">
                        Last Updated
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegulations.map((regulation) => {
                    const complianceStatus = calculateComplianceStatus(regulation);
                    
                    return (
                      <TableRow key={regulation.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">
                              {regulation.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {regulation.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            {regulation.jurisdiction}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {regulation.agency_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complianceStatus.status)}`}>
                            {getStatusIcon(complianceStatus.status)}
                            {complianceStatus.message}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {regulation.lastVerified 
                              ? format(new Date(regulation.lastVerified), 'MMM d, yyyy')
                              : 'Not verified'
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {regulation.last_updated 
                              ? format(new Date(regulation.last_updated), 'MMM d, yyyy')
                              : 'Unknown'
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          {regulation.regulationUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(regulation.regulationUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {filteredRegulations.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No regulations found</h3>
                <p className="text-gray-600">
                  Try adjusting your filters to see more results.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
