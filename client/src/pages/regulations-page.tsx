import React from "react";
import { useLocation } from "wouter";

export default function RegulationsPage() {
  const [location, navigate] = useLocation();

  // This page has been decommissioned in favor of the superior dashboard
  // Redirect users to the main dashboard
  React.useEffect(() => {
    navigate("/");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Redirecting to Dashboard</h2>
        <p className="text-muted-foreground">The regulations page has been integrated into the main dashboard for a better experience.</p>
      </div>
    </div>
  );
}