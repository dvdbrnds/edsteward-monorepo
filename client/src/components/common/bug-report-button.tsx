import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BugIcon } from "lucide-react";
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
      const response = await fetch("/api/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
          comments: data.comments,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit bug report");
      }

      toast({
        title: "Bug Report Submitted",
        description: "Thank you for helping us improve the system.",
      });
      setIsOpen(false);
      form.reset();
    } catch (error) {
      console.error("Bug report submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit bug report. Please try again.",
        variant: "destructive",
      });
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
              >
                Cancel
              </Button>
              <Button type="submit">Submit Report</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}