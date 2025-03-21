import { useEffect, useState } from 'react';
import { marked } from 'marked';

export default function RoadmapPage() {
  const [roadmapContent, setRoadmapContent] = useState('');

  useEffect(() => {
    fetch('/ROADMAP.md')
      .then(response => response.text())
      .then(text => {
        setRoadmapContent(marked.parse(text));
      })
      .catch(error => {
        console.error('Error loading roadmap:', error);
      });
  }, []);

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
