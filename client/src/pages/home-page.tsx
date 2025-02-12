import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/navigation";
import ComplianceOverview from "@/components/dashboard/compliance-overview";
import UpcomingDeadlines from "@/components/dashboard/upcoming-deadlines";
import RegulationList from "@/components/regulations/regulation-list";
import { useState } from "react";

export default function HomePage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#002147] mb-8">
            Welcome, {user?.username}
          </h1>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            <ComplianceOverview 
              onCategorySelect={setSelectedCategory}
              selectedCategory={selectedCategory}
            />
            <UpcomingDeadlines 
              categoryFilter={selectedCategory}
            />
          </div>

          {selectedCategory && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {selectedCategory} Regulations
              </h2>
              <RegulationList categoryFilter={selectedCategory} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}