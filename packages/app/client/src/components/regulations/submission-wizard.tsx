import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Check, ChevronRight, FileText, Upload, X, Loader2 } from "lucide-react";
import type { Regulation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
];

const evidenceFormSchema = z.object({
  documentTitle: z.string().min(1, "Document title is required"),
  description: z.string().min(1, "Description is required"),
});

type EvidenceFormValues = z.infer<typeof evidenceFormSchema>;

const steps = [
  { id: 'info', title: 'Basic Information' },
  { id: 'requirements', title: 'Requirements Review' },
  { id: 'evidence', title: 'Evidence Upload' },
  { id: 'review', title: 'Final Review' },
  { id: 'submit', title: 'Submit to Agency' }
];

interface UploadedFile {
  file: File;
  description: string;
}

interface SubmissionWizardProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmissionWizard({ regulation, open, onOpenChange }: SubmissionWizardProps) {
  const [currentStep, setCurrentStep] = useState<string>('info');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingToAgency, setIsSubmittingToAgency] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceFormSchema),
    defaultValues: {
      documentTitle: '',
      description: '',
    },
  });

  // Reset wizard when dialog opens
  React.useEffect(() => {
    if (open) {
      setCurrentStep('info');
      setUploadedFiles([]);
      setIsSubmitting(false);
      setIsSubmittingToAgency(false);
      form.reset();
    }
  }, [open, form]);

  const handleStepChange = async (stepId: string) => {
    if (currentStep === 'evidence' && (stepId === 'review' || stepId === 'submit')) {
      const isValid = await form.trigger(['documentTitle', 'description']);
      if (!isValid || uploadedFiles.length === 0) {
        toast({
          title: "Required Fields",
          description: uploadedFiles.length === 0
            ? "Please upload at least one file before proceeding."
            : "Please fill in the document title and description.",
          variant: "destructive",
        });
        return;
      }
    }
    setCurrentStep(stepId);
  };

  const handleFileSelect = (event: React.MouseEvent) => {
    event.preventDefault();
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = (files: File[]) => {
    for (const file of files) {
      // Validate file type and size
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, Word document, or image file.",
          variant: "destructive",
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Files must be smaller than 10MB.",
          variant: "destructive",
        });
        continue;
      }

      // Add file to uploaded files list
      setUploadedFiles(prev => [...prev, { file, description: '' }]);
    }
  };

  const handleFileDescriptionChange = (index: number, description: string) => {
    setUploadedFiles(prev =>
      prev.map((file, i) =>
        i === index ? { ...file, description } : file
      )
    );
  };

  const handleFileRemove = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleEvidenceSubmit = async () => {
    if (!regulation.id) {
      toast({
        title: "Error",
        description: "Invalid regulation ID",
        variant: "destructive",
      });
      return;
    }

    if (uploadedFiles.length === 0) {
      toast({
        title: "No Files",
        description: "Please upload at least one evidence file.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append('data', JSON.stringify(form.getValues()));

      // Add files
      uploadedFiles.forEach((uploadedFile, index) => {
        formData.append('files', uploadedFile.file);
        formData.append(`description${index}`, uploadedFile.description);
      });

      const response = await fetch(`/api/regulations/${regulation.id}/evidence`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include session cookies for authentication
      });

      if (!response.ok) {
        throw new Error('Failed to submit evidence');
      }

      toast({
        title: "Evidence Uploaded Successfully",
        description: `${uploadedFiles.length} files uploaded successfully.`,
      });

      // Move to next step instead of closing
      setCurrentStep('submit');
      queryClient.invalidateQueries({ queryKey: ['/api/regulations', regulation.id, 'evidence'] });
    } catch (evidenceError) {
      toast({
        title: "Submission Failed",
        description: evidenceError instanceof Error ? evidenceError.message : "There was an error submitting your evidence. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgencySubmit = async () => {
    try {
      setIsSubmittingToAgency(true);

      // Submit to the backend API
      const response = await fetch(`/api/regulations/${regulation.id}/submit-to-agency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit to agency');
      }

      const result = await response.json();
      const agencyName = regulation.agency_name || 'Agency';
      
      toast({
        title: "Successfully Submitted to " + agencyName,
        description: result.message || "Your compliance submission has been sent to the agency.",
      });

      // Invalidate queries to refresh regulation data
      queryClient.invalidateQueries({ queryKey: ['/api/regulations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/regulations', regulation.id] });

      // Clear form and close dialog
      setUploadedFiles([]);
      form.reset();
      setCurrentStep('info');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Agency Submission Failed",
        description: error instanceof Error ? error.message : "There was an error submitting to the agency. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingToAgency(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Agency Submission Wizard</DialogTitle>
          <DialogDescription>
            Complete each step to upload evidence and submit your compliance to the agency.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-8">
          {/* Steps sidebar */}
          <div className="w-48 shrink-0">
            <div className="space-y-1">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`
                    flex items-center gap-2 p-2 rounded-md cursor-pointer
                    ${currentStep === step.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                  `}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleStepChange(step.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStepChange(step.id); }}
                >
                  <div className="h-2 w-2 rounded-full bg-current" />
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1">
            <ScrollArea className="h-[500px] pr-4">
              {currentStep === 'info' && (
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <h3>Submit Evidence for {regulation.name}</h3>
                    <p>
                      This wizard will guide you through the process of submitting evidence
                      for compliance with regulation requirements.
                    </p>
                    <div className="bg-muted p-4 rounded-md">
                      <h4 className="text-sm font-medium">Submission Requirements</h4>
                      <ul className="mt-2 text-sm">
                        <li>All required documents must be in PDF format</li>
                        <li>Maximum file size: 10MB per document</li>
                        <li>Evidence must be dated within the current reporting period</li>
                      </ul>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleStepChange('requirements')}
                    className="w-full mt-4"
                  >
                    Begin Submission Process
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}

              {currentStep === 'requirements' && (
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <h3>Review Requirements</h3>
                    <div className="bg-card p-4 rounded-md border">
                      {regulation.requirements?.split('\n').map((req: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 mb-2">
                          <div className="h-6 w-6 rounded-full border flex items-center justify-center shrink-0">
                            <Check className="h-4 w-4" />
                          </div>
                          <p className="text-sm">{req}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleStepChange('evidence')}
                    className="w-full mt-4"
                  >
                    Continue to Evidence Upload
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}

              {currentStep === 'evidence' && (
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField
                      control={form.control}
                      name="documentTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter document title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the contents and relevance of this document"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* File Upload Section */}
                    <div className="space-y-4">
                      <Label>Evidence Files</Label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept={ACCEPTED_FILE_TYPES.join(',')}
                        multiple
                      />

                      <div
                        className="border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer hover:border-primary"
                        role="button"
                        tabIndex={0}
                        onClick={handleFileSelect}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFileSelect(e as unknown as React.MouseEvent); }}
                      >
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click to select files or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Accepted formats: PDF, Word, JPEG, PNG (max 10MB)
                        </p>
                      </div>

                      {/* Uploaded Files List */}
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                          {uploadedFiles.map((uploadedFile, index) => (
                            <div key={index} className="flex items-start gap-2 bg-muted p-2 rounded-md">
                              <FileText className="h-5 w-5 mt-1 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {uploadedFile.file.name}
                                </p>
                                <input
                                  type="text"
                                  placeholder="Add a description for this file..."
                                  className="mt-1 w-full text-sm bg-transparent border-0 border-b border-input focus:ring-0"
                                  value={uploadedFile.description}
                                  onChange={(e) => handleFileDescriptionChange(index, e.target.value)}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileRemove(index)}
                                className="shrink-0"
                                aria-label="Remove file"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={() => handleStepChange('review')}
                      className="w-full"
                    >
                      Continue to Review
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </form>
                </Form>
              )}

              {currentStep === 'review' && (
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <h3>Review Submission</h3>
                    <div className="bg-muted p-4 rounded-md space-y-4">
                      <div>
                        <h4 className="text-sm font-medium">Document Information</h4>
                        <p className="text-sm">{form.getValues('documentTitle')}</p>
                        <p className="text-sm">{form.getValues('description')}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Evidence Files</h4>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="text-sm">
                            <p className="font-medium">{file.file.name}</p>
                            <p className="text-muted-foreground">{file.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleEvidenceSubmit}
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading Evidence...
                      </>
                    ) : (
                      <>
                        Upload Evidence
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {currentStep === 'submit' && (
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <h3>Submit to {regulation.agency_name || 'Agency'}</h3>
                    <p>
                      Your evidence has been uploaded and is ready for submission to the regulatory agency.
                    </p>
                    <div className="bg-green-50 border border-green-200 p-4 rounded-md">
                      <div className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-green-800">Evidence Ready</h4>
                          <p className="text-sm text-green-700">
                            {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} uploaded successfully
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {regulation.agency_name && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800">Agency Information</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          <strong>Agency:</strong> {regulation.agency_name}
                        </p>
                        {regulation.agency_department && (
                          <p className="text-sm text-blue-700">
                            <strong>Department:</strong> {regulation.agency_department}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleStepChange('review')}
                      className="flex-1"
                    >
                      Back to Review
                    </Button>
                    <Button
                      onClick={handleAgencySubmit}
                      className="flex-1"
                      disabled={isSubmittingToAgency}
                    >
                      {isSubmittingToAgency ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit to {regulation.agency_name || 'Agency'}
                          <Check className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}