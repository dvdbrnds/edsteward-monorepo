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
import { Loader2 } from "lucide-react";
import { useCanonicalCategories } from "@/hooks/use-canonical-categories";

export default function RegulationForm({ onSuccess }: { onSuccess: () => void }) {
  const { categoryNames: CATEGORIES } = useCanonicalCategories();
  const form = useForm<InsertRegulation>({
    resolver: zodResolver(insertRegulationSchema),
    defaultValues: {
      itemId: "",
      name: "",
      topic: "",
      statute: "",
      statuteIds: undefined,
      requirements: undefined,
      requirementsUrl: undefined,
      regulationUrl: undefined,
      summary: undefined,
      category: "",
      jurisdictionSource: "federal",
      agency_url: undefined,
      agency_name: undefined,
      agency_department: undefined,
      submissionGuideUrl: undefined,
      formsUrl: undefined,
      submissionGuidelines: undefined,
      isApplicable: true,
      filingDeadlines: [],
      reportingFrequency: undefined,
      applicableforms: [],
      relatedRegulations: [],
      notificationSchedule: {
        initialReminder: 90,
        weeklyReminder: 30,
        dailyReminder: 7,
        finalDayReminders: true
      }
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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => createRegulationMutation.mutate(data))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="itemId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item ID</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Topic</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="statute"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Statute</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} placeholder="Brief overview of the regulation" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requirements"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Requirements</FormLabel>
              <FormDescription>
                Enter the detailed requirements for compliance
              </FormDescription>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} placeholder="List specific requirements and obligations" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* New submission-specific fields */}
        <div className="bg-background p-4 rounded-lg space-y-4">
          <h3 className="text-lg font-semibold">Submission Requirements</h3>

          <FormField
            control={form.control}
            name="submissionGuidelines"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submission Guidelines</FormLabel>
                <FormDescription>
                  Detailed instructions for submitting compliance documentation
                </FormDescription>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} placeholder="Step-by-step submission process and requirements" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="submissionGuideUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submission Guide URL</FormLabel>
                <FormDescription>
                  Link to official submission guidelines or documentation
                </FormDescription>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="url" placeholder="https://example.com/submission-guide" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="formsUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Required Forms URL</FormLabel>
                <FormDescription>
                  Link to required forms or templates
                </FormDescription>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="url" placeholder="https://example.com/required-forms" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reportingFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reporting Frequency</FormLabel>
                <FormDescription>
                  How often submissions are required
                </FormDescription>
                <FormControl>
                  <select
                    name={field.name}
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select frequency</option>
                    <option value="annual">Annual</option>
                    <option value="semi-annual">Semi-Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="as-needed">As Needed</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="agency_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agency Name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="Name of the regulatory agency" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agency_department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agency Department</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="Specific department or division" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <Button
          type="submit"
          className="w-full"
          disabled={createRegulationMutation.isPending}
        >
          {createRegulationMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add Regulation
        </Button>
      </form>
    </Form>
  );
}