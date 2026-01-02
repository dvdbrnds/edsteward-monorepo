import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Button } from "@/components/ui/button";
import { FileText, Image as ImageIcon, FileText as PdfIcon, User, Upload, Download, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  isOfficial?: boolean;
}

export function EvidenceFiles({ regulationId }: EvidenceFilesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [isOfficial, setIsOfficial] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/regulations/${regulationId}/evidence`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload file');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/regulations', regulationId, 'evidence'] });
      toast({
        title: "Success",
        description: "Evidence file uploaded successfully",
      });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setDescription("");
      setIsOfficial(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', description);
    formData.append('regulationId', regulationId.toString());
    formData.append('isOfficial', isOfficial.toString());

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(formData);
    } finally {
      setIsUploading(false);
    }
  };

  const renderFilePreview = (file: EvidenceFile) => {
    if (file.fileType.startsWith('image/')) {
      return (
        <div className="relative w-full h-32 bg-muted rounded-md overflow-hidden">
          <img 
            src={`/api/uploads/${file.storagePath.split('/').pop()}`}
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Evidence Files</CardTitle>
          <CardDescription>
            Uploaded documentation and evidence files
          </CardDescription>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Evidence
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Evidence File</DialogTitle>
              <DialogDescription>
                Upload documentation or evidence files for this regulation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter a description for this file..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isOfficial"
                  checked={isOfficial}
                  onChange={(e) => setIsOfficial(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="isOfficial" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Mark as official government source document
                </Label>
              </div>
              <Button
                onClick={handleFileUpload}
                disabled={isUploading || !selectedFile}
                className="w-full"
              >
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {evidenceFiles?.length ? (
              evidenceFiles.map((file) => (
                <HoverCard key={file.id}>
                  <HoverCardTrigger asChild>
                    <div className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50">
                      <FileText className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{file.fileName}</p>
                          {file.isOfficial && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                              Official
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{file.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{file.uploaderName}</span>
                          <span>•</span>
                          <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-xs text-right">
                          <p>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                          <p className="capitalize">{file.status}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-1 h-auto"
                          asChild
                          title="Download file"
                        >
                          <a 
                            href={`/downloads/regulations/${file.storagePath.split('/').pop()}`}
                            download={file.fileName}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-80">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">{file.fileName}</h4>
                        {file.isOfficial && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Official
                          </span>
                        )}
                      </div>
                      {renderFilePreview(file)}
                      <p className="text-xs text-muted-foreground">{file.description}</p>
                      <div className="text-xs">
                        <p>Uploaded by: {file.uploaderName}</p>
                        <p>Date: {new Date(file.uploadedAt).toLocaleString()}</p>
                        <p>Size: {(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                        <p>Type: {file.fileType}</p>
                        {file.isOfficial && <p className="font-medium text-blue-700">Government Source Document</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 gap-2"
                        asChild
                      >
                        <a 
                          href={`/downloads/regulations/${file.storagePath.split('/').pop()}`}
                          download={file.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))
            ) : (
              <div className="text-center py-6 px-4 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-dashed border-border">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-green-400" />
                </div>
                <p className="font-medium text-foreground">No evidence files yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload documents to support compliance
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}