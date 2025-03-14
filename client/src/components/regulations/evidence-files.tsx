import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download } from "lucide-react";

interface EvidenceFilesProps {
  regulationId: number;
}

export function EvidenceFiles({ regulationId }: EvidenceFilesProps) {
  const { data: evidenceFiles } = useQuery({
    queryKey: ['/api/regulations', regulationId, 'evidence'],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${regulationId}/evidence`);
      if (!response.ok) throw new Error('Failed to fetch evidence files');
      return response.json();
    }
  });

  if (!evidenceFiles?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Files</CardTitle>
        <CardDescription>
          Uploaded documentation and evidence files
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {evidenceFiles.map((file: any) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 rounded-md border"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{file.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-xs text-right">
                  <p>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="capitalize">{file.status}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
