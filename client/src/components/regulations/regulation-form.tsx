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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function RegulationForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<InsertRegulation>({
    resolver: zodResolver(insertRegulationSchema),
    defaultValues: {
      requirements: "",
      requirementsUrl: "https://www.ecfr.gov/",
      regulationUrl: "",
      summary: "",
      deadlines: "",
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
                  <option value="Academic Programs">Academic Programs</option>
                  <option value="Accounting">Accounting</option>
                  <option value="Admissions">Admissions</option>
                  <option value="Athletics">Athletics</option>
                  <option value="Campus Safety">Campus Safety</option>
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
                <Textarea {...field} />
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
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requirementsUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Requirements Source URL</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="url" 
                  placeholder="https://www.ecfr.gov/"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="regulationUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specific Regulation URL</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="url" 
                  placeholder="https://www.ecfr.gov/current/title-34/part-600"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deadlines"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deadlines</FormLabel>
              <FormControl>
                <Input {...field} />
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