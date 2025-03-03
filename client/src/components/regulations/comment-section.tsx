import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCommentSchema, type Comment } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CommentWithUser extends Comment {
  user?: {
    id: number;
    name: string;
    username: string;
  } | null;
}

interface CommentSectionProps {
  regulationId: number;
}

export default function CommentSection({ regulationId }: CommentSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/comments", regulationId],
    queryFn: async () => {
      const response = await fetch(`/api/comments/${regulationId}`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
  });

  const form = useForm({
    resolver: zodResolver(insertCommentSchema),
    defaultValues: {
      content: "",
      regulationId,
      parentId: null,
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user) {
        throw new Error("Must be logged in to comment");
      }
      return apiRequest("POST", "/api/comments", {
        ...data,
        userId: user.id,
        regulationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comments", regulationId] });
      form.reset();
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      return apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comments", regulationId] });
      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
      </div>
    );
  }

  const onSubmit = (data: any) => {
    createCommentMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {user && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add a comment..."
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
              disabled={createCommentMutation.isPending}
              className="w-full sm:w-auto"
            >
              {createCommentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Comment"
              )}
            </Button>
          </form>
        </Form>
      )}

      <div className="space-y-4">
        {!comments || comments.length === 0 ? (
          <p className="text-center text-gray-500 italic">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="border rounded-lg p-4 space-y-2 bg-white"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {comment.user?.name || 'Anonymous'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(comment.createdAt), "PPp")}
                  </p>
                </div>
                {(user?.role === "admin" || user?.id === comment.userId) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}