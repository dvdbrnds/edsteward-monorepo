import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Regulation } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface RegulationChangesProps {
  currentRegulation: Regulation;
}

const COMPARED_FIELDS = [
  { key: 'summary', label: 'Summary' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'submissionGuidelines', label: 'Submission Guidelines' },
  { key: 'statute', label: 'Statute' },
  { key: 'complianceNotes', label: 'Compliance Notes' }
] as const;

function HighlightDifferences({ oldText = '', newText = '' }: { oldText?: string; newText?: string }) {
  if (!oldText && !newText) return null;
  if (!oldText) return <span className="bg-green-100">{newText}</span>;
  if (!newText) return <span className="bg-red-100">{oldText}</span>;

  const words1 = oldText.split(' ');
  const words2 = newText.split(' ');
  const changes: React.ReactElement[] = [];

  let i = 0;
  let j = 0;

  while (i < words1.length || j < words2.length) {
    if (i >= words1.length) {
      // Rest of words2 are additions
      changes.push(
        <span key={`add-${j}`} className="bg-green-100">
          {words2.slice(j).join(' ')} 
        </span>
      );
      break;
    }
    if (j >= words2.length) {
      // Rest of words1 are deletions
      changes.push(
        <span key={`del-${i}`} className="bg-red-100">
          {words1.slice(i).join(' ')} 
        </span>
      );
      break;
    }

    if (words1[i] === words2[j]) {
      changes.push(<span key={`same-${i}`}>{words1[i]} </span>);
      i++;
      j++;
    } else {
      // Look ahead for matches
      const nextMatch = words2.slice(j).findIndex(w => w === words1[i]);
      if (nextMatch === -1) {
        // Word was deleted
        changes.push(
          <span key={`del-${i}`} className="bg-red-100">
            {words1[i]}{' '}
          </span>
        );
        i++;
      } else {
        // Words were added
        changes.push(
          <span key={`add-${j}`} className="bg-green-100">
            {words2.slice(j, j + nextMatch).join(' ')}{' '}
          </span>
        );
        j += nextMatch;
      }
    }
  }

  return <div className="whitespace-pre-wrap">{changes}</div>;
}

export function RegulationChanges({ currentRegulation }: RegulationChangesProps) {
  const { data: previousVersion, isLoading } = useQuery<Regulation>({
    queryKey: ["/api/regulations", currentRegulation.previousVersionId],
    enabled: !!currentRegulation.previousVersionId
  });

  if (!currentRegulation.previousVersionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">This is the first version of this regulation.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!previousVersion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Previous version not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Changes from Version {previousVersion.versionNumber}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {COMPARED_FIELDS.map(({ key, label }) => {
            const oldValue = previousVersion[key as keyof Regulation] as string;
            const newValue = currentRegulation[key as keyof Regulation] as string;

            if (oldValue === newValue) return null;

            return (
              <div key={key} className="space-y-2">
                <h3 className="font-medium text-foreground">{label}</h3>
                <div className="rounded-lg border p-4 bg-background">
                  <HighlightDifferences oldText={oldValue} newText={newValue} />
                </div>
              </div>
            );
          })}

          {(currentRegulation.versionMetadata as any)?.changes?.length === 0 && (
            <p className="text-muted-foreground italic">No significant changes detected between versions.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
