import React from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]),
  isPrivate: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface NoteSectionProps {
  regulationId: string;
  initialData?: Partial<FormValues> & { id?: string };
}

export function NoteSection({ regulationId, initialData }: NoteSectionProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      category: initialData?.category || "",
      status: initialData?.status || "draft",
      isPrivate: initialData?.isPrivate || false,
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);

      const endpoint = initialData?.id
        ? `/api/notes/${initialData.id}`
        : "/api/notes";

      const method = initialData?.id ? "PUT" : "POST";

      const payload = {
        ...data,
        regulationId,
      };

      const response = await apiRequest(endpoint, {
        method,
        body: payload,
      });

      if (!response.ok) {
        throw new Error("Failed to save note");
      }

      toast({
        title: "Success",
        description: initialData?.id
          ? "Note updated successfully"
          : "Note created successfully",
      });

      //router.refresh(); // Removed as useRouter is no longer imported.  Refresh functionality needs a different solution if required.
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          {initialData?.id ? "Edit Note" : "Add Note"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {initialData?.id
            ? "Update your note for this regulation"
            : "Add a note to this regulation for future reference"}
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <div className="rich-text-editor">
                    <ReactQuill
                      theme="snow"
                      value={field.value}
                      onChange={field.onChange}
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{'list': 'ordered'}, {'list': 'bullet'}],
                          ['link', 'clean']
                        ],
                      }}
                      style={{ height: '300px', marginBottom: '50px' }}
                    />
                  </div>
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
                <FormLabel>Category (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
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
                <FormControl>
                  <select
                    {...field}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Private note option temporarily removed 
          <FormField
            control={form.control}
            name="isPrivate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Private Note</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Only you will be able to see this note
                  </p>
                </div>
              </FormItem>
            )}
          />
          */}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Note"}
          </Button>
        </form>
      </Form>
    </div>
  );
}