import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  FileText,
  Building,
  Calendar,
  ExternalLink,
  ArrowUpDown,
  Download,
  Users,
  Bell
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { EnhancedJurisdictionFilter } from "@/components/filters/enhanced-jurisdiction-filter";

// Calculate compliance status based on regulation data
function calculateComplianceStatus(regulation: any) {
  const today = new Date();
  
  // Check if there are any upcoming deadlines
  if (regulation.nextReviewDate) {
    const reviewDate = new Date(regulation.nextReviewDate);
    const daysUntilReview = differenceInDays(reviewDate, today);
    
    if (daysUntilReview < 0) {
      return { status: "at-risk", message: "Review overdue", daysUntilReview };
    } else if (daysUntilReview <= 30) {
      return { status: "needs-attention", message: "Review due soon", daysUntilReview };
    }
  }
  
  // Check last verified date
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

export default function DashboardPage() {
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [jurisdictionSourceFilter, setJurisdictionSourceFilter] = useState<string>("all");
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState<string>("all");
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Check authentication
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    // Redirect to login using wouter's navigate
    navigate("/auth");
    return null;
  }

  // Fetch regulations from the authenticated API endpoint
  const { data: regulations = [], isLoading } = useQuery({
    queryKey: ["/api/regulations"],
  });

  // Get unique categories for filtering
  const categories = useMemo(() => {
    if (!regulations || !Array.isArray(regulations)) return [];
    return Array.from(new Set(regulations.map((reg: any) => reg.category))).sort();
  }, [regulations]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!regulations || !Array.isArray(regulations)) {
      return {
        total: 0,
        compliant: 0,
        needsAttention: 0,
        atRisk: 0,
      };
    }

    let compliant = 0;
    let needsAttention = 0;
    let atRisk = 0;

    regulations.forEach((reg: any) => {
      const status = calculateComplianceStatus(reg).status;
      if (status === "compliant") compliant++;
      if (status === "needs-attention") needsAttention++;
      if (status === "at-risk") atRisk++;
    });

    return {
      total: regulations.length,
      compliant,
      needsAttention,
      atRisk,
    };
  }, [regulations]);

  // Filter and sort regulations
  const filteredRegulations = useMemo(() => {
    if (!regulations || !Array.isArray(regulations)) return [];

    let filtered = regulations.filter((reg: any) => {
      const matchesSearch = !searchQuery || 
        reg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.agency_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || reg.category === categoryFilter;
      const matchesJurisdictionSource = jurisdictionSourceFilter === "all" || reg.jurisdictionSource === jurisdictionSourceFilter;
      const matchesInstitutionType = institutionTypeFilter === "all" || 
        (reg.applicableInstitutions && reg.applicableInstitutions.includes(institutionTypeFilter));
      
      let matchesCompliance = true;
      if (complianceFilter !== "all") {
        const status = calculateComplianceStatus(reg).status;
        matchesCompliance = status === complianceFilter;
      }
      
      return matchesSearch && matchesCategory && matchesJurisdictionSource && matchesInstitutionType && matchesCompliance;
    });

    // Sort regulations
    filtered.sort((a: any, b: any) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [regulations, searchQuery, categoryFilter, jurisdictionSourceFilter, institutionTypeFilter, complianceFilter, sortBy, sortDirection]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading regulations dashboard...</p>
        </div>
      </div>
    );
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Regulatory Compliance Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor and track regulatory compliance across all jurisdictions
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
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search regulations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <EnhancedJurisdictionFilter
                jurisdictionSourceFilter={jurisdictionSourceFilter}
                setJurisdictionSourceFilter={setJurisdictionSourceFilter}
                institutionTypeFilter={institutionTypeFilter}
                setInstitutionTypeFilter={setInstitutionTypeFilter}
                onClearFilters={() => {
                  setJurisdictionSourceFilter("all");
                  setInstitutionTypeFilter("all");
                }}
                showTitle={false}
              />

              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Compliance Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="needs-attention">Needs Attention</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setJurisdictionSourceFilter("all");
                  setInstitutionTypeFilter("all");
                  setComplianceFilter("all");
                }}
              >
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
                    <TableHead>Applies To</TableHead>
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
                      onClick={() => handleSort('nextReviewDate')}
                    >
                      <div className="flex items-center gap-2">
                        Next Review
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegulations.map((regulation: any) => {
                    const complianceStatus = calculateComplianceStatus(regulation);
                    
                    return (
                      <TableRow 
                        key={regulation.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/regulations/${regulation.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 line-clamp-2">
                              {regulation.name || regulation.topic}
                            </p>
                            {regulation.itemId && (
                              <p className="text-sm text-gray-500">
                                ID: {regulation.itemId}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {regulation.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={regulation.jurisdiction === 'federal' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {regulation.jurisdiction}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {regulation.applicableInstitutions && Array.isArray(regulation.applicableInstitutions) ? (
                              regulation.applicableInstitutions.slice(0, 3).map((type: string) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                All Institutions
                              </Badge>
                            )}
                            {regulation.applicableInstitutions && regulation.applicableInstitutions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{regulation.applicableInstitutions.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {regulation.agency_name || 'Not specified'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complianceStatus.status)}`}>
                            {getStatusIcon(complianceStatus.status)}
                            {complianceStatus.message}
                          </div>
                        </TableCell>
                        <TableCell>
                          {regulation.lastVerified ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {format(parseISO(regulation.lastVerified), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Not verified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {regulation.nextReviewDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {format(parseISO(regulation.nextReviewDate), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/regulations/${regulation.id}`);
                              }}
                            >
                              View Details
                            </Button>
                            {regulation.regulationUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(regulation.regulationUrl, '_blank');
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
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
      </div>
    </div>
  );
}