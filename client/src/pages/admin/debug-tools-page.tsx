import React from 'react';
import Navigation from "@/components/layout/navigation";
import DebugTools from "@/components/debug-tools";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function DebugToolsPage() {
  const { user } = useAuth();

  // Only allow admin access
  if (!user || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <DebugTools />
        </div>
      </main>
    </div>
  );
}
