/**
 * @module PublicNavigation
 * @description Public navigation component for board of trustees dashboard
 */

import { Link, useLocation } from "wouter";
import { useTenantBranding } from "@/hooks/use-tenant-branding";

// Generic logo - tenant-specific logos come from branding.logo
const genericLogo = '/assets/es-white-on-purple-logo.png';

export default function PublicNavigation() {
  const [location] = useLocation();
  const branding = useTenantBranding();

  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <img
                className="block h-10 w-auto"
                src={branding.logo || genericLogo}
                alt={branding.name}
              />
              <div className="ml-4 flex flex-col">
                <h1 className="text-lg font-semibold text-foreground">
                  {branding.name}
                </h1>
                <h2 className="text-sm text-muted-foreground">
                  {branding.id === 'test' ? 'Public Dashboard' : 'Board of Trustees Dashboard'}
                </h2>
              </div>
            </div>
            <nav className="ml-10 flex items-center space-x-4">
              <Link href="/public-dashboard">
                <a
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location === "/public-dashboard"
                      ? "bg-gray-100 text-[#00267A]"
                      : "text-muted-foreground hover:text-foreground hover:bg-background"
                  }`}
                >
                  Regulations
                </a>
              </Link>
            </nav>
          </div>
          {/* Board Portal link removed - tenant-specific links should come from config */}
        </div>
      </div>
    </header>
  );
}