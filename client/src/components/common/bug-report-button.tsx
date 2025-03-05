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

// Define interface for error details
interface ErrorDetails {
  message?: string;
  stack?: string;
  componentStack?: string | null;
  errorType?: string;
  severity?: 'warning' | 'error' | 'critical';
}

// Props interface for the component
interface BugReportButtonProps {
  errorDetails?: ErrorDetails;
  variant?: 'default' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

const bugReportSchema = z.object({
  comments: z.string().min(10, "Please provide more details about the issue"),
  errorType: z.string().optional(),
  severity: z.enum(['warning', 'error', 'critical']).optional(),
});

type BugReport = z.infer<typeof bugReportSchema>;

export function BugReportButton({ 
  errorDetails,
  variant = 'default',
  size = 'sm' 
}: BugReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();

  const form = useForm<BugReport>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      comments: "",
      errorType: errorDetails?.errorType,
      severity: errorDetails?.severity,
    },
  });

  const onSubmit = async (data: BugReport) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting bug report:", { 
        location, 
        ...data,
        errorDetails 
      });

      // Store the current location and form data
      localStorage.setItem('bugReport_returnTo', location);
      localStorage.setItem('bugReport_data', JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        errorDetails
      }));

      // First check if we need Google auth
      const authCheckResponse = await fetch("/api/auth/check-google-auth");
      if (!authCheckResponse.ok) {
        const authCheckResult = await authCheckResponse.json().catch(() => ({ error: "Failed to check auth status" }));

        if (authCheckResult.needsAuth) {
          // Redirect to Google auth
          window.location.href = "/api/auth/google";
          return;
        }
        throw new Error(authCheckResult.error || "Failed to check authentication status");
      }

      // If we have auth, proceed with submission
      let bugReportData;
      try {
        const savedData = localStorage.getItem('bugReport_data');
        if (!savedData) {
          throw new Error("No saved bug report data found");
        }
        bugReportData = JSON.parse(savedData);
      } catch (parseError) {
        console.error("Failed to parse saved bug report data:", parseError);
        bugReportData = {
          ...data,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          errorDetails
        };
      }

      const returnTo = localStorage.getItem('bugReport_returnTo') || location;

      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: returnTo,
          ...bugReportData
        }),
      });

      const result = await response.json().catch(() => ({ error: "Failed to parse server response" }));

      if (!response.ok) {
        const errorMessage = result.error 
          ? (typeof result.error === 'object' ? JSON.stringify(result.error) : result.error)
          : "Failed to submit bug report";
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

  const buttonVariant = variant === 'subtle' ? 'ghost' : 'outline';
  const buttonStyle = variant === 'subtle' 
    ? "text-red-600 hover:bg-red-50"
    : "gap-2 border-red-200 hover:border-red-300 hover:bg-red-50";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={buttonVariant}
          size={size}
          className={buttonStyle}
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
            {errorDetails?.message && (
              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-md">
                <p className="text-sm font-medium text-red-800">Error Details:</p>
                <p className="text-sm text-red-600">{errorDetails.message}</p>
              </div>
            )}
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
                    Submitting...
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