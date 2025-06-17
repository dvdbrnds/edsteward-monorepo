import React, { useState, useMemo } from 'react';
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Info, Lightbulb } from "lucide-react";
import { useLocation } from "wouter";
import EnhancedJurisdictionFilter, { 
  JURISDICTION_SOURCES, 
  INSTITUTION_TYPES, 
  filterRegulationsByEnhancedJurisdiction 
} from "@/components/filters/enhanced-jurisdiction-filter";

// Sample data to demonstrate the enhanced jurisdiction system
const sampleRegulations = [
  {
    id: 1,
    name: "Title IX - Education Amendments",
    category: "Student Rights",
    jurisdictionSource: "federal",
    applicableInstitutions: ["public-universities", "private-universities"],
    agency_name: "Department of Education",
    description: "Federal law that applies to both public and private universities"
  },
  {
    id: 2,
    name: "Pennsylvania State University Funding Requirements",
    category: "Finance",
    jurisdictionSource: "state",
    applicableInstitutions: ["public-universities"],
    agency_name: "Pennsylvania Department of Education",
    description: "State regulation that only applies to public institutions"
  },
  {
    id: 3,
    name: "Middle States Commission Standards",
    category: "Academic Quality",
    jurisdictionSource: "accreditor",
    applicableInstitutions: ["public-universities", "private-universities", "community-colleges"],
    agency_name: "Middle States Commission on Higher Education",
    description: "Accreditor requirements for institutions in the Middle States region"
  },
  {
    id: 4,
    name: "Conservatory Performance Standards",
    category: "Academic Quality",
    jurisdictionSource: "accreditor",
    applicableInstitutions: ["conservatories"],
    agency_name: "National Association of Schools of Music",
    description: "Specialized standards specifically for music conservatories"
  },
  {
    id: 5,
    name: "FERPA - Family Educational Rights and Privacy Act",
    category: "Student Privacy",
    jurisdictionSource: "federal",
    applicableInstitutions: ["all-institutions"],
    agency_name: "Department of Education",
    description: "Federal privacy law that applies to all educational institutions"
  },
  {
    id: 6,
    name: "International Student Exchange Standards",
    category: "International Programs",
    jurisdictionSource: "international",
    applicableInstitutions: ["public-universities", "private-universities"],
    agency_name: "Department of State",
    description: "International agreements affecting universities with exchange programs"
  },
  {
    id: 7,
    name: "Association of American Universities Research Guidelines",
    category: "Research",
    jurisdictionSource: "private-organization",
    applicableInstitutions: ["research-institutes"],
    agency_name: "Association of American Universities",
    description: "Private organization standards for research institutions"
  }
];

export default function EnhancedJurisdictionDemo() {
  const [_, navigate] = useLocation();
  const [jurisdictionSourceFilter, setJurisdictionSourceFilter] = useState<string>("all");
  const [institutionTypeFilter, setInstitutionTypeFilter] = useState<string>("all");

  // Filter regulations using the enhanced system
  const filteredRegulations = useMemo(() => {
    return filterRegulationsByEnhancedJurisdiction(
      sampleRegulations,
      jurisdictionSourceFilter,
      institutionTypeFilter
    );
  }, [jurisdictionSourceFilter, institutionTypeFilter]);

  const clearFilters = () => {
    setJurisdictionSourceFilter("all");
    setInstitutionTypeFilter("all");
  };

  const quickFilterExamples = [
    {
      name: "Federal Laws for All Institutions",
      jurisdictionSource: "federal",
      institutionType: "all-institutions",
      description: "Show federal regulations that apply universally"
    },
    {
      name: "State Laws for Public Universities",
      jurisdictionSource: "state",
      institutionType: "public-universities",
      description: "Show state regulations specifically for public institutions"
    },
    {
      name: "Accreditor Standards for Conservatories",
      jurisdictionSource: "accreditor",
      institutionType: "conservatories",
      description: "Show specialized requirements for music schools"
    },
    {
      name: "Private Organization Standards",
      jurisdictionSource: "private-organization",
      institutionType: "all",
      description: "Show all private organization requirements"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Button 
              variant="outline" 
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <h1 className="text-3xl font-bold text-gray-900">Enhanced Jurisdiction System Demo</h1>
            <p className="mt-2 text-lg text-gray-600">
              Experience the new dual-dimension filtering: Source + Institution Type
            </p>
          </div>

          {/* Explanation Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  Old System vs New System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-red-600">❌ Old System:</h4>
                    <p className="text-sm text-gray-600">Single "Jurisdiction" field: Federal OR State</p>
                    <p className="text-xs text-gray-500">Limited and confusing</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-green-600">✅ New System:</h4>
                    <p className="text-sm text-gray-600">
                      <strong>Source:</strong> WHERE it comes from (Federal, State, International, Accreditor, etc.)
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Applies To:</strong> WHO must comply (Public Universities, Conservatories, etc.)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  Real World Examples
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="p-2 bg-blue-50 rounded">
                    <strong>Federal law → Public universities only</strong>
                    <p className="text-xs text-gray-600">Some federal regulations only apply to public institutions</p>
                  </div>
                  <div className="p-2 bg-green-50 rounded">
                    <strong>Accreditor → Conservatories only</strong>
                    <p className="text-xs text-gray-600">Music accreditors have specialized requirements</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded">
                    <strong>International → Research institutions</strong>
                    <p className="text-xs text-gray-600">International agreements affecting research collaborations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Filter Examples */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Try These Example Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickFilterExamples.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-4 text-left flex flex-col items-start"
                    onClick={() => {
                      setJurisdictionSourceFilter(example.jurisdictionSource);
                      setInstitutionTypeFilter(example.institutionType);
                    }}
                  >
                    <span className="font-medium text-sm">{example.name}</span>
                    <span className="text-xs text-gray-500 mt-1">{example.description}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Filter Component */}
          <div className="mb-8">
            <EnhancedJurisdictionFilter
              jurisdictionSourceFilter={jurisdictionSourceFilter}
              setJurisdictionSourceFilter={setJurisdictionSourceFilter}
              institutionTypeFilter={institutionTypeFilter}
              setInstitutionTypeFilter={setInstitutionTypeFilter}
              onClearFilters={clearFilters}
            />
          </div>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>
                Filtered Results ({filteredRegulations.length} of {sampleRegulations.length} regulations)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Regulation Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegulations.map((regulation) => (
                      <TableRow key={regulation.id}>
                        <TableCell className="font-medium">
                          {regulation.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{regulation.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {JURISDICTION_SOURCES.find(s => s.value === regulation.jurisdictionSource)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {regulation.applicableInstitutions.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {INSTITUTION_TYPES.find(t => t.value === type)?.label || type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {regulation.agency_name}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs">
                          {regulation.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {filteredRegulations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No regulations match the current filters.</p>
                  <Button 
                    variant="outline" 
                    onClick={clearFilters}
                    className="mt-4"
                  >
                    Clear all filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Implementation Notes */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Implementation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-sm">✅ Database migration completed (367 regulations updated)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-sm">✅ Enhanced filter component created</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-sm">✅ Backend API updated to support new filtering</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span className="text-sm">🔄 Integration with existing dashboard in progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span className="text-sm">🔄 Regulation creation forms need updating</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 