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
import { useToast } from "@/hooks/use-toast";

interface EvidenceFilesProps {
  regulationId: number;
}

export function EvidenceFiles({ regulationId }: EvidenceFilesProps) {
  const { toast } = useToast();
  const { data: evidenceFiles, error, isLoading } = useQuery({
    queryKey: ['/api/regulations', regulationId, 'evidence'],
    queryFn: async () => {
      try {
        console.log('Fetching evidence files for regulation:', regulationId);
        const response = await fetch(`/api/regulations/${regulationId}/evidence`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch evidence files');
        }
        const data = await response.json();
        console.log('Evidence files data:', data);
        return data;
      } catch (err) {
        console.error('Error fetching evidence files:', err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to fetch evidence files",
          variant: "destructive"
        });
        throw err;
      }
    }
  });

  if (isLoading) {
    return <div>Loading evidence files...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500">
        Error loading evidence files: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!evidenceFiles?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence Files</CardTitle>
          <CardDescription>
            No evidence files uploaded yet
          </CardDescription>
        </CardHeader>
      </Card>
    );
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