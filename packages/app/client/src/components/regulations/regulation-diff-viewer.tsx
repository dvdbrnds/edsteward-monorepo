import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface RegulationDiffProps {
  currentRegulation: Regulation;
}

export function RegulationDiffViewer({ currentRegulation }: RegulationDiffProps) {
  const [compareVersionId, setCompareVersionId] = useState<number | null>(
    currentRegulation.previousVersionId
  );
  const { toast } = useToast();

  const { data: previousVersion } = useQuery<Regulation>({
    queryKey: [`/api/regulations/${compareVersionId}`],
    enabled: !!compareVersionId,
  });

  // Helper to format regulation content for diff viewing
  const formatRegulationContent = (regulation: Regulation) => {
    return `
Name: ${regulation.name}
Topic: ${regulation.topic}
Statute: ${regulation.statute}
Summary: ${regulation.summary || ''}
Requirements: ${regulation.requirements || ''}
Submission Guidelines: ${regulation.submissionGuidelines || ''}
    `.trim();
  };

  if (!compareVersionId || !previousVersion) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">
          No previous version available for comparison
        </p>
      </Card>
    );
  }

  const previousContent = formatRegulationContent(previousVersion);
  const currentContent = formatRegulationContent(currentRegulation);

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Comparing Version {currentRegulation.versionNumber} with {previousVersion.versionNumber}
        </h3>
        <Button
          variant="outline"
          onClick={() => setCompareVersionId(previousVersion.previousVersionId)}
          disabled={!previousVersion.previousVersionId}
        >
          Compare with Earlier Version
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden h-[500px]">
        <div className="grid grid-cols-2 h-full">
          <div className="border-r">
            <div className="bg-red-50 p-2 text-sm font-medium text-red-700 border-b">
              Previous Version {previousVersion.versionNumber}
            </div>
            <div className="p-4 h-full overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {previousContent}
              </pre>
            </div>
          </div>
          <div>
            <div className="bg-green-50 p-2 text-sm font-medium text-green-700 border-b">
              Current Version {currentRegulation.versionNumber}
            </div>
            <div className="p-4 h-full overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {currentContent}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {(currentRegulation.versionMetadata as any)?.changes && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Change Summary</h4>
          <ul className="list-disc list-inside">
            {(currentRegulation.versionMetadata as any).changes.map((change: { field: string; type: string; oldValue: string; newValue: string }, idx: number) => (
              <li key={idx} className="text-sm">
                <span className="font-medium">{change.field}:</span>{' '}
                <span className={`
                  ${change.type === 'addition' ? 'text-green-600' : ''}
                  ${change.type === 'deletion' ? 'text-red-600' : ''}
                  ${change.type === 'modification' ? 'text-blue-600' : ''}
                `}>
                  {change.type}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}