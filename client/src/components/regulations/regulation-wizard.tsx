import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertRegulationSchema, type InsertRegulation } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CATEGORIES = [
  "Academic Programs",
  "Accounting",
  "Admissions",
  "Athletics",
  "Campus Safety",
  "Financial Aid",
  "Other"
];

const FIELD_TOOLTIPS = {
  itemId: "A unique identifier for this regulation. Use existing ID if updating an existing regulation.",
  topic: "The main subject area or focus of the regulation.",
  statute: "The official name or title of the regulation.",
  category: "The department or area primarily responsible for compliance.",
  requirements: "Specific citation of the regulation (e.g., 45 C.F.R. § 617). Include all relevant sections.",
  summary: "A brief overview of what the regulation requires and its impact on the institution.",
  regulationUrl: "Direct link to the regulation text on the official government website.",
  agency_name: "The federal or state agency responsible for enforcing this regulation.",
  agency_url: "Official website of the governing agency.",
  agency_contact: "Primary contact person or office for questions about this regulation.",
  agency_department: "Specific department or division within the agency handling this regulation."
};

interface RegulationWizardProps {
  onSuccess: () => void;
}

export default function RegulationWizard({ onSuccess }: RegulationWizardProps) {
  const [step, setStep] = useState(0);

  const form = useForm<InsertRegulation>({
    resolver: zodResolver(insertRegulationSchema),
    defaultValues: {
      itemId: "",
      topic: "",
      statute: "",
      statuteIds: "",
      requirements: "",
      requirementsUrl: "",
      regulationUrl: "",
      summary: "",
      category: "",
      agency_url: "",
      agency_name: "",
      agency_contact: "",
      agency_department: "",
      jurisdiction: "federal",
      isApplicable: true,
    }
  });

  const createRegulationMutation = useMutation({
    mutationFn: async (data: InsertRegulation) => {
      const res = await apiRequest("POST", "/api/regulations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regulations"] });
      toast({
        title: "Regulation created",
        description: "The regulation has been successfully added.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating regulation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const steps = [
    {
      title: "Basic Information",
      description: "Enter the fundamental details of the regulation",
      fields: [
        {
          name: "itemId",
          label: "Item ID",
          type: "text",
        },
        {
          name: "topic",
          label: "Topic",
          type: "text",
        },
        {
          name: "statute",
          label: "Statute",
          type: "text",
        },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: CATEGORIES,
        },
      ],
    },
    {
      title: "Requirements & Details",
      description: "Specify the regulation requirements and summary",
      fields: [
        {
          name: "requirements",
          label: "Requirements",
          type: "textarea",
          description: "Enter the regulation citation (e.g., 45 C.F.R. § 617)",
        },
        {
          name: "summary",
          label: "Summary",
          type: "textarea",
        },
        {
          name: "regulationUrl",
          label: "Regulation URL",
          type: "url",
          description: "Enter the specific ECFR URL for this regulation",
        },
      ],
    },
    {
      title: "Agency Information",
      description: "Provide details about the governing agency",
      fields: [
        {
          name: "agency_name",
          label: "Agency Name",
          type: "text",
        },
        {
          name: "agency_url",
          label: "Agency Website",
          type: "url",
        },
        {
          name: "agency_contact",
          label: "Agency Contact",
          type: "text",
        },
        {
          name: "agency_department",
          label: "Agency Department",
          type: "text",
        },
      ],
    },
  ];

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  const isLastStep = step === steps.length - 1;

  const handleNext = async () => {
    const fields = steps[step].fields.map(f => f.name);
    const stepValid = await form.trigger(fields as any);

    if (stepValid) {
      if (isLastStep) {
        form.handleSubmit((data) => createRegulationMutation.mutate(data))();
      } else {
        setStep(s => s + 1);
      }
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-gray-500 text-center">
            Step {step + 1} of {steps.length}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{currentStep.title}</CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                {currentStep.fields.map((field) => (
                  <FormField
                    key={field.name}
                    control={form.control}
                    name={field.name as keyof InsertRegulation}
                    render={({ field: formField }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel>{field.label}</FormLabel>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-gray-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                {FIELD_TOOLTIPS[field.name as keyof typeof FIELD_TOOLTIPS]}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          {field.type === 'textarea' ? (
                            <Textarea 
                              {...formField}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          ) : field.type === 'select' ? (
                            <select
                              {...formField}
                              className="w-full p-2 border rounded-md"
                            >
                              <option value="">Select a category</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              {...formField}
                              type={field.type}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                        </FormControl>
                        {field.description && (
                          <FormDescription>{field.description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={createRegulationMutation.isPending}
          >
            {createRegulationMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {isLastStep ? "Create Regulation" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}