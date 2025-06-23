import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Save, AlertCircle, Eye, EyeOff } from "lucide-react";
import { INSTITUTION_TYPES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface InstitutionConfig {
  primaryTypes: string[];
  hideNonApplicable: boolean;
  allowUsersToToggle: boolean;
}

interface InstitutionSettingsProps {
  tenantId: string;
  currentConfig?: InstitutionConfig;
  onConfigUpdate?: (config: InstitutionConfig) => void;
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

const INSTITUTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  "public-universities": "State-funded four-year institutions",
  "private-universities": "Private four-year institutions",
  "community-colleges": "Two-year colleges and community colleges",
  "conservatories": "Music, arts, and performance schools",
  "technical-institutes": "Technical and vocational schools",
  "religious-institutions": "Faith-based educational institutions",
  "for-profit-institutions": "For-profit educational institutions",
  "research-institutes": "Research-focused institutions",
  "professional-schools": "Graduate and professional schools",
  "all-institutions": "Regulations that apply to all institution types"
};

export function InstitutionSettings({ tenantId, currentConfig, onConfigUpdate }: InstitutionSettingsProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<InstitutionConfig>({
    primaryTypes: currentConfig?.primaryTypes || [],
    hideNonApplicable: currentConfig?.hideNonApplicable ?? true,
    allowUsersToToggle: currentConfig?.allowUsersToToggle ?? true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setConfig({
        primaryTypes: currentConfig.primaryTypes || [],
        hideNonApplicable: currentConfig.hideNonApplicable ?? true,
        allowUsersToToggle: currentConfig.allowUsersToToggle ?? true
      });
    }
  }, [currentConfig]);

  useEffect(() => {
    const hasChanged = 
      JSON.stringify(config.primaryTypes.sort()) !== JSON.stringify((currentConfig?.primaryTypes || []).sort()) ||
      config.hideNonApplicable !== (currentConfig?.hideNonApplicable ?? true) ||
      config.allowUsersToToggle !== (currentConfig?.allowUsersToToggle ?? true);
    setHasChanges(hasChanged);
  }, [config, currentConfig]);

  const handleTypeToggle = (type: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      primaryTypes: checked 
        ? [...prev.primaryTypes, type]
        : prev.primaryTypes.filter(t => t !== type)
    }));
  };

  const handleSelectAll = () => {
    const allTypes = INSTITUTION_TYPES.filter(type => type !== 'all-institutions');
    setConfig(prev => ({
      ...prev,
      primaryTypes: allTypes
    }));
  };

  const handleClearAll = () => {
    setConfig(prev => ({
      ...prev,
      primaryTypes: []
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/institution-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to update institution configuration');
      }

      toast({
        title: "Settings Updated",
        description: "Institution configuration has been saved successfully.",
      });

      onConfigUpdate?.(config);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update institution configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRegulationImpact = () => {
    if (config.primaryTypes.length === 0) {
      return "All regulations will be visible to users.";
    }
    if (config.hideNonApplicable) {
      return `Only regulations applicable to ${config.primaryTypes.length} selected institution type(s) will be shown by default.`;
    }
    return "All regulations will be visible, but filtering preferences will be saved.";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle>Institution Type Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure your institution's primary types to automatically filter relevant regulations.
            This helps reduce clutter by hiding regulations that don't apply to your institution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Institution Type Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-medium">Primary Institution Types</Label>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAll}
                  disabled={config.primaryTypes.length === INSTITUTION_TYPES.length - 1}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearAll}
                  disabled={config.primaryTypes.length === 0}
                >
                  Clear All
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INSTITUTION_TYPES.filter(type => type !== 'all-institutions').map((type) => {
                const isSelected = config.primaryTypes.includes(type);
                return (
                  <div
                    key={type}
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-lg border transition-colors",
                      isSelected 
                        ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" 
                        : "bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                    )}
                  >
                    <Checkbox
                      id={`institution-${type}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleTypeToggle(type, checked as boolean)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`institution-${type}`}
                        className="font-medium cursor-pointer"
                      >
                        {INSTITUTION_TYPE_LABELS[type]}
                      </Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {INSTITUTION_TYPE_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {config.primaryTypes.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Types:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.primaryTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {INSTITUTION_TYPE_LABELS[type]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Filtering Behavior */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Filtering Behavior</Label>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 dark:bg-gray-900">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {config.hideNonApplicable ? (
                      <EyeOff className="h-4 w-4 text-gray-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-600" />
                    )}
                    <Label htmlFor="hide-non-applicable" className="font-medium cursor-pointer">
                      Hide Non-Applicable Regulations by Default
                    </Label>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    When enabled, only regulations that apply to your selected institution types will be shown by default.
                    Users can still access all regulations using the filter controls.
                  </p>
                </div>
                <Switch
                  id="hide-non-applicable"
                  checked={config.hideNonApplicable}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, hideNonApplicable: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 dark:bg-gray-900">
                <div className="flex-1">
                  <Label htmlFor="allow-user-toggle" className="font-medium cursor-pointer">
                    Allow Users to Toggle Filtering
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    When enabled, users can toggle between showing only applicable regulations and showing all regulations.
                    When disabled, the filtering behavior is enforced for all users.
                  </p>
                </div>
                <Switch
                  id="allow-user-toggle"
                  checked={config.allowUsersToToggle}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, allowUsersToToggle: checked }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Impact Preview */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Impact:</strong> {getRegulationImpact()}
            </AlertDescription>
          </Alert>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
              className="flex items-center space-x-2"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isLoading ? 'Saving...' : 'Save Configuration'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 