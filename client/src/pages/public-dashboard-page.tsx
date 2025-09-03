import React, { useState, useEffect, useMemo, useRef } from "react";
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
  const [sortBy, setSortBy] = useState<string>("lastUpdated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Institution configuration state
  const [institutionConfig, setInstitutionConfig] = useState<InstitutionConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Use refs to track current values for useEffect
  const institutionConfigRef = useRef<InstitutionConfig | null>(null);
  const isLoadingConfigRef = useRef(true);
  const refetchRef = useRef<any>(null);

  // Update refs when state changes
  useEffect(() => {
    institutionConfigRef.current = institutionConfig;
  }, [institutionConfig]);

  useEffect(() => {
    isLoadingConfigRef.current = isLoadingConfig;
  }, [isLoadingConfig]);

  // Check authentication
  const { user, isLoading: authLoading } = useAuth();

  // Fetch regulations from the authenticated API endpoint with institution filtering
  const isQueryEnabled = !isLoadingConfig && institutionConfig !== null;
  console.log('[REACT-QUERY-ENABLED] Query enabled status:', isQueryEnabled, { isLoadingConfig, hasConfig: !!institutionConfig });
  
  const { data: regulations = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/regulations", institutionConfig?.primaryTypes, institutionConfig?.hideNonApplicable],
    queryFn: async () => {
      console.log('[REACT-QUERY] Starting regulations fetch...');
      console.log('[REACT-QUERY] Institution config:', institutionConfig);
      console.log('[REACT-QUERY] hideNonApplicable:', institutionConfig?.hideNonApplicable);
      console.log('[REACT-QUERY] primaryTypes:', institutionConfig?.primaryTypes);
      
      let url = "/api/regulations";
      
      // If institution configuration is set to hide non-applicable and we have primary types
      if (institutionConfig?.hideNonApplicable && institutionConfig.primaryTypes.length > 0) {
        // Use the first primary type for backend filtering (most specific)
        const primaryType = institutionConfig.primaryTypes[0];
        url += `?institutionType=${primaryType}`;
        console.log('[REACT-QUERY] Adding institutionType parameter:', primaryType);
      } else {
        console.log('[REACT-QUERY] NOT adding institutionType parameter');
        console.log('[REACT-QUERY] Reasons:');
        console.log('[REACT-QUERY] - hideNonApplicable:', institutionConfig?.hideNonApplicable);
        console.log('[REACT-QUERY] - primaryTypes length:', institutionConfig?.primaryTypes?.length || 0);
        console.log('[REACT-QUERY] - institutionConfig exists:', !!institutionConfig);
      }
      
      console.log('[REACT-QUERY] Final URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch regulations");
      }
      const data = await response.json();
      console.log('[REACT-QUERY] Received regulations count:', data.length);
      return data;
    },
    enabled: isQueryEnabled, // Wait for both loading to finish AND config to be set
  });

  // Update refetch ref when available
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  console.log('[DASHBOARD-DEBUG] Current state:');
  console.log('[DASHBOARD-DEBUG] - isLoadingConfig:', isLoadingConfig);
  console.log('[DASHBOARD-DEBUG] - institutionConfig:', institutionConfig);
  console.log('[DASHBOARD-DEBUG] - query enabled:', !isLoadingConfig && institutionConfig !== null);
  console.log('[DASHBOARD-DEBUG] - regulations count:', regulations?.length || 0);
  console.log('[DASHBOARD-DEBUG] - shouldFilter:', institutionConfig?.hideNonApplicable && institutionConfig?.primaryTypes?.length > 0);

  // Load institution configuration on mount and periodically check for updates
  useEffect(() => {
    const loadInstitutionConfig = async () => {
      console.log('[DASHBOARD] Loading institution configuration...');
      try {
        // First, get tenant information from auth status
        console.log('[DASHBOARD] Fetching tenant info from /api/auth/status');
        const authResponse = await fetch('/api/auth/status');
        let tenantId = 'admin'; // default fallback
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          console.log('[DASHBOARD] Auth response:', authData);
          
          // Use tenantId from auth response if available
          if (authData.tenantId) {
            tenantId = authData.tenantId;
            console.log('[DASHBOARD] Using tenant from auth response:', tenantId);
          }
        }
        
        // Load institution config with tenant context
        console.log('[DASHBOARD] Fetching institution config for tenant:', tenantId);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Add tenant header for proper tenant context
        if (tenantId && tenantId !== 'admin') {
          headers['x-tenant-id'] = tenantId;
        }
        
        const response = await fetch('/api/admin/institution-config', { headers });
        if (response.ok) {
          const data = await response.json();
          const newConfig = data.institutionConfig;
          console.log('[DASHBOARD] Loaded institution config:', newConfig);
          
          // Check if configuration actually changed by comparing with ref
          const configChanged = JSON.stringify(institutionConfigRef.current) !== JSON.stringify(newConfig);
          
          setInstitutionConfig(newConfig);
          
          // If hideNonApplicable is true, automatically set the primary types as selected
          if (newConfig.hideNonApplicable && newConfig.primaryTypes.length > 0) {
            console.log('[DASHBOARD] Setting selected institution types:', newConfig.primaryTypes);
            setSelectedInstitutionTypes(newConfig.primaryTypes);
          } else if (!newConfig.hideNonApplicable) {
            // Clear selected types if hideNonApplicable is false
            console.log('[DASHBOARD] Clearing selected institution types');
            setSelectedInstitutionTypes([]);
          }
          
          // If this is not the initial load and config changed, refetch regulations
          if (!isLoadingConfigRef.current && configChanged && refetchRef.current) {
            console.log('[DASHBOARD] Institution configuration changed, refetching regulations...');
            refetchRef.current();
          }
        }
      } catch (error) {
        console.error('[DASHBOARD] Failed to load institution configuration:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    // Load config immediately and set up polling
    loadInstitutionConfig();
    
    // Set up polling to check for configuration changes every 5 seconds
    const interval = setInterval(loadInstitutionConfig, 5000);
    
    return () => clearInterval(interval);
  }, []); // FIXED: Remove institutionConfig from dependencies to prevent infinite loop

  // Redirect to login if not authenticated
  if (authLoading || isLoadingConfig) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // For SaaS product: Users must ALWAYS be authenticated - redirect to login if not
  if (!user) {
    console.log('[DASHBOARD] User not authenticated, redirecting to login');
    navigate("/auth");
    return <div className="flex items-center justify-center min-h-screen">Redirecting to login...</div>;
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
              {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current?.primaryTypes && institutionConfigRef.current.primaryTypes.length > 0 && (
                <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 text-sm px-3 py-1">
                  <Building className="h-4 w-4 mr-1" />
                  Filtered for: {institutionConfigRef.current.primaryTypes.map(type => 
                    type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                  ).join(', ')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Regulations Counter */}
        <Card className="mb-8 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {filteredRegulations.length}
                    <span className="text-base font-normal text-gray-500 ml-2">
                      {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 
                        ? 'Applicable Regulations' 
                        : 'Regulations'}
                    </span>
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 
                        ? `Filtered from ${stats.total} total regulations`
                        : 'Total in system'}
                    </span>
                    {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 && (
                      <span className="flex items-center">
                        <div className="w-2 h-2 bg-pink-500 rounded-full mr-2"></div>
                        Institution-specific view
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Coverage</div>
                    <div className="text-lg font-semibold text-gray-700">
                      {Math.round((filteredRegulations.length / stats.total) * 100)}%
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center">
                  <Badge 
                    variant={institutionConfigRef.current?.hideNonApplicable ? "default" : "secondary"}
                    className={`px-3 py-1 text-xs font-medium ${
                      institutionConfigRef.current?.hideNonApplicable 
                        ? 'bg-pink-100 text-pink-800 border-pink-200' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {institutionConfigRef.current?.hideNonApplicable ? 'Filtered View' : 'All Regulations'}
                  </Badge>
                  {institutionConfigRef.current?.allowUsersToToggle && (
                    <div className="text-xs text-gray-400 mt-1">Toggle available</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 
                      ? 'Applicable Regulations' 
                      : 'Total Regulations'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{filteredRegulations.length}</p>
                  {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      of {stats.total} total
                    </p>
                  )}
                </div>
                <div className="relative">
                  <FileText className="h-8 w-8 text-blue-600" />
                  {institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current.primaryTypes.length > 0 && (
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
                  if (!institutionConfigRef.current?.hideNonApplicable) {
                    setSelectedInstitutionTypes([]);
                  } else {
                    // Reset to primary types if hideNonApplicable is true
                    setSelectedInstitutionTypes(institutionConfigRef.current.primaryTypes || []);
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
                      onClick={() => handleSort('lastUpdated')}
                    >
                      <div className="flex items-center gap-2">
                        Last Updated
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
                              if (institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current?.primaryTypes && institutionConfigRef.current.primaryTypes.length > 0) {
                                const relevantTypes = regulation.applicableInstitutions?.filter((type: string) => 
                                  institutionConfigRef.current?.primaryTypes?.includes(type)
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
                              if (institutionConfigRef.current?.hideNonApplicable && institutionConfigRef.current?.primaryTypes && institutionConfigRef.current.primaryTypes.length > 0) {
                                const relevantTypes = regulation.applicableInstitutions?.filter((type: string) => 
                                  institutionConfigRef.current?.primaryTypes?.includes(type)
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
                          {regulation.lastUpdated ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium text-blue-700">
                                {format(parseISO(regulation.lastUpdated), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Never updated</span>
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