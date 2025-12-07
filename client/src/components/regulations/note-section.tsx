import React, { useState, useEffect, useCallback } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Eye, History } from "lucide-react";
// import { apiRequest } from "@/lib/queryClient"; // Unused - using direct fetch with credentials
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const NOTE_CATEGORIES = ["general", "compliance", "legal", "technical", "administrative", "deadline", "evidence", "review"] as const;

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.enum(NOTE_CATEGORIES).default("general"),
});

type FormValues = z.infer<typeof formSchema>;

interface NoteSectionProps {
  regulationId: string;
  initialData?: Partial<FormValues> & { id?: string };
}

interface User {
  id: number;
  role: string;
  roles?: string;
}

export function NoteSection({ regulationId, initialData }: NoteSectionProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [viewingNote, setViewingNote] = useState<any | null>(null);
  const [viewingHistory, setViewingHistory] = useState<any | null>(null);
  const [noteHistory, setNoteHistory] = useState<any[]>([]);

  // Check if user can edit/delete a note
  const canModifyNote = (note: any) => {
    if (!user) return false;
    const isAdmin = user.role === 'admin' || (user.roles && JSON.parse(user.roles).includes('admin'));
    const isCreator = note.userId === user.id;
    return isAdmin || isCreator;
  };

  // Use form hook
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      category: (initialData as any)?.category || "general",
    },
  });

  const fetchNotes = useCallback(async () => {
    const updatedResponse = await fetch(`/api/notes/regulation/${regulationId}`, {
      credentials: 'include'
    });
    if (updatedResponse.ok) {
      const updatedData = await updatedResponse.json();
      setNotes(updatedData);
    }
  }, [regulationId]);

  const deleteNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Note deleted successfully",
        });
        fetchNotes(); // Refresh notes list
      } else {
        throw new Error('Failed to delete note');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  };

  const startEditNote = (note: any) => {
    setEditingNote(note);
    form.reset({
      title: note.title,
      content: note.content,
      category: note.category || "general",
    });
  };

  const cancelEdit = () => {
    setEditingNote(null);
    form.reset({
      title: "",
      content: "",
      category: "general",
    });
  };

  const viewNoteHistory = async (note: any) => {
    try {
      const response = await fetch(`/api/notes/${note.id}/history`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const history = await response.json();
        setNoteHistory(history);
        setViewingHistory(note);
      } else {
        toast({
          title: "Error",
          description: "Failed to load note history",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load note history",
        variant: "destructive",
      });
    }
  };

  // Fetch notes when component loads
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);

      const endpoint = editingNote?.id
        ? `/api/notes/${editingNote.id}`
        : "/api/notes";

      const method = editingNote?.id ? "PUT" : "POST";

      const payload = {
        ...data,
        regulationId: parseInt(regulationId),
        status: "active", // Required by database schema
        isPrivate: false, // All notes are public by design
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Required for authentication cookies
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

      // Reset form and editing state
      form.reset({
        title: "",
        content: "",
        category: "general",
      });
      setEditingNote(null);

      toast({
        title: "Success",
        description: editingNote
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
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {NOTE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (editingNote ? "Update Note" : "Save Note")}
            </Button>
            {editingNote && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>

      {/* Display existing notes */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">Notes ({notes.length})</h3>
        {notes.length === 0 ? (
          <div className="text-center py-6 px-4 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-dashed border-gray-200">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-50 flex items-center justify-center">
              <Edit className="h-6 w-6 text-purple-400" />
            </div>
            <p className="font-medium text-gray-700">No notes yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add notes above to document compliance activities
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{note.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {note.category?.charAt(0).toUpperCase() + note.category?.slice(1) || 'General'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingNote(note)}
                        className="h-8 w-8 p-0"
                        title="View note"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canModifyNote(note) && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditNote(note)}
                            className="h-8 w-8 p-0"
                            title="Edit note"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewNoteHistory(note)}
                            className="h-8 w-8 p-0"
                            title="View history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteNote(note.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Delete note"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {note.user && `By ${note.user.firstName} ${note.user.lastName} • `}
                    {note.createdAt && new Date(note.createdAt).toLocaleString()}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div
                    className="text-sm line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: note.content }}
                    onClick={() => setViewingNote(note)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Note viewing modal */}
      {viewingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{viewingNote.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {viewingNote.category?.charAt(0).toUpperCase() + viewingNote.category?.slice(1) || 'General'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    {viewingNote.user && `By ${viewingNote.user.firstName} ${viewingNote.user.lastName} • `}
                    {viewingNote.createdAt && new Date(viewingNote.createdAt).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setViewingNote(null)}
                  className="h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: viewingNote.content }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Note history modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Note History: {viewingHistory.title}</CardTitle>
                  <div className="text-sm text-gray-500 mt-2">
                    {noteHistory.length} modification{noteHistory.length !== 1 ? 's' : ''} found
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setViewingHistory(null);
                    setNoteHistory([]);
                  }}
                  className="h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {noteHistory.length === 0 ? (
                <p className="text-gray-500">No modification history found for this note.</p>
              ) : (
                <div className="space-y-4">
                  {noteHistory.map((historyItem, index) => (
                    <Card key={historyItem.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {historyItem.action.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium">
                                {historyItem.user ? 
                                  `${historyItem.user.firstName} ${historyItem.user.lastName}` : 
                                  'Unknown User'
                                }
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(historyItem.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {/* Title changes */}
                          {historyItem.previousTitle !== historyItem.newTitle && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Title:</div>
                              <div className="text-sm">
                                <span className="bg-red-100 text-red-800 px-2 py-1 rounded line-through">
                                  {historyItem.previousTitle || '(empty)'}
                                </span>
                                {' → '}
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {historyItem.newTitle || '(empty)'}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Category changes */}
                          {historyItem.previousCategory !== historyItem.newCategory && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Category:</div>
                              <div className="text-sm">
                                <span className="bg-red-100 text-red-800 px-2 py-1 rounded line-through">
                                  {historyItem.previousCategory || '(empty)'}
                                </span>
                                {' → '}
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {historyItem.newCategory || '(empty)'}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Content changes */}
                          {historyItem.previousContent !== historyItem.newContent && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Content:</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Previous:</div>
                                  <div 
                                    className="text-sm bg-red-50 border border-red-200 p-2 rounded max-h-32 overflow-y-auto"
                                    dangerouslySetInnerHTML={{ __html: historyItem.previousContent || '(empty)' }}
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">New:</div>
                                  <div 
                                    className="text-sm bg-green-50 border border-green-200 p-2 rounded max-h-32 overflow-y-auto"
                                    dangerouslySetInnerHTML={{ __html: historyItem.newContent || '(empty)' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}