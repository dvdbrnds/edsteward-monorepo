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
  FormDescription,
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

interface SubmissionWizardProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  submissionDate: z.string().min(1, "Submission date is required"),
  contact: z.object({
    name: z.string().min(1, "Contact name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
  }),
  notes: z.string().optional(),
});

type EvidenceFormValues = z.infer<typeof evidenceFormSchema>;

const steps = [
  { id: 'info', title: 'Basic Information' },
  { id: 'requirements', title: 'Requirements Review' },
  { id: 'evidence', title: 'Evidence Upload' },
  { id: 'review', title: 'Final Review' }
];

interface UploadedFile {
  file: File;
  description: string;
}

export function SubmissionWizard({ regulation, open, onOpenChange }: SubmissionWizardProps) {
  const [currentStep, setCurrentStep] = useState<string>('info');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceFormSchema),
    defaultValues: {
      documentTitle: '',
      description: '',
      submissionDate: new Date().toISOString().split('T')[0],
      contact: {
        name: '',
        email: '',
        phone: '',
      },
      notes: '',
    },
  });

  const handleStepChange = async (stepId: string) => {
    if (currentStep === 'evidence' && stepId === 'review') {
      const isValid = await form.trigger(['documentTitle', 'description']);
      if (!isValid) {
        toast({
          title: "Form Validation",
          description: "Please fill in all required fields for this step before proceeding.",
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

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('border-primary');
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-primary');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-primary');
    }

    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
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

  const handleSubmit = async (values: EvidenceFormValues) => {
    try {
      setIsSubmitting(true);

      if (uploadedFiles.length === 0) {
        toast({
          title: "No Files",
          description: "Please upload at least one evidence file.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();

      // Add form values
      formData.append('data', JSON.stringify(values));

      // Add files
      uploadedFiles.forEach((uploadedFile, index) => {
        formData.append('files', uploadedFile.file);
        formData.append(`description${index}`, uploadedFile.description);
      });

      const response = await fetch(`/api/regulations/${regulation.id}/evidence`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit evidence');
      }

      const result = await response.json();

      toast({
        title: "Evidence Submitted Successfully",
        description: `${uploadedFiles.length} files uploaded successfully.`,
      });

      // Clear form and close dialog
      setUploadedFiles([]);
      form.reset();
      queryClient.invalidateQueries(['/api/regulations', regulation.id, 'evidence']);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your evidence. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'info':
        return (
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
                  <li>Contact information must be current and verified</li>
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
        );

      case 'requirements':
        return (
          <div className="space-y-4">
            <div className="prose max-w-none">
              <h3>Review Requirements</h3>
              <div className="bg-white p-4 rounded-md border">
                {regulation.requirements?.split('\n').map((req, index) => (
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
        );

      case 'evidence':
        return (
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
                />

                <div
                  ref={dropZoneRef}
                  className="border-2 border-dashed rounded-md p-6 text-center transition-colors"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop files here, or click to select files
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleFileSelect}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Select Files
                  </Button>
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
        );

      case 'review':
        return (
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
                <div>
                  <h4 className="text-sm font-medium">Contact Information</h4>
                  <p className="text-sm">{form.getValues('contact.name')}</p>
                  <p className="text-sm">{form.getValues('contact.email')}</p>
                  {form.getValues('contact.phone') && (
                    <p className="text-sm">{form.getValues('contact.phone')}</p>
                  )}
                </div>
              </div>
            </div>
            <Button
              onClick={form.handleSubmit(handleSubmit)}
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Evidence
                  <Check className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Submit Evidence</DialogTitle>
          <DialogDescription>
            Complete each step to submit your compliance evidence.
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
                  onClick={() => handleStepChange(step.id)}
                >
                  <div className="h-2 w-2 rounded-full bg-current" />
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1">
            <ScrollArea className="h-[500px]">
              {renderStepContent()}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}