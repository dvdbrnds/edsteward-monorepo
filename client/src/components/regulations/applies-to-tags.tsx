import React from 'react';
import { Badge } from '@/components/ui/badge';

// Hardcoded institution types for debugging
const INSTITUTION_TYPES = [
  "public-universities",
  "private-universities", 
  "community-colleges",
  "conservatories",
  "technical-institutes",
  "religious-institutions",
  "for-profit-institutions",
  "research-institutes",
  "professional-schools",
  "all-institutions"
];

// Human-readable labels for institution types
const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  'public-universities': 'Public Universities',
  'private-universities': 'Private Universities',
  'community-colleges': 'Community Colleges',
  'conservatories': 'Conservatories',
  'technical-institutes': 'Technical Institutes',
  'religious-institutions': 'Religious Institutions',
  'for-profit-institutions': 'For-Profit Institutions',
  'research-institutes': 'Research Institutes',
  'professional-schools': 'Professional Schools',
  'all-institutions': 'All Institutions'
};

// Color variants for different institution types
const INSTITUTION_TYPE_COLORS: Record<string, string> = {
  'public-universities': 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  'private-universities': 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  'community-colleges': 'bg-green-100 text-green-800 hover:bg-green-200',
  'conservatories': 'bg-pink-100 text-pink-800 hover:bg-pink-200',
  'technical-institutes': 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  'religious-institutions': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  'for-profit-institutions': 'bg-red-100 text-red-800 hover:bg-red-200',
  'research-institutes': 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  'professional-schools': 'bg-teal-100 text-teal-800 hover:bg-teal-200',
  'all-institutions': 'bg-gray-100 text-foreground hover:bg-gray-200'
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
  maxDisplay = 5
}) => {
  // Debug logging
  console.log('[APPLIES-TO-TAGS] Component rendering with data:', applicableInstitutions);

  // Handle null, undefined, or empty arrays
  if (!applicableInstitutions || applicableInstitutions.length === 0) {
    console.log('[APPLIES-TO-TAGS] No applicable institutions found, showing fallback');
    return showLabel ? (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm font-medium text-muted-foreground">Applies to:</span>
        <Badge variant="secondary" className="text-xs">
          Not specified
        </Badge>
      </div>
    ) : null;
  }

  // Filter out invalid institution types and show only the specified max
  const validTypes = applicableInstitutions.filter((type: string) => 
    INSTITUTION_TYPES.includes(type)
  );
  
  console.log('[APPLIES-TO-TAGS] Valid types:', validTypes);
  
  const displayTypes = validTypes.slice(0, maxDisplay);
  const remainingCount = validTypes.length - maxDisplay;
  
  // If "all-institutions" is present, show only that
  if (validTypes.includes('all-institutions')) {
    console.log('[APPLIES-TO-TAGS] Showing all-institutions tag');
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-sm font-medium text-muted-foreground">Applies to:</span>
        )}
        <Badge 
          className={`text-xs font-medium transition-colors ${INSTITUTION_TYPE_COLORS['all-institutions']}`}
        >
          All Institutions
        </Badge>
      </div>
    );
  }

  console.log('[APPLIES-TO-TAGS] Showing individual institution tags');
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-muted-foreground">Applies to:</span>
      )}
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
          <Badge 
            variant="outline" 
            className="text-xs font-medium text-muted-foreground border-border"
          >
            +{remainingCount} more
          </Badge>
        )}
      </div>
    </div>
  );
}; 