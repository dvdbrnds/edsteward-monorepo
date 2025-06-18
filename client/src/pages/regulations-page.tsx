import Navigation from "@/components/layout/navigation";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, FileCheck, Filter, Search, FileText, Building, Calendar, ExternalLink, ArrowUpDown, Download, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Regulation, Deadline } from "@shared/schema";
import { useLocation } from "wouter";
import RegulationList from "@/components/regulations/regulation-list";
import CustomPieChart from "@/components/common/custom-pie-chart";
import RegulationWizard from "@/components/regulations/regulation-wizard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { EnhancedJurisdictionFilter } from "@/components/filters/enhanced-jurisdiction-filter";
import { format, parseISO } from "date-fns";

// Nine distinct colors from different parts of the color wheel
const CATEGORY_COLORS = {
  "Academic Programs": "#FF0000",    // Red
  "Financial Aid": "#0066FF",        // Blue
  "Student Services": "#FFD700",     // Yellow
  "Athletics": "#9400D3",           // Purple
  "Campus Safety": "#00CC00",       // Green
  "Research": "#90EE90",            // Lime
  "Other": "#808080",               // Gray (for misc categories)
  "Accounting": "#00CCCC",          // Cyan
  "Human Resources": "#FF6600",      // Orange
} as const;

const JURISDICTION_COLORS = {
  "federal": "#4169E1", // Royal Blue
  "state": "#228B22",   // Forest Green
} as const;

export default function RegulationsPage() {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [jurisdictionSourceFilter, setJurisdictionSourceFilter] = useState<string>("all");
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Check authentication
  const { user, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Fetch regulations from the authenticated API endpoint
  const { data: regulations = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/regulations"],
  });

  // Get unique categories for filtering
  const categories = useMemo(() => {
    if (!Array.isArray(regulations)) return [];
    return Array.from(new Set(regulations.map((reg: any) => reg.category).filter(Boolean))).sort();
  }, [regulations]);

  // Filter and sort regulations using enhanced jurisdiction filtering
  const filteredRegulations = useMemo(() => {
    if (!Array.isArray(regulations)) return [];

    let filtered = regulations.filter((reg: any) => {
      const matchesSearch = !searchQuery || 
        reg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.agency_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.itemId?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || reg.category === categoryFilter;
      
      // Enhanced jurisdiction filtering
      const regJurisdictionSource = reg.jurisdictionSource || reg.jurisdiction || "federal";
      const matchesJurisdictionSource = jurisdictionSourceFilter === "all" || regJurisdictionSource === jurisdictionSourceFilter;
      
      const matchesInstitutionType = institutionTypeFilter === "all" || 
        !reg.applicableInstitutions ||
        (Array.isArray(reg.applicableInstitutions) && reg.applicableInstitutions.includes(institutionTypeFilter)) ||
        (Array.isArray(reg.applicableInstitutions) && reg.applicableInstitutions.includes('all-institutions'));
      
      return matchesSearch && matchesCategory && matchesJurisdictionSource && matchesInstitutionType;
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
  }, [regulations, searchQuery, categoryFilter, jurisdictionSourceFilter, institutionTypeFilter, sortBy, sortDirection]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setJurisdictionSourceFilter("all");
    setInstitutionTypeFilter("all");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading regulations...</div>
      </div>
    );
  }

  const totalRegulations = Array.isArray(regulations) ? regulations.length : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Regulations
            </h1>

            <div className="space-x-4">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Regulation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Add New Regulation</DialogTitle>
                  </DialogHeader>
                  <RegulationWizard onSuccess={() => setOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Filter by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomPieChart
                  data={categories.map((category) => ({
                    name: category,
                    value: regulations.filter((reg: any) => reg.category === category).length,
                  }))}
                  colors={CATEGORY_COLORS}
                  title="Regulations by Category"
                  onSegmentClick={setCategoryFilter}
                  activeFilter={categoryFilter}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Filter by Jurisdiction</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomPieChart
                  data={jurisdictionSourceFilter === "all" ? jurisdictionSourceFilter : {
                    name: jurisdictionSourceFilter,
                    value: regulations.filter((reg: any) => reg.jurisdictionSource === jurisdictionSourceFilter).length,
                  }}
                  colors={JURISDICTION_COLORS}
                  title="Regulations by Jurisdiction"
                  onSegmentClick={setJurisdictionSourceFilter}
                  activeFilter={jurisdictionSourceFilter}
                />
              </CardContent>
            </Card>
          </div>

          <EnhancedJurisdictionFilter
            jurisdictionSourceFilter={jurisdictionSourceFilter}
            setJurisdictionSourceFilter={setJurisdictionSourceFilter}
            institutionTypeFilter={institutionTypeFilter}
            setInstitutionTypeFilter={setInstitutionTypeFilter}
            onClearFilters={() => {
              setJurisdictionSourceFilter("all");
              setInstitutionTypeFilter("all");
            }}
            showTitle={true}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Additional Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  onClick={clearAllFilters}
                  className="md:col-span-2"
                >
                  Clear All Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {filteredRegulations.length} of {totalRegulations} regulations
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                      <TableHead>
                        Jurisdiction Source
                      </TableHead>
                      <TableHead>
                        Applies To
                      </TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('lastVerified')}
                      >
                        <div className="flex items-center gap-2">
                          Last Verified
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegulations.map((regulation: any) => (
                      <TableRow 
                        key={regulation.id}
                        className="hover:bg-gray-50"
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
                            {regulation.category || 'Uncategorized'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={regulation.jurisdictionSource === 'federal' || regulation.jurisdiction === 'federal' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {regulation.jurisdictionSource || regulation.jurisdiction || 'Federal'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {regulation.applicableInstitutions && Array.isArray(regulation.applicableInstitutions) ? (
                              regulation.applicableInstitutions.slice(0, 2).map((type: string) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {type.replace('-', ' ')}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                All Institutions
                              </Badge>
                            )}
                            {regulation.applicableInstitutions && regulation.applicableInstitutions.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{regulation.applicableInstitutions.length - 2} more
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
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/regulations/${regulation.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {regulation.agency_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(regulation.agency_url, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {filteredRegulations.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No regulations found matching your filters.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={clearAllFilters}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}