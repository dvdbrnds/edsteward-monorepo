import Navigation from "@/components/layout/navigation";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, X, ArrowUpDown, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { calculateComplianceStatus } from "@/lib/compliance-status";

// Constants for the enhanced jurisdiction system
const JURISDICTION_SOURCES = [
  { value: "federal", label: "Federal Government" },
  { value: "state", label: "State Government" },
  { value: "international", label: "International" },
  { value: "private-organization", label: "Private Organization" },
  { value: "accreditor", label: "Accrediting Body" },
  { value: "industry-association", label: "Industry Association" }
];

const INSTITUTION_TYPES = [
  { value: "public-universities", label: "Public Universities" },
  { value: "private-universities", label: "Private Universities" },
  { value: "community-colleges", label: "Community Colleges" },
  { value: "conservatories", label: "Conservatories" },
  { value: "technical-institutes", label: "Technical Institutes" },
  { value: "religious-institutions", label: "Religious Institutions" },
  { value: "for-profit-institutions", label: "For-Profit Institutions" },
  { value: "research-institutes", label: "Research Institutes" },
  { value: "professional-schools", label: "Professional Schools" },
  { value: "all-institutions", label: "All Institution Types" }
];

interface RegulationWithActions {
  id: number;
  itemId: string;
  name: string;
  category: string;
  jurisdictionSource?: string;
  jurisdiction?: string; // Legacy field for backward compatibility
  applicableInstitutions?: string[];
  agency_name?: string;
  actions?: Array<{
    type: string;
    status: string;
    enabled: boolean;
    required: boolean;
  }>;
}

export default function EnhancedDashboardPage() {
  const [_, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [jurisdictionSourceFilter, setJurisdictionSourceFilter] = useState<string>("all");
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState<string>("all");
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch regulations from the API
  const { data: regulations = [], isLoading } = useQuery<RegulationWithActions[]>({
    queryKey: ["/api/regulations"],
  });

  // Get unique categories for filtering
  const categories = useMemo(() => {
    if (!regulations) return [];
    return Array.from(new Set(regulations.map((reg) => reg.category))).sort();
  }, [regulations]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!regulations) {
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

    regulations.forEach((reg) => {
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

  // Enhanced filtering logic
  const filteredRegulations = useMemo(() => {
    if (!regulations) return [];

    let filtered = regulations.filter((reg) => {
      const matchesSearch = !searchQuery || 
        reg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.agency_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || reg.category === categoryFilter;
      
      // Check jurisdiction source (with backward compatibility)
      const regJurisdictionSource = reg.jurisdictionSource || reg.jurisdiction || "federal";
      const matchesJurisdictionSource = jurisdictionSourceFilter === "all" || regJurisdictionSource === jurisdictionSourceFilter;
      
      // Check institution type
      const matchesInstitutionType = institutionTypeFilter === "all" || 
        !reg.applicableInstitutions ||
        reg.applicableInstitutions.includes(institutionTypeFilter) ||
        reg.applicableInstitutions.includes('all-institutions');
      
      let matchesCompliance = true;
      if (complianceFilter !== "all") {
        const status = calculateComplianceStatus(reg).status;
        matchesCompliance = status === complianceFilter;
      }
      
      return matchesSearch && matchesCategory && matchesJurisdictionSource && matchesInstitutionType && matchesCompliance;
    });

    // Sort regulations
    filtered.sort((a, b) => {
      let aValue = (a as any)[sortBy];
      let bValue = (b as any)[sortBy];
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [regulations, searchQuery, categoryFilter, jurisdictionSourceFilter, institutionTypeFilter, complianceFilter, sortBy, sortDirection]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setJurisdictionSourceFilter("all");
    setInstitutionTypeFilter("all");
    setComplianceFilter("all");
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || 
    jurisdictionSourceFilter !== "all" || institutionTypeFilter !== "all" || complianceFilter !== "all";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enhanced regulations dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Enhanced Regulatory Compliance Dashboard</h1>
            <p className="mt-2 text-lg text-gray-600">
              Track and manage compliance across all regulatory sources and institution types
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    <p className="text-sm font-medium text-gray-500">Total Regulations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">{stats.compliant}</p>
                    <p className="text-sm font-medium text-gray-500">Compliant</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-yellow-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{stats.needsAttention}</p>
                    <p className="text-sm font-medium text-gray-500">Needs Attention</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold text-red-600">{stats.atRisk}</p>
                    <p className="text-sm font-medium text-gray-500">At Risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Filters */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Enhanced Filtering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Jurisdiction Source Filter */}
                <Select value={jurisdictionSourceFilter} onValueChange={setJurisdictionSourceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Regulation Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {JURISDICTION_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Institution Type Filter */}
                <Select value={institutionTypeFilter} onValueChange={setInstitutionTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Applies To" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Institution Types</SelectItem>
                    {INSTITUTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Compliance Status Filter */}
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

                {/* Clear Filters Button */}
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Active Filters:</p>
                  <div className="flex flex-wrap gap-2">
                    {searchQuery && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Search: {searchQuery}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                      </Badge>
                    )}
                    {categoryFilter !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Category: {categoryFilter}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter("all")} />
                      </Badge>
                    )}
                    {jurisdictionSourceFilter !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Source: {JURISDICTION_SOURCES.find(s => s.value === jurisdictionSourceFilter)?.label}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setJurisdictionSourceFilter("all")} />
                      </Badge>
                    )}
                    {institutionTypeFilter !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Applies to: {INSTITUTION_TYPES.find(t => t.value === institutionTypeFilter)?.label}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setInstitutionTypeFilter("all")} />
                      </Badge>
                    )}
                    {complianceFilter !== "all" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Status: {complianceFilter}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setComplianceFilter("all")} />
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Regulations Table */}
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
                      <TableHead>Regulation Source</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead>Compliance Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegulations.map((regulation) => {
                      const complianceStatus = calculateComplianceStatus(regulation);
                      const jurisdictionSource = regulation.jurisdictionSource || regulation.jurisdiction || "federal";
                      
                      return (
                        <TableRow 
                          key={regulation.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/regulations/${regulation.id}`)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900 line-clamp-2">
                                {regulation.name}
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
                              variant="outline"
                              className="text-xs"
                            >
                              {JURISDICTION_SOURCES.find(s => s.value === jurisdictionSource)?.label || jurisdictionSource}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {regulation.applicableInstitutions?.map((type) => (
                                <Badge 
                                  key={type}
                                  variant="secondary" 
                                  className="text-xs"
                                >
                                  {INSTITUTION_TYPES.find(t => t.value === type)?.label || type}
                                </Badge>
                              ))}
                              {!regulation.applicableInstitutions && (
                                <Badge variant="secondary" className="text-xs">
                                  All Institutions
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {regulation.agency_name || 'Not specified'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                complianceStatus.status === "compliant" ? "default" :
                                complianceStatus.status === "needs-attention" ? "secondary" : "destructive"
                              }
                              className="text-xs"
                            >
                              {complianceStatus.status === "compliant" ? "Compliant" :
                               complianceStatus.status === "needs-attention" ? "Needs Attention" : "At Risk"}
                            </Badge>
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
      </main>
    </div>
  );
} 