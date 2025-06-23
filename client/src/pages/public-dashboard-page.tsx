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
import { AppliesToFilter, filterRegulationsByAppliesTo } from "@/components/filters/applies-to-filter";

// Institution configuration interface
interface InstitutionConfig {
  primaryTypes: string[];
  hideNonApplicable: boolean;
  allowUsersToToggle: boolean;
}

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
  const [selectedInstitutionTypes, setSelectedInstitutionTypes] = useState<string[]>([]);
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Institution configuration state
  const [institutionConfig, setInstitutionConfig] = useState<InstitutionConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Check authentication
  const { user, isLoading: authLoading } = useAuth();

  // Fetch regulations from the authenticated API endpoint with institution filtering
  const { data: regulations = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/regulations", institutionConfig?.primaryTypes, institutionConfig?.hideNonApplicable],
    queryFn: async () => {
      let url = "/api/regulations";
      
      // If institution configuration is set to hide non-applicable and we have primary types
      if (institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0) {
        // Use the first primary type for backend filtering (most specific)
        const primaryType = institutionConfig.primaryTypes[0];
        url += `?institutionType=${primaryType}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch regulations");
      }
      return response.json();
    },
    enabled: !isLoadingConfig, // Only fetch when we have loaded the institution config
  });

  // Load institution configuration on mount and periodically check for updates
  useEffect(() => {
    const loadInstitutionConfig = async () => {
      try {
        const response = await fetch('/api/admin/institution-config');
        if (response.ok) {
          const data = await response.json();
          const newConfig = data.institutionConfig;
          
          // Check if configuration actually changed
          const configChanged = JSON.stringify(institutionConfig) !== JSON.stringify(newConfig);
          
          setInstitutionConfig(newConfig);
          
          // If hideNonApplicable is true, automatically set the primary types as selected
          if (newConfig.hideNonApplicable && newConfig.primaryTypes.length > 0) {
            setSelectedInstitutionTypes(newConfig.primaryTypes);
          } else if (!newConfig.hideNonApplicable) {
            // Clear selected types if hideNonApplicable is false
            setSelectedInstitutionTypes([]);
          }
          
          // If this is not the initial load and config changed, refetch regulations
          if (!isLoadingConfig && configChanged && refetch) {
            console.log('Institution configuration changed, refetching regulations...');
            refetch();
          }
        }
      } catch (error) {
        console.error('Failed to load institution configuration:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (user) {
      loadInstitutionConfig();
      
      // Set up polling to check for configuration changes every 5 seconds
      const interval = setInterval(loadInstitutionConfig, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user, institutionConfig, isLoadingConfig, refetch]);

  // Redirect to login if not authenticated
  if (authLoading || isLoadingConfig) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    // Redirect to login using wouter's navigate
    navigate("/auth");
    return null;
  }

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

    // Apply the new "applies to" filter using the helper function
    filtered = filterRegulationsByAppliesTo(filtered, selectedInstitutionTypes);

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
  }, [regulations, searchQuery, categoryFilter, jurisdictionSourceFilter, institutionTypeFilter, selectedInstitutionTypes, complianceFilter, sortBy, sortDirection]);

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
      {/* Add staging environment indicator */}
      {process.env.NODE_ENV === 'staging' && (
        <div className="bg-orange-500 text-white text-center py-2 px-4 text-sm font-medium">
          🧪 STAGING ENVIRONMENT - Test changes safely before production
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Regulatory Compliance Dashboard
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              Monitor and track regulatory compliance across all jurisdictions
            </p>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-sm px-3 py-1">
                <FileText className="h-4 w-4 mr-1" />
                Regulation Count: {filteredRegulations.length}
              </Badge>
              {institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0 && (
                <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 text-sm px-3 py-1">
                  <Building className="h-4 w-4 mr-1" />
                  Filtered for: {institutionConfig.primaryTypes.map(type => 
                    type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                  ).join(', ')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0 
                      ? 'Applicable Regulations' 
                      : 'Total Regulations'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{filteredRegulations.length}</p>
                  {institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      of {stats.total} total
                    </p>
                  )}
                </div>
                <div className="relative">
                  <FileText className="h-8 w-8 text-blue-600" />
                  {institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0 && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 bg-pink-500 rounded-full"></div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total in Database</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
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
                  // Only clear institution types if hideNonApplicable is false
                  if (!institutionConfig?.hideNonApplicable) {
                    setSelectedInstitutionTypes([]);
                  } else {
                    // Reset to primary types if hideNonApplicable is true
                    setSelectedInstitutionTypes(institutionConfig.primaryTypes || []);
                  }
                  setComplianceFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>

            {/* Advanced "Applies To" Filter */}
            <div className="mt-6 pt-6 border-t">
              <AppliesToFilter
                selectedInstitutionTypes={selectedInstitutionTypes}
                onInstitutionTypesChange={setSelectedInstitutionTypes}
                showTitle={true}
                compact={false}
              />
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
                            {(() => {
                              // If institution config is set to hide non-applicable, only show the primary types
                              if (institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0) {
                                const relevantTypes = regulation.applicableInstitutions?.filter((type: string) => 
                                  institutionConfig.primaryTypes.includes(type)
                                ) || [];
                                
                                if (relevantTypes.length > 0) {
                                  return relevantTypes.slice(0, 3).map((type: string) => (
                                    <Badge key={type} variant="outline" className="text-xs bg-pink-100 text-pink-800 border-pink-200">
                                      {type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                    </Badge>
                                  ));
                                }
                              }
                              
                              // Default behavior - show all applicable institutions
                              if (regulation.applicableInstitutions && Array.isArray(regulation.applicableInstitutions)) {
                                return regulation.applicableInstitutions.slice(0, 3).map((type: string) => (
                                  <Badge key={type} variant="outline" className="text-xs">
                                    {type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                  </Badge>
                                ));
                              }
                              
                              return (
                                <Badge variant="outline" className="text-xs">
                                  All Institutions
                                </Badge>
                              );
                            })()}
                            {(() => {
                              // Show "more" indicator logic
                              if (institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0) {
                                const relevantTypes = regulation.applicableInstitutions?.filter((type: string) => 
                                  institutionConfig.primaryTypes.includes(type)
                                ) || [];
                                if (relevantTypes.length > 3) {
                                  return (
                                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-300">
                                      +{relevantTypes.length - 3} more
                                    </Badge>
                                  );
                                }
                              } else if (regulation.applicableInstitutions && regulation.applicableInstitutions.length > 3) {
                                return (
                                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-300">
                                    +{regulation.applicableInstitutions.length - 3} more
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
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