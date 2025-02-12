import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RegulationDetailPage() {
  const { id } = useParams();
  const [_, navigate] = useLocation();

  const { data: regulations, isLoading } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  if (isLoading || !regulations) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            Loading...
          </div>
        </main>
      </div>
    );
  }

  const regulation = regulations.find(r => r.id === parseInt(id || '', 10));

  if (!regulation) {
    navigate('/regulations');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/regulations')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Regulations
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              {regulation.topic}
            </h1>
            <p className="text-gray-500 mt-2">ID: {regulation.itemId}</p>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Category</dt>
                    <dd className="mt-1 text-sm text-gray-900">{regulation.category}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Statute</dt>
                    <dd className="mt-1 text-sm text-gray-900">{regulation.statute}</dd>
                  </div>
                  {regulation.statuteIds && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Statute IDs</dt>
                      <dd className="mt-1 text-sm text-gray-900">{regulation.statuteIds}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {regulation.lastUpdated ? new Date(regulation.lastUpdated).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">
                  {regulation.requirements || 'No requirements specified'}
                </p>
                {regulation.regulationUrl && (
                  <a
                    href={regulation.regulationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 mt-4 inline-block"
                  >
                    View Official Documentation
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}