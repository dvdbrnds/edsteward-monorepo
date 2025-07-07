import { useEffect, useState } from "react";
import { Editor } from "@monaco-editor/react";
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

  // Fetch previous version if one is selected
  const { data: previousVersion } = useQuery<Regulation>({
    queryKey: compareVersionId ? [`/api/regulations/${compareVersionId}`] : null,
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
        <Editor
          height="100%"
          original={formatRegulationContent(previousVersion)}
          modified={formatRegulationContent(currentRegulation)}
          language="markdown"
          options={{
            renderSideBySide: true,
            readOnly: true,
            minimap: { enabled: false },
            wordWrap: 'on'
          }}
        />
      </div>

      {currentRegulation.versionMetadata?.changes && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Change Summary</h4>
          <ul className="list-disc list-inside">
            {currentRegulation.versionMetadata.changes.map((change, idx) => (
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