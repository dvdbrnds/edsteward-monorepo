import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Filter, X, Search, Building2, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { INSTITUTION_TYPES } from "@shared/schema";
import { cn } from "@/lib/utils";

interface AppliesToFilterProps {
  selectedInstitutionTypes: string[];
  onInstitutionTypesChange: (types: string[]) => void;
  onClearFilters?: () => void;
  showTitle?: boolean;
  compact?: boolean;
}

interface InstitutionConfig {
  primaryTypes: string[];
  hideNonApplicable: boolean;
  allowUsersToToggle: boolean;
}

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  "public-universities": "Public Universities",
  "private-universities": "Private Universities", 
  "community-colleges": "Community Colleges",
  "conservatories": "Conservatories",
  "technical-institutes": "Technical Institutes",
  "religious-institutions": "Religious Institutions",
  "for-profit-institutions": "For-Profit Institutions",
  "research-institutes": "Research Institutes",
  "professional-schools": "Professional Schools",
  "all-institutions": "All Institution Types"
};

export function AppliesToFilter({ 
  selectedInstitutionTypes, 
  onInstitutionTypesChange, 
  onClearFilters,
  showTitle = true,
  compact = false 
}: AppliesToFilterProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [searchTerm, setSearchTerm] = useState("");
  const [institutionConfig, setInstitutionConfig] = useState<InstitutionConfig | null>(null);
  const [showOnlyApplicable, setShowOnlyApplicable] = useState(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Load institution configuration on mount
  useEffect(() => {
    const loadInstitutionConfig = async () => {
      try {
        const response = await fetch('/api/admin/institution-config');
        if (response.ok) {
          const data = await response.json();
          setInstitutionConfig(data.institutionConfig);
          setShowOnlyApplicable(data.institutionConfig.hideNonApplicable);
        }
      } catch (error) {
        console.error('Failed to load institution configuration:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadInstitutionConfig();
  }, []);

  // Apply institution-based filtering when showOnlyApplicable changes
  useEffect(() => {
    if (institutionConfig && showOnlyApplicable && institutionConfig.primaryTypes.length > 0) {
      // Auto-select the institution's primary types
      onInstitutionTypesChange(institutionConfig.primaryTypes);
    } else if (!showOnlyApplicable) {
      // Clear filters when showing all regulations
      onInstitutionTypesChange([]);
    }
  }, [showOnlyApplicable, institutionConfig, onInstitutionTypesChange]);

  const filteredTypes = useMemo(() => {
    if (!searchTerm) return INSTITUTION_TYPES;
    return INSTITUTION_TYPES.filter(type =>
      INSTITUTION_TYPE_LABELS[type]?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      onInstitutionTypesChange([...selectedInstitutionTypes, type]);
    } else {
      onInstitutionTypesChange(selectedInstitutionTypes.filter(t => t !== type));
    }
  };

  const handleSelectAll = () => {
    onInstitutionTypesChange([...filteredTypes]);
  };

  const handleDeselectAll = () => {
    onInstitutionTypesChange([]);
  };

  const getSelectedCount = () => selectedInstitutionTypes.length;
  const getTotalCount = () => INSTITUTION_TYPES.length;
  const getHiddenCount = () => {
    if (!institutionConfig || !showOnlyApplicable || institutionConfig.primaryTypes.length === 0) {
      return 0;
    }
    // This would need to be calculated based on actual regulation data
    // For now, return a placeholder
    return 0;
  };

  const getSummaryText = () => {
    const selectedCount = getSelectedCount();
    const totalCount = getTotalCount();
    
    if (institutionConfig && showOnlyApplicable && institutionConfig.primaryTypes.length > 0) {
      const hiddenCount = getHiddenCount();
      return `Showing regulations for ${institutionConfig.primaryTypes.length} institution type(s)${hiddenCount > 0 ? ` (${hiddenCount} regulations hidden)` : ''}`;
    }
    
    if (selectedCount === 0) {
      return "Select institution types to filter";
    }
    
    if (selectedCount === totalCount) {
      return "All institution types selected";
    }
    
    return `${selectedCount} of ${totalCount} institution types selected`;
  };

  const getHeaderIcon = () => {
    if (institutionConfig && showOnlyApplicable && institutionConfig.primaryTypes.length > 0) {
      return <EyeOff className="h-5 w-5 text-orange-600" />;
    }
    return <Building2 className="h-5 w-5 text-blue-600" />;
  };

  if (isLoadingConfig) {
    return (
      <div className="w-full">
        <Card className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              <span className="text-sm text-gray-600">Loading filter configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-slate-200 dark:border-slate-700">
        {showTitle && (
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getHeaderIcon()}
                <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Filter by Institution Type
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {getSummaryText()}
            </p>
          </CardHeader>
        )}
        
        {isExpanded && (
          <CardContent className="pt-0">
            {/* Institution-Based Toggle */}
            {institutionConfig && institutionConfig.allowUsersToToggle && institutionConfig.primaryTypes.length > 0 && (
              <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {showOnlyApplicable ? (
                        <EyeOff className="h-4 w-4 text-orange-600" />
                      ) : (
                        <Eye className="h-4 w-4 text-orange-600" />
                      )}
                      <Label htmlFor="show-only-applicable" className="font-medium text-orange-800 dark:text-orange-200">
                        Show Only Applicable Regulations
                      </Label>
                    </div>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      {showOnlyApplicable 
                        ? `Showing only regulations for: ${institutionConfig.primaryTypes.map(t => INSTITUTION_TYPE_LABELS[t]).join(', ')}`
                        : "Showing all regulations regardless of institution type"
                      }
                    </p>
                  </div>
                  <Switch
                    id="show-only-applicable"
                    checked={showOnlyApplicable}
                    onCheckedChange={setShowOnlyApplicable}
                    className="data-[state=checked]:bg-orange-600"
                  />
                </div>
              </div>
            )}

            {/* Manual Filter Selection (only show when not using institution-based filtering) */}
            {(!institutionConfig || !showOnlyApplicable || institutionConfig.primaryTypes.length === 0) && (
              <>
                {/* Search Box */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search institution types..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={filteredTypes.length === selectedInstitutionTypes.length}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      disabled={selectedInstitutionTypes.length === 0}
                      className="text-xs"
                    >
                      Deselect All
                    </Button>
                  </div>
                  {onClearFilters && selectedInstitutionTypes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearFilters}
                      className="text-red-600 hover:text-red-700 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Institution Type Grid */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {filteredTypes.map((type) => {
                    const isSelected = selectedInstitutionTypes.includes(type);
                    return (
                      <div
                        key={type}
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-md border transition-colors cursor-pointer",
                          isSelected 
                            ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
                            : "bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750"
                        )}
                        onClick={() => handleTypeChange(type, !isSelected)}
                      >
                        <Checkbox
                          id={`institution-${type}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleTypeChange(type, checked as boolean)}
                          className="pointer-events-none"
                        />
                        <Label 
                          htmlFor={`institution-${type}`}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {INSTITUTION_TYPE_LABELS[type]}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Selected Filters Display */}
            {selectedInstitutionTypes.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Active Filters:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {selectedInstitutionTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center space-x-1"
                    >
                      <span>{INSTITUTION_TYPE_LABELS[type]}</span>
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-blue-600"
                        onClick={() => handleTypeChange(type, false)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Helper function to filter regulations by applies to
export function filterRegulationsByAppliesTo(
  regulations: any[],
  selectedInstitutionTypes: string[]
) {
  if (!selectedInstitutionTypes || selectedInstitutionTypes.length === 0) {
    return regulations;
  }

  return regulations.filter(regulation => {
    if (!regulation.applicableInstitutions || !Array.isArray(regulation.applicableInstitutions)) {
      return false;
    }

    return selectedInstitutionTypes.some(filterType => 
      regulation.applicableInstitutions.includes(filterType)
    );
  });
} 