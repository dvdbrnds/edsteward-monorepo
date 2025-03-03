import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { insertNoteSchema } from "@shared/schema";
import type { Note, InsertNote } from "@shared/schema";
import { Switch } from "@/components/ui/switch";

interface NoteSectionProps {
  regulationId: number;
}

export function NoteSection({ regulationId }: NoteSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertNoteSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "general",
      status: "active",
      isPrivate: false,
      regulationId,
    },
  });

  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes/regulation", regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/notes/regulation/${regulationId}`);
      if (!response.ok) throw new Error("Failed to fetch notes");
      return response.json();
    },
    onError: (error) => {
      console.error("Failed to fetch notes:", error);
      // Return empty array on error to prevent UI issues
      return [];
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: InsertNote) => {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create note");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Show success message
      toast({
        title: "Note Saved",
        description: "Your note has been saved successfully.",
        variant: "default",
      });

      // Reset the form
      form.reset({
        title: "",
        content: "",
        category: "general",
        status: "active",
        isPrivate: false
      });

      // Refetch notes to update the list
      queryClient.invalidateQueries({ queryKey: ["notes", regulationId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save note. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: InsertNote) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to add notes.",
        variant: "destructive",
      });
      return;
    }

    // Make sure regulationId is included
    const noteData = {
      ...data,
      regulationId,
    };

    createNoteMutation.mutate(noteData);
  };

  if (!user) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 my-6">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Authentication Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>You must be logged in to add or view notes.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Notes</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Note title..." {...field} />
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
                    placeholder="Write your note here..."
                    className="min-h-[100px]"
                    {...field}
                  />
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
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isPrivate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Private Note</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Only you will be able to see this note
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={createNoteMutation.isPending}
          >
            {createNoteMutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </form>
      </Form>

      <div className="space-y-4">
        {notes?.length === 0 ? (
          <p className="text-center text-gray-500 italic">
            No notes yet. Be the first to add a note!
          </p>
        ) : (
          notes?.map((note) => (
            <div
              key={note.id}
              className="border rounded-lg p-4 space-y-2 bg-white"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{note.title}</h3>
                  <div className="flex gap-2 text-sm text-gray-500">
                    <span>{format(new Date(note.createdAt), "PPp")}</span>
                    <span>•</span>
                    <span className="capitalize">{note.category}</span>
                    {note.isPrivate && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-600">Private</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      note.status === "active"
                        ? "bg-green-100 text-green-800"
                        : note.status === "archived"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {note.status}
                  </span>
                </div>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}