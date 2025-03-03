
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Create a schema for note form validation
const noteFormSchema = z.object({
  regulationId: z.number().positive(),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().default("general"),
  status: z.string().default("active"),
  isPrivate: z.boolean().default(false)
});

type NoteFormValues = z.infer<typeof noteFormSchema>;

// Define Note type
interface Note {
  id: number;
  regulationId: number;
  userId: number;
  title: string;
  content: string;
  category: string;
  status: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  username: string;
}

type NoteSectionProps = {
  regulationId: number;
};

export function NoteSection({ regulationId }: NoteSectionProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  console.log("NoteSection rendering with regulationId:", regulationId);
  console.log("Current user:", user);

  // Form setup
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      regulationId: regulationId,
      title: "",
      content: "",
      category: "general",
      status: "active",
      isPrivate: false
    }
  });

  // Query for fetching notes
  const { data: notes, isLoading, error, refetch } = useQuery<Note[]>({
    queryKey: ["notes", regulationId],
    queryFn: async () => {
      console.log(`Fetching notes for regulation ${regulationId}`);
      if (!user) {
        console.log("No user logged in, cannot fetch notes");
        return [];
      }

      try {
        const response = await fetch(`/api/notes/regulation/${regulationId}`, {
          credentials: 'include' // Important: Include cookies for auth
        });

        console.log("Notes fetch response:", {
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch notes: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Retrieved ${data.length} notes:`, data);
        return data;
      } catch (error) {
        console.error("Error fetching notes:", error);
        throw error;
      }
    },
    enabled: !!user && !!regulationId
  });

  // Mutation for creating notes
  const createMutation = useMutation({
    mutationFn: async (noteData: NoteFormValues) => {
      console.log("Creating note with data:", noteData);
      
      try {
        // Send the POST request
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(noteData),
          credentials: 'include' // Ensure cookies are sent with the request
        });

        console.log("Response received:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()]),
          ok: response.ok
        });

        const responseText = await response.text();
        console.log("Response body:", responseText);

        if (!response.ok) {
          console.error("Failed to save note:", responseText);
          let errorMessage = `Failed to save note: ${response.status} ${response.statusText}`;
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error("Error parsing error response:", parseError);
          }
          throw new Error(errorMessage);
        }

        // Parse the response if it's JSON
        let savedNote;
        try {
          savedNote = JSON.parse(responseText);
          console.log("Note saved successfully:", savedNote);
        } catch (parseError) {
          console.error("Error parsing response:", parseError);
          throw new Error("Received invalid response from server");
        }
        return savedNote;
      } catch (error) {
        console.error("Note creation failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Show success message
      toast({
        title: "Note Saved",
        description: "Your note has been saved successfully.",
        variant: "default",
      });

      // Reset the form
      form.reset({
        regulationId: regulationId,
        title: "",
        content: "",
        category: "general",
        status: "active",
        isPrivate: false
      });

      // Refetch notes to update the list
      refetch();
    },
    onError: (error: any) => {
      // Show error message
      toast({
        title: "Error",
        description: error.message || "Failed to save note. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: NoteFormValues) => {
    console.log("Form submitted with values:", values);
    
    if (!user) {
      console.error("Cannot submit note: User not logged in");
      toast({
        title: "Authentication Required",
        description: "You must be logged in to save notes.",
        variant: "destructive",
      });
      return;
    }

    // Add regulationId to ensure it's included
    const noteData = {
      ...values,
      regulationId: regulationId
    };

    console.log("Submitting note data:", noteData);
    createMutation.mutate(noteData);
  };

  // If user is not logged in, show message
  if (!user) {
    return (
      <div className="p-4">
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to view and create notes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Create Note</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Note title" {...field} />
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
                    <Textarea
                      placeholder="Add your notes here..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[200px]">
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
                        <SelectItem value="deadline">Deadline</SelectItem>
                        <SelectItem value="issue">Issue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[200px]">
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
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Private note switch temporarily removed */}

            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="mt-2"
            >
              {createMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </form>
        </Form>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Notes</h3>
        {isLoading ? (
          <p>Loading notes...</p>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load notes. Please try again.
            </AlertDescription>
          </Alert>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-4">
            {notes.map((note) => (
              <Card key={note.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{note.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(new Date(note.updatedAt), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <div className="text-xs px-2 py-1 rounded-full bg-muted">
                        {note.category}
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-muted">
                        {note.status}
                      </div>
                      {note.isPrivate && (
                        <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          Private
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No notes found for this regulation.</p>
        )}
      </div>
    </div>
  );
}
