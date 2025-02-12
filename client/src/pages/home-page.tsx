import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/navigation";
import ComplianceOverview from "@/components/dashboard/compliance-overview";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Welcome, {user?.username}
          </h1>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <ComplianceOverview />
            <UpcomingDeadlines />
          </div>
        </div>
      </main>
    </div>
  );
}
