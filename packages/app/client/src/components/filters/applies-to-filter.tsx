import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff } from "lucide-react";
import { useInstitutionFilter } from "@/hooks/use-institution-filter";

const TYPE_LABELS: Record<string, string> = {
  'public-4year': 'Public University',
  'private-nonprofit-4year': 'Private Nonprofit University',
  'public-2year': 'Community College',
  'private-nonprofit-2year': 'Private Nonprofit College',
  'private-for-profit': 'For-Profit',
  'religious-affiliation': 'Religious',
  'research-intensive': 'Research Intensive',
  'graduate-professional': 'Graduate/Professional',
  'intercollegiate-athletics': 'Athletics',
  'online-distance-ed': 'Online/Distance',
  'medical-health-programs': 'Medical/Health',
  'residential-campus': 'Residential',
  'title-iv-participant': 'Title IV',
};

export function AppliesToFilter() {
  const {
    config,
    institutionTypes,
    isConfigured,
    isFiltering,
    toggleFilter,
  } = useInstitutionFilter();

  if (!config || !isConfigured) return null;
  if (!config.allowUsersToToggle) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isFiltering ? (
          <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Label htmlFor="applicability-toggle" className="text-sm cursor-pointer whitespace-nowrap">
          {isFiltering ? 'Showing applicable only' : 'Showing all regulations'}
        </Label>
        {isFiltering && institutionTypes.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {institutionTypes.slice(0, 3).map(t => (
              <Badge key={t} variant="secondary" className="text-xs">
                {TYPE_LABELS[t] || t}
              </Badge>
            ))}
            {institutionTypes.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{institutionTypes.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
      <Switch
        id="applicability-toggle"
        checked={isFiltering}
        onCheckedChange={toggleFilter}
      />
    </div>
  );
}
