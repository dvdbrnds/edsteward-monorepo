import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Editor } from "@tinymce/tinymce-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const noteFormSchema = z.object({
  title: z.string().min(3, {
    message: "Title must be at least 3 characters.",
  }),
  content: z.string().min(1, {
    message: "Content cannot be empty.",
  }),
  category: z.string().min(1, {
    message: "Please select a category.",
  }),
  status: z.string().min(1, {
    message: "Please select a status.",
  }),
  isPrivate: z.boolean().default(false)
});

// Try to get the API key from environment variables with fallback strategy
const apiKey = import.meta.env.VITE_TINY_MCE_API_KEY || '';

// For development, we can use a fallback mechanism if needed
// Since we're experiencing API key issues, default to using the textarea
const useTinyMCE = true; // Enable TinyMCE rich text editor

// Log a helpful message if the API key is missing
if (!apiKey) {
  console.warn('TinyMCE API key is missing. The editor will run in limited mode. Add VITE_TINY_MCE_API_KEY to your environment variables for full functionality.');
}

export type NoteFormData = z.infer<typeof noteFormSchema>;

interface NoteSectionProps {
  onSubmit: (data: NoteFormData) => void;
  initialData?: Partial<NoteFormData>;
  isSubmitting?: boolean;
}

export function NoteSection({ onSubmit, initialData, isSubmitting = false }: NoteSectionProps) {
  const form = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      category: initialData?.category || "",
      status: initialData?.status || "draft",
      isPrivate: initialData?.isPrivate || false,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Note Information</h3>
        <p className="text-sm text-muted-foreground">
          Enter the details for this regulation note.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Note title" {...field} />
                </FormControl>
                <FormDescription>
                  A clear, concise title for this note.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="requirement">Requirement</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="contact">Contact</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The category helps organize notes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The current status of this note.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  {useTinyMCE ? (
                    <Editor
                      apiKey={apiKey}
                      onEditorChange={(content) => {
                        field.onChange(content);
                      }}
                      onError={(e) => {
                        console.error("TinyMCE error:", e);
                      }}
                      init={{
                        promotion: false,
                        height: 300,
                        menubar: false, // Simplified menu for more stability
                        plugins: [
                          'autolink', 'lists', 'link', 
                          'searchreplace', 'code',
                          'fullscreen', 'help', 'wordcount'
                        ], // Reduced plugins for stability
                        toolbar: 'undo redo | blocks | ' +
                          'bold italic | bullist numlist | ' +
                          'removeformat | help',
                        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }',
                        branding: false,
                        statusbar: false, // Hide status bar for cleaner UI
                        // Fall back to community edition if no API key
                        suffix: '.min',
                        setup: (editor) => {
                          editor.on('init', () => {
                            if (!apiKey) {
                              console.log('TinyMCE running in community mode without an API key');
                            }
                          });
                        }
                      }}
                      onInit={(evt, editor) => {
                        console.log('TinyMCE initialized with API key:', apiKey ? 'present' : 'missing');
                        // Add notification in UI if running in community mode
                        if (!apiKey) {
                          editor.notificationManager.open({
                            text: 'TinyMCE is running in community mode. For full functionality, please add an API key.',
                            type: 'info',
                            timeout: 5000
                          });
                        }
                      }}
                      value={field.value}
                    />
                  ) : (
                    <textarea
                      className="w-full h-64 p-2 border rounded"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Enter note content here..."
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isPrivate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Private Note</FormLabel>
                  <FormDescription>
                    Private notes are only visible to you and admins.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Note"}
          </Button>
        </form>
      </Form>
    </div>
  );
}