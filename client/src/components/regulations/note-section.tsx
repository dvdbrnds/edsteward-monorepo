import React, { useState, useEffect } from "react";
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
  const [notes, setNotes] = useState<any[]>([]);

  // Fetch notes when component loads
  useEffect(() => {
    fetchNotes();
  }, [regulationId]);

  // Use form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      isPrivate: initialData?.isPrivate || false,
    },
  });

  const fetchNotes = async () => {
    const updatedResponse = await fetch(`/api/notes/regulation/${regulationId}`);
    if (updatedResponse.ok) {
      const updatedData = await updatedResponse.json();
      setNotes(updatedData);
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
      });

      // Log raw response for debugging
      const responseText = await response.text();
      console.log('Raw server response:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error(`Failed to parse server response: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to save note");
      }

      // Refresh notes after successful submission
      await fetchNotes();

      // Reset form if creating a new note
      if (!initialData?.id) {
        form.reset({
          title: "",
          content: "",
          isPrivate: false,
        });
      }

      toast({
        title: "Success",
        description: initialData?.id
          ? "Note updated successfully"
          : "Note created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save note",
        variant: "destructive",
      });
      console.error('Note submission error:', error);
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
            {isSubmitting ? "Saving..." : "Save Entry"}
          </Button>
        </form>
      </Form>

      {/* Display existing notes */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">Diary Entries</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes found for this regulation.</p>
        ) : (
          <ul className="space-y-4"> {/* Changed to ul for better list rendering */}
            {notes.map((note) => (
              <li key={note.id} className="border p-4 rounded-md"> {/* Changed to li */}
                <div className="flex justify-between items-start">
                  <h4 className="text-md font-medium">{note.title}</h4>
                  <div className="text-xs text-gray-500">
                    {note.user && `By ${note.user.firstName} ${note.user.lastName}`}
                    {note.createdAt && (
                      <span className="ml-2">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    )}
                    {note.isPrivate && <span className="ml-2">(Private)</span>}
                  </div>
                </div>
                <div
                  className="mt-2 text-sm"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
                {/* Removed status display */}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}