import { TaskAnalyticsDashboard } from '@/components/regulations/task-analytics-dashboard';
import { BarChart3 } from 'lucide-react';

export default function TaskAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Compliance Task Analytics
          </h1>
        </div>
        <p className="text-gray-600">
          Monitor task completion rates, identify bottlenecks, and track compliance progress across all regulations.
        </p>
      </div>

      <TaskAnalyticsDashboard />
    </div>
  );
}

