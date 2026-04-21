import { useEffect, useState } from "react";
import AuthPage from "@/pages/auth-page";

const AdminAuthPage = AuthPage;

export default function TenantAwareAuth() {
  const [tenant, setTenant] = useState<string | null>(null);

  useEffect(() => {
    // Detect tenant from hostname
    const hostname = window.location.hostname;
    
    if (hostname.startsWith('admin.')) {
      setTenant('admin');
    } else if (hostname.startsWith('moravian.')) {
      setTenant('moravian');
    } else {
      // Default to admin for edsteward.ai or localhost
      setTenant('admin');
    }
  }, []);

  // Show loading while detecting tenant
  if (tenant === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Route to appropriate auth page based on tenant
  if (tenant === 'admin') {
    return <AdminAuthPage />;
  } else {
    return <AuthPage />;
  }
} 