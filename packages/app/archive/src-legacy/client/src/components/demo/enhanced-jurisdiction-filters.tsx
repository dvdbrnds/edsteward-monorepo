import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

// Constants for jurisdiction sources and institution types
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

interface EnhancedJurisdictionFiltersProps {
  onFiltersChange: (_filters: {
    jurisdictionSource: string;
    institutionType: string;
  }) => void;
}

export default function EnhancedJurisdictionFilters({ onFiltersChange }: EnhancedJurisdictionFiltersProps) {
  const [jurisdictionSource, setJurisdictionSource] = useState<string>("all");
  const [institutionType, setInstitutionType] = useState<string>("all");

  const handleJurisdictionSourceChange = (value: string) => {
    setJurisdictionSource(value);
    onFiltersChange({ jurisdictionSource: value, institutionType });
  };

  const handleInstitutionTypeChange = (value: string) => {
    setInstitutionType(value);
    onFiltersChange({ jurisdictionSource, institutionType: value });
  };

  const clearFilters = () => {
    setJurisdictionSource("all");
    setInstitutionType("all");
    onFiltersChange({ jurisdictionSource: "all", institutionType: "all" });
  };

  const hasActiveFilters = jurisdictionSource !== "all" || institutionType !== "all";

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Enhanced Jurisdiction Filtering
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Jurisdiction Source Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Regulation Source</label>
            <Select value={jurisdictionSource} onValueChange={handleJurisdictionSourceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
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
          </div>

          {/* Institution Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Applies To</label>
            <Select value={institutionType} onValueChange={handleInstitutionTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select institution type" />
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
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={clearFilters}
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
              {jurisdictionSource !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Source: {JURISDICTION_SOURCES.find(s => s.value === jurisdictionSource)?.label}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleJurisdictionSourceChange("all")}
                  />
                </Badge>
              )}
              {institutionType !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Applies to: {INSTITUTION_TYPES.find(t => t.value === institutionType)?.label}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleInstitutionTypeChange("all")}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Example Search Scenarios */}
        <div className="mt-6 p-4 bg-background rounded-lg">
          <h4 className="font-medium mb-2">Example Searches:</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>• Federal regulations applying to community colleges</p>
            <p>• Accrediting body requirements for private universities</p>
            <p>• International standards applicable to all institutions</p>
            <p>• State regulations for public universities only</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example usage in a parent component:
export function DemoUsage() {
  const handleFiltersChange = (newFilters: {
    jurisdictionSource: string;
    institutionType: string;
  }) => {
    
    // This would trigger a re-fetch of regulations with the new filters
  };

  return (
    <div className="space-y-6">
      <EnhancedJurisdictionFilters onFiltersChange={handleFiltersChange} />
      
      {/* Sample regulation cards showing the enhanced display */}
      <div className="grid gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold">Title IX Sexual Harassment Procedures</h3>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Federal Government</Badge>
                <span className="text-sm text-muted-foreground">Source</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Public Universities</Badge>
                <Badge variant="secondary">Private Universities</Badge>
                <Badge variant="secondary">Community Colleges</Badge>
                <span className="text-sm text-muted-foreground">Applies to</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold">SACSCOC Principles of Accreditation</h3>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Accrediting Body</Badge>
                <span className="text-sm text-muted-foreground">Source</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">All Institution Types</Badge>
                <span className="text-sm text-muted-foreground">Applies to</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 