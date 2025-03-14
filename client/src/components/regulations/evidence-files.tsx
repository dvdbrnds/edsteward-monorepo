import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Image as ImageIcon, FileText as PdfIcon, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EvidenceFilesProps {
  regulationId: number;
}

interface EvidenceFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedAt: string;
  status: string;
  storagePath: string;
  uploaderName: string;
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
        return data as EvidenceFile[];
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

  const renderFilePreview = (file: EvidenceFile) => {
    if (file.fileType.startsWith('image/')) {
      return (
        <div className="relative w-full h-32 bg-muted rounded-md overflow-hidden">
          <img 
            src={`/uploads/${file.storagePath.split('/').pop()}`}
            alt={file.fileName}
            className="object-cover w-full h-full"
          />
        </div>
      );
    } else if (file.fileType === 'application/pdf') {
      return (
        <div className="bg-muted p-4 rounded-md text-center">
          <PdfIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">PDF Preview</p>
        </div>
      );
    }
    return null;
  };

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
            {evidenceFiles.map((file) => (
              <HoverCard key={file.id}>
                <HoverCardTrigger asChild>
                  <div className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50">
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">{file.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{file.uploaderName}</span>
                        <span>•</span>
                        <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-xs text-right">
                      <p>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                      <p className="capitalize">{file.status}</p>
                    </div>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{file.fileName}</h4>
                    {renderFilePreview(file)}
                    <p className="text-xs text-muted-foreground">{file.description}</p>
                    <div className="text-xs">
                      <p>Uploaded by: {file.uploaderName}</p>
                      <p>Date: {new Date(file.uploadedAt).toLocaleString()}</p>
                      <p>Size: {(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                      <p>Type: {file.fileType}</p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}