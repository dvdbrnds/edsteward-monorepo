/**
 * Executive Dashboard Page
 * Analytics overview for leadership and CFOs
 */

import Navigation from '@/components/layout/navigation';
import ExecutiveDashboard from '@/components/dashboard/executive-dashboard';

export default function ExecutiveDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ExecutiveDashboard />
        </div>
      </main>
    </div>
  );
}



