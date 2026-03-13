import React from 'react';
import { Badge } from '@/components/ui/badge';
import { INSTITUTION_TYPES } from "@shared/schema";

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
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
  'all-institutions': 'All Institutions',
};

const INSTITUTION_TYPE_COLORS: Record<string, string> = {
  'public-4year': 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  'private-nonprofit-4year': 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  'public-2year': 'bg-green-100 text-green-800 hover:bg-green-200',
  'private-nonprofit-2year': 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  'private-for-profit': 'bg-red-100 text-red-800 hover:bg-red-200',
  'religious-affiliation': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  'research-intensive': 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  'graduate-professional': 'bg-teal-100 text-teal-800 hover:bg-teal-200',
  'intercollegiate-athletics': 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  'online-distance-ed': 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
  'medical-health-programs': 'bg-pink-100 text-pink-800 hover:bg-pink-200',
  'residential-campus': 'bg-lime-100 text-lime-800 hover:bg-lime-200',
  'title-iv-participant': 'bg-violet-100 text-violet-800 hover:bg-violet-200',
  'all-institutions': 'bg-gray-100 text-foreground hover:bg-gray-200',
};

interface AppliesToTagsProps {
  applicableInstitutions: string[] | null | undefined;
  className?: string;
  showLabel?: boolean;
  maxDisplay?: number;
}

export const AppliesToTags: React.FC<AppliesToTagsProps> = ({
  applicableInstitutions,
  className = '',
  showLabel = true,
  maxDisplay = 5,
}) => {
  if (!applicableInstitutions || applicableInstitutions.length === 0) {
    return showLabel ? (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm font-medium text-muted-foreground">Applies to:</span>
        <Badge variant="secondary" className="text-xs">Not specified</Badge>
      </div>
    ) : null;
  }

  const validTypes = applicableInstitutions.filter((type: string) =>
    (INSTITUTION_TYPES as readonly string[]).includes(type)
  );

  if (validTypes.includes('all-institutions')) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && <span className="text-sm font-medium text-muted-foreground">Applies to:</span>}
        <Badge className={`text-xs font-medium transition-colors ${INSTITUTION_TYPE_COLORS['all-institutions']}`}>
          All Institutions
        </Badge>
      </div>
    );
  }

  const displayTypes = validTypes.slice(0, maxDisplay);
  const remainingCount = validTypes.length - maxDisplay;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {showLabel && <span className="text-sm font-medium text-muted-foreground">Applies to:</span>}
      <div className="flex flex-wrap gap-1">
        {displayTypes.map((type) => (
          <Badge
            key={type}
            className={`text-xs font-medium transition-colors ${
              INSTITUTION_TYPE_COLORS[type] || 'bg-gray-100 text-foreground hover:bg-gray-200'
            }`}
          >
            {INSTITUTION_TYPE_LABELS[type] || type}
          </Badge>
        ))}
        {remainingCount > 0 && (
          <Badge variant="outline" className="text-xs font-medium text-muted-foreground border-border">
            +{remainingCount} more
          </Badge>
        )}
      </div>
    </div>
  );
};
