import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BugIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const bugReportSchema = z.object({
  comments: z.string().min(10, "Please provide more details about the issue"),
});

type BugReport = z.infer<typeof bugReportSchema>;

export function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();

  const form = useForm<BugReport>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      comments: "",
    },
  });

  const onSubmit = async (data: BugReport) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting bug report:", { location, comments: data.comments });

      // Store the current location before checking auth
      localStorage.setItem('bugReport_returnTo', location);
      localStorage.setItem('bugReport_data', JSON.stringify(data));

      // First check if we need Google auth
      const authCheckResponse = await fetch("/api/auth/check-google-auth");
      const authCheckResult = await authCheckResponse.json();

      if (!authCheckResponse.ok) {
        if (authCheckResult.needsAuth) {
          // Redirect to Google auth
          window.location.href = "/api/auth/google";
          return;
        }
        throw new Error(authCheckResult.error || "Failed to check authentication status");
      }

      // If we have auth, proceed with submission
      const savedData = localStorage.getItem('bugReport_data');
      if (savedData) {
        const bugReportData = JSON.parse(savedData);
        const response = await fetch("/api/bug-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location: localStorage.getItem('bugReport_returnTo') || location,
            comments: bugReportData.comments,
          }),
        });

        const result = await response.json();
        console.log("Bug report submission response:", result);

        if (!response.ok) {
          const errorMessage = typeof result.error === 'object' 
            ? JSON.stringify(result.error)
            : result.error || result.details || "Failed to submit bug report";
          throw new Error(errorMessage);
        }

        // Clear stored data after successful submission
        localStorage.removeItem('bugReport_data');
        localStorage.removeItem('bugReport_returnTo');

        toast({
          title: "Bug Report Submitted",
          description: "Thank you for helping us improve the system.",
        });
        setIsOpen(false);
        form.reset();
      }
    } catch (error: any) {
      console.error("Bug report submission error:", error);
      const errorMessage = error.message && typeof error.message === 'string'
        ? error.message
        : "Failed to submit bug report. Please try again.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-red-200 hover:border-red-300 hover:bg-red-50"
        >
          <BugIcon className="h-4 w-4 text-red-500" />
          <span className="text-red-600">Report Bug</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Help us improve by reporting any issues you encounter.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe the issue..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}