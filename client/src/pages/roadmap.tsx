import { useEffect, useState } from 'react';
import { marked } from 'marked';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

export default function RoadmapPage() {
  const { user } = useAuth();
  const [roadmapContent, setRoadmapContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-admin users
  if (!user?.role === 'admin') {
    return <Redirect to="/" />;
  }

  useEffect(() => {
    fetch('/api/roadmap')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load roadmap');
        }
        return response.text();
      })
      .then(text => {
        const parsed = marked.parse(text);
        setRoadmapContent(parsed);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading roadmap:', error);
        setError('Failed to load the roadmap content. Please try again later.');
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Development Roadmap</h1>
      <div 
        className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none"
        dangerouslySetInnerHTML={{ __html: roadmapContent }}
      />
    </div>
  );
}