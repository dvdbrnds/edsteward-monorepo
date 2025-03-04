import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

// Create a schema for note form validation
const noteFormSchema = z.object({
  regulationId: z.number().positive(),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  isPrivate: z.boolean().default(false)
});

type NoteFormValues = z.infer<typeof noteFormSchema>;

interface Note {
  id: number;
  regulationId: number;
  userId: number;
  title: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    username: string;
    firstName?: string;
    lastName?: string;
  };
}

type NoteSectionProps = {
  regulationId: number;
};

export function NoteSection({ regulationId }: NoteSectionProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get initials from name or username
  const getInitials = (user?: { firstName?: string; lastName?: string; username: string }) => {
    if (!user) return "??";

    // If we have first and last name, use those
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }

    // Fallback to username
    const username = user.username;
    // Take first two characters of username if no space
    if (!username.includes(' ')) {
      return username.substring(0, 2).toUpperCase();
    }
    // Otherwise take first character of each word
    return username
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Form setup
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      regulationId: regulationId,
      title: "",
      content: "",
      isPrivate: false
    }
  });

  // Query for fetching notes
  const { data: notes, isLoading, error, refetch } = useQuery<Note[]>({
    queryKey: ["notes", regulationId],
    queryFn: async () => {
      if (!user) {
        return [];
      }

      try {
        const response = await fetch(`/api/notes/regulation/${regulationId}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch notes: ${response.status}`);
        }

        const data = await response.json();
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
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...noteData,
          regulationId,
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save note');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry Saved",
        description: "Your diary entry has been saved successfully.",
        variant: "default",
      });

      form.reset({
        regulationId: regulationId,
        title: "",
        content: "",
        isPrivate: false
      });

      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save entry. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: NoteFormValues) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to save entries.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(values);
  };

  // If user is not logged in, show message
  if (!user) {
    return (
      <div className="p-4">
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to view and create entries.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Create Regulation Diary Entry</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Regulation Diary Entry title" {...field} />
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

            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="mt-2"
            >
              {createMutation.isPending ? "Saving..." : "Save Entry"}
            </Button>
          </form>
        </Form>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Diary</h3>
        <p className="text-sm text-muted-foreground mb-4">Keep a running journal of how this regulation affects your institution. Use this space to document observations, challenges, and progress in meeting compliance requirements.</p>
        {isLoading ? (
          <p>Loading entries...</p>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load entries. Please try again.
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
                      <div className="flex items-center gap-3 mt-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary text-xs">
                            {getInitials(note.user)}
                          </AvatarFallback>
                        </Avatar>
                        <CardDescription className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {format(new Date(note.updatedAt), "MMM d, yyyy")}
                        </CardDescription>
                      </div>
                    </div>
                    {note.isPrivate && (
                      <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        Private
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No entries found for this regulation.</p>
        )}
      </div>
    </div>
  );
}