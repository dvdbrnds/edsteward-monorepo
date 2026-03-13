import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

// Constants for the enhanced jurisdiction system
export const JURISDICTION_SOURCES = [
  { value: "federal", label: "Federal Government" },
  { value: "state", label: "State Government" },
  { value: "international", label: "International" },
  { value: "private-organization", label: "Private Organization" },
  { value: "accreditor", label: "Accrediting Body" },
  { value: "industry-association", label: "Industry Association" }
];

export const INSTITUTION_TYPES_FILTER = [
  { value: "public-4year", label: "Public University (4-year)" },
  { value: "private-nonprofit-4year", label: "Private Nonprofit University (4-year)" },
  { value: "public-2year", label: "Public Community College (2-year)" },
  { value: "private-nonprofit-2year", label: "Private Nonprofit College (2-year)" },
  { value: "private-for-profit", label: "For-Profit Institution" },
  { value: "religious-affiliation", label: "Religious Affiliation" },
  { value: "research-intensive", label: "Research Intensive" },
  { value: "graduate-professional", label: "Graduate / Professional" },
  { value: "intercollegiate-athletics", label: "Intercollegiate Athletics" },
  { value: "online-distance-ed", label: "Online / Distance Ed" },
  { value: "medical-health-programs", label: "Medical / Health Programs" },
  { value: "residential-campus", label: "Residential Campus" },
  { value: "title-iv-participant", label: "Title IV Participant" },
];

// Keep backward-compatible export name
export const INSTITUTION_TYPES = INSTITUTION_TYPES_FILTER;

interface EnhancedJurisdictionFilterProps {
  jurisdictionSourceFilter: string;
  setJurisdictionSourceFilter: (value: string) => void;
  institutionTypeFilter: string;
  setInstitutionTypeFilter: (value: string) => void;
  onClearFilters?: () => void;
  showTitle?: boolean;
}

export function EnhancedJurisdictionFilter({
  jurisdictionSourceFilter,
  setJurisdictionSourceFilter,
  institutionTypeFilter,
  setInstitutionTypeFilter,
  onClearFilters,
  showTitle = true
}: EnhancedJurisdictionFilterProps) {
  const hasActiveFilters = jurisdictionSourceFilter !== "all" || institutionTypeFilter !== "all";

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Enhanced Jurisdiction Filtering
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Jurisdiction Source Filter - WHERE the regulation comes from */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Regulation Source
            </label>
            <Select value={jurisdictionSourceFilter} onValueChange={setJurisdictionSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Where regulation comes from" />
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
            <p className="text-xs text-muted-foreground mt-1">
              Filter by the source/origin of the regulation
            </p>
          </div>

          {/* Institution Type Filter - WHO the regulation applies to */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Applies To
            </label>
            <Select value={institutionTypeFilter} onValueChange={setInstitutionTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Who regulation applies to" />
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
            <p className="text-xs text-muted-foreground mt-1">
              Filter by the type of institutions this regulation affects
            </p>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={onClearFilters}
              disabled={!hasActiveFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Active Filters:</p>
            <div className="flex flex-wrap gap-2">
              {jurisdictionSourceFilter !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Source: {JURISDICTION_SOURCES.find(s => s.value === jurisdictionSourceFilter)?.label}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setJurisdictionSourceFilter("all")} 
                  />
                </Badge>
              )}
              {institutionTypeFilter !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Applies to: {INSTITUTION_TYPES.find(t => t.value === institutionTypeFilter)?.label}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setInstitutionTypeFilter("all")} 
                  />
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Understanding the Enhanced System:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li><strong>Regulation Source:</strong> Where the regulation originates (federal law, state law, accreditor, etc.)</li>
            <li><strong>Applies To:</strong> Which types of institutions must comply (public universities, conservatories, etc.)</li>
            <li><strong>Example:</strong> A federal regulation from the Department of Education might only apply to public institutions</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to filter regulations based on enhanced jurisdiction
export function filterRegulationsByEnhancedJurisdiction(
  regulations: any[],
  jurisdictionSourceFilter: string,
  institutionTypeFilter: string
) {
  return regulations.filter((reg) => {
    // Check jurisdiction source (with backward compatibility)
    const regJurisdictionSource = reg.jurisdictionSource || reg.jurisdiction || "federal";
    const matchesJurisdictionSource = jurisdictionSourceFilter === "all" || regJurisdictionSource === jurisdictionSourceFilter;
    
    // Check institution type
    const matchesInstitutionType = institutionTypeFilter === "all" || 
      !reg.applicableInstitutions ||
      reg.applicableInstitutions.includes(institutionTypeFilter) ||
      reg.applicableInstitutions.includes('all-institutions');
    
    return matchesJurisdictionSource && matchesInstitutionType;
  });
}

export default EnhancedJurisdictionFilter; 