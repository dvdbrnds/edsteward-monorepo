import React, { useState } from 'react';
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
import { Check, ChevronRight, FileText, Upload } from "lucide-react";
import type { Regulation } from "@shared/schema";

interface SubmissionWizardProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function SubmissionWizard({ regulation, open, onOpenChange }: SubmissionWizardProps) {
  const [currentStep, setCurrentStep] = useState<string>('info');
  
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

  const handleStepChange = (stepId: string) => {
    setCurrentStep(stepId);
  };

  const handleSubmit = (values: EvidenceFormValues) => {
    console.log('Form submitted:', values);
    // TODO: Implement actual submission logic
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
                for compliance with {regulation.agency_name}'s requirements.
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop files here, or click to select files
                </p>
                <Button variant="outline" size="sm" className="mt-2">
                  <FileText className="h-4 w-4 mr-2" />
                  Select Files
                </Button>
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
                  <h4 className="text-sm font-medium">Contact Information</h4>
                  <p className="text-sm">{form.getValues('contact.name')}</p>
                  <p className="text-sm">{form.getValues('contact.email')}</p>
                </div>
              </div>
            </div>
            <Button
              onClick={form.handleSubmit(handleSubmit)}
              className="w-full"
            >
              Submit Evidence
              <Check className="h-4 w-4 ml-2" />
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
