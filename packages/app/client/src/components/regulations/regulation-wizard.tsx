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
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCanonicalCategories } from "@/hooks/use-canonical-categories";

interface RegulationWizardProps {
  onSuccess: () => void;
}

export default function RegulationWizard({ onSuccess }: RegulationWizardProps) {
  const [step, setStep] = useState(0);
  const { categoryNames: CATEGORIES } = useCanonicalCategories();

  const form = useForm<InsertRegulation>({
    resolver: zodResolver(insertRegulationSchema),
    defaultValues: {
      itemId: "",
      topic: "",
      statute: "",
      statuteIds: undefined,
      requirements: undefined,
      requirementsUrl: undefined,
      regulationUrl: undefined,
      summary: undefined,
      category: "",
      agency_url: undefined,
      agency_name: undefined,
      agency_contact: undefined,
      agency_department: undefined,
      jurisdictionSource: "federal",
      applicableInstitutions: ["all-institutions"],
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

  const steps: Array<{
    title: string;
    description: string;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      options?: string[];
      description?: string;
    }>;
  }> = [
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Progress value={progress} className="w-full" />
        <p className="text-sm text-muted-foreground text-center">
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
                      <FormLabel>{field.label}</FormLabel>
                      <FormControl>
                        {field.type === 'textarea' ? (
                          <Textarea 
                            {...formField}
                            value={(formField.value as string) ?? ""}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        ) : field.type === 'select' ? (
                          <select
                            {...formField}
                            value={(formField.value as string) ?? ""}
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
                            value={(formField.value as string) ?? ""}
                            type={field.type === 'url' ? 'url' : 'text'}
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
  );
}
