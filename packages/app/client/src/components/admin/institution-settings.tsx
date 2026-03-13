import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Save, AlertCircle, Eye, EyeOff, Check } from "lucide-react";
import { INSTITUTION_PRIMARY_TYPES, INSTITUTION_CHARACTERISTICS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface InstitutionConfig {
  primaryType: string | null;
  characteristics: string[];
  hideNonApplicable: boolean;
  allowUsersToToggle: boolean;
}

const PRIMARY_TYPE_META: Record<string, { label: string; description: string }> = {
  "public-4year": {
    label: "Public University (4-year)",
    description: "State-funded/governed institution granting bachelor's degrees or higher",
  },
  "private-nonprofit-4year": {
    label: "Private Nonprofit University (4-year)",
    description: "Private, not-for-profit institution granting bachelor's degrees or higher",
  },
  "public-2year": {
    label: "Public Community College (2-year)",
    description: "State-funded institution primarily granting associate degrees",
  },
  "private-nonprofit-2year": {
    label: "Private Nonprofit College (2-year)",
    description: "Private, not-for-profit institution primarily granting associate degrees",
  },
  "private-for-profit": {
    label: "For-Profit Institution",
    description: "Proprietary institution — subject to gainful employment rules, 90/10, heightened DOE oversight",
  },
};

const CHARACTERISTIC_META: Record<string, { label: string; description: string }> = {
  "religious-affiliation": {
    label: "Religious Affiliation",
    description: "Faith-based institution — eligible for Title IX religious exemptions",
  },
  "research-intensive": {
    label: "Research Intensive (R1/R2)",
    description: "High research activity — export controls, research integrity, IRB/IACUC emphasis",
  },
  "graduate-professional": {
    label: "Graduate / Professional Programs",
    description: "Offers graduate or professional degree programs",
  },
  "intercollegiate-athletics": {
    label: "Intercollegiate Athletics",
    description: "NCAA/NAIA member — Title IX athletics equity, EADA reporting",
  },
  "online-distance-ed": {
    label: "Online / Distance Education",
    description: "Significant online presence — state authorization reciprocity (SARA)",
  },
  "medical-health-programs": {
    label: "Medical / Health Programs",
    description: "Medical school, nursing, or health sciences — HIPAA emphasis, clinical compliance",
  },
  "residential-campus": {
    label: "Residential Campus",
    description: "Has on-campus housing — expanded Clery geography, fire safety, housing regulations",
  },
  "title-iv-participant": {
    label: "Title IV Participant",
    description: "Participates in federal student aid — the gating factor for most federal compliance",
  },
};

interface InstitutionSettingsProps {
  onConfigUpdate?: () => void;
}

export function InstitutionSettings({ onConfigUpdate }: InstitutionSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedConfig, isLoading: isLoadingConfig } = useQuery<InstitutionConfig>({
    queryKey: ["/api/institution-config/types"],
    queryFn: async () => {
      const res = await fetch("/api/institution-config/types");
      if (!res.ok) throw new Error("Failed to load config");
      const data = await res.json();
      return data.config;
    },
  });

  const [config, setConfig] = useState<InstitutionConfig>({
    primaryType: null,
    characteristics: [],
    hideNonApplicable: true,
    allowUsersToToggle: true,
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: async (cfg: InstitutionConfig) => {
      const res = await fetch("/api/institution-config/types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institution-config/types"] });
      queryClient.invalidateQueries({ predicate: (query) =>
        typeof query.queryKey[0] === 'string' && (query.queryKey[0] as string).startsWith('/api/regulations')
      });
      toast({ title: "Settings Updated", description: "Institution configuration saved successfully." });
      onConfigUpdate?.();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save institution configuration.", variant: "destructive" });
    },
  });

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const handleCharacteristicToggle = (char: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      characteristics: checked
        ? [...prev.characteristics, char]
        : prev.characteristics.filter(c => c !== char),
    }));
  };

  const getRegulationImpact = () => {
    if (!config.primaryType && config.characteristics.length === 0) {
      return "No institution type selected — all regulations will be visible.";
    }
    const typeCount = (config.primaryType ? 1 : 0) + config.characteristics.length;
    if (config.hideNonApplicable) {
      return `Only regulations applicable to your ${typeCount} selected type/characteristic(s) will be shown by default.`;
    }
    return "All regulations will be visible, but your institution profile will be saved for filtering.";
  };

  if (isLoadingConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading institution configuration...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle>Institution Type Configuration</CardTitle>
          </div>
          <CardDescription>
            Define your institution's classification to automatically filter regulations.
            Only regulations that apply to your institution type will be shown by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Tier 1: Primary Classification */}
          <div>
            <Label className="text-base font-medium">Primary Classification</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Select the one category that best describes your institution's sector and level.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {INSTITUTION_PRIMARY_TYPES.map((type) => {
                const meta = PRIMARY_TYPE_META[type];
                const isSelected = config.primaryType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      primaryType: prev.primaryType === type ? null : type,
                    }))}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border text-left transition-colors",
                      isSelected
                        ? "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700"
                        : "bg-background border-border hover:bg-muted/50 dark:bg-gray-900 dark:border-gray-700"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-5 w-5 rounded-full border-2 shrink-0",
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300 dark:border-gray-600"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{meta?.label || type}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{meta?.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Tier 2: Characteristics */}
          <div>
            <Label className="text-base font-medium">Institutional Characteristics</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Select all characteristics that apply. Each triggers additional regulatory requirements.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {INSTITUTION_CHARACTERISTICS.map((char) => {
                const meta = CHARACTERISTIC_META[char];
                const isSelected = config.characteristics.includes(char);
                return (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleCharacteristicToggle(char, !isSelected)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border text-left transition-colors",
                      isSelected
                        ? "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700"
                        : "bg-background border-border hover:bg-muted/50 dark:bg-gray-900 dark:border-gray-700"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-5 w-5 rounded-md border-2 shrink-0 mt-0.5",
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300 dark:border-gray-600"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{meta?.label || char}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{meta?.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {(config.primaryType || config.characteristics.length > 0) && (
              <div className="mt-4">
                <Label className="text-sm font-medium text-foreground dark:text-gray-300">Your Profile:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.primaryType && (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {PRIMARY_TYPE_META[config.primaryType]?.label || config.primaryType}
                    </Badge>
                  )}
                  {config.characteristics.map((char) => (
                    <Badge key={char} variant="secondary">
                      {CHARACTERISTIC_META[char]?.label || char}
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
              <div className="flex items-center justify-between p-4 rounded-lg border bg-background dark:bg-gray-900">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {config.hideNonApplicable ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="hide-non-applicable" className="font-medium cursor-pointer">
                      Hide Non-Applicable Regulations by Default
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    When enabled, only regulations that apply to your institution type will be shown by default.
                    Users can still access all regulations using the filter controls.
                  </p>
                </div>
                <Switch
                  id="hide-non-applicable"
                  checked={config.hideNonApplicable}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, hideNonApplicable: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-background dark:bg-gray-900">
                <div className="flex-1">
                  <Label htmlFor="allow-user-toggle" className="font-medium cursor-pointer">
                    Allow Users to Toggle Filtering
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    When enabled, users can toggle between showing only applicable regulations and showing all.
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
              onClick={() => saveMutation.mutate(config)}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center space-x-2"
            >
              {saveMutation.isPending ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{saveMutation.isPending ? 'Saving...' : 'Save Configuration'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
