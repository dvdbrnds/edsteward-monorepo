import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PublicNavigation from "@/components/layout/public-navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  X,
  ChevronRight,
  Info,
  AlertOctagon,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { differenceInDays } from "date-fns";
import { type Regulation } from "@shared/schema";

// Utility function to calculate compliance status based on various factors
function calculateComplianceStatus(regulation: any): {
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

  // Otherwise compliant
  return {
    status: "compliant",
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    label: "Compliant",
    className: "text-green-600 bg-green-50",
  };
}

export default function PublicDashboardPage() {
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("");
  const [complianceFilter, setComplianceFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch regulations from the public API endpoint
  const { data: regulations, isLoading } = useQuery({
    queryKey: ["/api/public/regulations"],
  });

  // Get unique categories for filtering
  const categories = useMemo(() => {
    if (!regulations) return [];
    return Array.from(new Set(regulations.map((reg: any) => reg.category))).sort();
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
    if (!regulations) return [];

    return regulations
      .filter((regulation: any) => {
        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            regulation.name?.toLowerCase().includes(query) ||
            regulation.topic?.toLowerCase().includes(query) ||
            regulation.statute?.toLowerCase().includes(query) ||
            regulation.itemId?.toLowerCase().includes(query);

          if (!matchesSearch) return false;
        }

        // Apply category filter
        if (categoryFilter && regulation.category !== categoryFilter) {
          return false;
        }

        // Apply jurisdiction filter
        if (
          jurisdictionFilter &&
          regulation.jurisdiction !== jurisdictionFilter
        ) {
          return false;
        }

        // Apply compliance status filter
        if (complianceFilter) {
          const status = calculateComplianceStatus(regulation).status;
          if (
            (complianceFilter === "compliant" && status !== "compliant") ||
            (complianceFilter === "needs-attention" &&
              status !== "needs-attention") ||
            (complianceFilter === "at-risk" && status !== "at-risk")
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a: any, b: any) => {
        let valueA: any;
        let valueB: any;

        if (sortBy === "status") {
          // For status, compare the status score
          const statusA = calculateComplianceStatus(a).status;
          const statusB = calculateComplianceStatus(b).status;
          
          // Convert status to a numeric value for sorting
          const getStatusValue = (status: string) => {
            switch (status) {
              case "compliant": return 3;
              case "needs-attention": return 2;
              case "at-risk": return 1;
              default: return 0;
            }
          };
          
          valueA = getStatusValue(statusA);
          valueB = getStatusValue(statusB);
        } else {
          // For normal fields, just compare the values
          valueA = a[sortBy];
          valueB = b[sortBy];
          
          // Handle null/undefined values
          if (valueA === null || valueA === undefined) valueA = "";
          if (valueB === null || valueB === undefined) valueB = "";
          
          // Convert to lowercase for string comparison
          if (typeof valueA === "string") valueA = valueA.toLowerCase();
          if (typeof valueB === "string") valueB = valueB.toLowerCase();
        }
        
        // Apply sort direction
        const compareResult = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        return sortDirection === "asc" ? compareResult : -compareResult;
      });
  }, [
    regulations,
    searchQuery,
    categoryFilter,
    jurisdictionFilter,
    complianceFilter,
    sortBy,
    sortDirection,
  ]);

  // Handle column sort
  const handleSort = (column: string) => {
    // If clicking on the same column, toggle direction
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // If clicking on a new column, set it as the sort column with ascending direction
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicNavigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center py-20">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-72 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 w-48 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Compliance Dashboard
            </h1>
            <p className="mt-2 text-lg text-gray-500">
              Monitor all regulatory compliance statuses in one view
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Total Regulations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total}</div>
                <p className="text-sm text-gray-500">Active regulations tracked</p>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  Compliant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats.compliant}
                </div>
                <p className="text-sm text-gray-500">
                  {((stats.compliant / stats.total) * 100).toFixed(0)}% of total
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.needsAttention}
                </div>
                <p className="text-sm text-gray-500">
                  {((stats.needsAttention / stats.total) * 100).toFixed(0)}% of total
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  At Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {stats.atRisk}
                </div>
                <p className="text-sm text-gray-500">
                  {((stats.atRisk / stats.total) * 100).toFixed(0)}% of total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-8 bg-white">
            <CardHeader>
              <CardTitle>Filter Regulations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search regulations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-2 top-2.5"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={jurisdictionFilter}
                  onValueChange={setJurisdictionFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Jurisdictions</SelectItem>
                    <SelectItem value="federal">Federal</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={complianceFilter}
                  onValueChange={setComplianceFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Compliance Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="needs-attention">Needs Attention</SelectItem>
                    <SelectItem value="at-risk">At Risk</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("");
                    setJurisdictionFilter("");
                    setComplianceFilter("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Regulations Table */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>
                Regulations
                <Badge variant="outline" className="ml-2">
                  {filteredRegulations.length} results
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center">
                          Regulation Name
                          {sortBy === "name" && (
                            <ArrowUpDown
                              className={`ml-1 h-4 w-4 ${
                                sortDirection === "asc"
                                  ? "transform rotate-0"
                                  : "transform rotate-180"
                              }`}
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("category")}
                      >
                        <div className="flex items-center">
                          Category
                          {sortBy === "category" && (
                            <ArrowUpDown
                              className={`ml-1 h-4 w-4 ${
                                sortDirection === "asc"
                                  ? "transform rotate-0"
                                  : "transform rotate-180"
                              }`}
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("jurisdiction")}
                      >
                        <div className="flex items-center">
                          Jurisdiction
                          {sortBy === "jurisdiction" && (
                            <ArrowUpDown
                              className={`ml-1 h-4 w-4 ${
                                sortDirection === "asc"
                                  ? "transform rotate-0"
                                  : "transform rotate-180"
                              }`}
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort("lastUpdated")}
                      >
                        <div className="flex items-center">
                          Last Updated
                          {sortBy === "lastUpdated" && (
                            <ArrowUpDown
                              className={`ml-1 h-4 w-4 ${
                                sortDirection === "asc"
                                  ? "transform rotate-0"
                                  : "transform rotate-180"
                              }`}
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-center"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center justify-center">
                          Status
                          {sortBy === "status" && (
                            <ArrowUpDown
                              className={`ml-1 h-4 w-4 ${
                                sortDirection === "asc"
                                  ? "transform rotate-0"
                                  : "transform rotate-180"
                              }`}
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegulations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-gray-500"
                        >
                          <AlertOctagon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p>No regulations found matching your filters.</p>
                          <Button
                            variant="link"
                            className="mt-2"
                            onClick={() => {
                              setSearchQuery("");
                              setCategoryFilter("");
                              setJurisdictionFilter("");
                              setComplianceFilter("");
                            }}
                          >
                            Clear all filters
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegulations.map((regulation: any) => {
                        const complianceStatus = calculateComplianceStatus(regulation);
                        return (
                          <TableRow
                            key={regulation.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() =>
                              navigate(`/public-dashboard/regulation/${regulation.id}`)
                            }
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {regulation.name || regulation.topic}
                                {regulation.isApplicable === false && (
                                  <Badge variant="outline" className="ml-2 text-gray-500">
                                    Not Applicable
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                ID: {regulation.itemId}
                              </div>
                            </TableCell>
                            <TableCell>{regulation.category}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`capitalize ${
                                  regulation.jurisdiction === "federal"
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : "bg-purple-50 text-purple-600 border-purple-200"
                                }`}
                              >
                                {regulation.jurisdiction}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {regulation.lastUpdated
                                ? new Date(regulation.lastUpdated).toLocaleDateString()
                                : "Not recorded"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={complianceStatus.className + " flex items-center justify-center space-x-1"}
                              >
                                {complianceStatus.icon}
                                <span>{complianceStatus.label}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/public-dashboard/regulation/${regulation.id}`);
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
          {/* Disclaimer */}
          <div className="mt-8 border border-gray-200 rounded-md p-4 bg-gray-50">
            <div className="flex items-start space-x-3">
              <Shield className="h-6 w-6 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">Board of Trustees View-Only Dashboard</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This dashboard provides an overview of our regulatory compliance status. 
                  For detailed information about a specific regulation, click on its row in the table.
                  Contact the compliance office for any questions or concerns.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}