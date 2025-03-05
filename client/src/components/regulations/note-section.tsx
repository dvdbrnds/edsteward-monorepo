import React, { useState, useEffect } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Editor } from '@tinymce/tinymce-react';
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
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  isPrivate: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface NoteSectionProps {
  regulationId: string;
  initialData?: Partial<FormValues> & { id?: string };
}

export function NoteSection({ regulationId, initialData }: NoteSectionProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      isPrivate: initialData?.isPrivate || false,
    },
  });

  useEffect(() => {
    fetchNotes();
  }, [regulationId]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/notes/regulation/${regulationId}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const endpoint = initialData?.id
        ? `/api/notes/${initialData.id}`
        : "/api/notes";

      const method = initialData?.id ? "PUT" : "POST";
      const payload = {
        ...data,
        regulationId: parseInt(regulationId),
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      await fetchNotes();

      if (!initialData?.id) {
        form.reset({
          title: "",
          content: "",
          isPrivate: false,
        });
      }

      toast({
        title: "Success",
        description: initialData?.id ? "Note updated successfully" : "Note created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save note",
        variant: "destructive",
      });
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

      {editorError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Editor Error</AlertTitle>
          <AlertDescription>{editorError}</AlertDescription>
        </Alert>
      )}

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
                  <Editor
                    apiKey={import.meta.env.VITE_TINY_MCE_API_KEY}
                    onInit={(evt, editor) => {
                      if (!import.meta.env.VITE_TINY_MCE_API_KEY) {
                        setEditorError("TinyMCE API key is missing. Please check your environment configuration.");
                      }
                    }}
                    init={{
                      height: 300,
                      menubar: false,
                      plugins: [
                        'lists', 'link', 'table', 'help', 'wordcount'
                      ],
                      toolbar: 'undo redo | formatselect | ' +
                        'bold italic | bullist numlist | ' +
                        'removeformat | help',
                      content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }',
                      branding: false,
                      promotion: false
                    }}
                    value={field.value}
                    onEditorChange={(content) => {
                      field.onChange(content);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Entry"}
          </Button>
        </form>
      </Form>

      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">Diary Entries</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes found for this regulation.</p>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border p-4 rounded-md">
                <div className="flex justify-between items-start">
                  <h4 className="text-md font-medium">{note.title}</h4>
                  <div className="text-xs text-gray-500">
                    {note.user && `By ${note.user.firstName} ${note.user.lastName}`}
                    <span className="ml-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div 
                  className="mt-2 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}