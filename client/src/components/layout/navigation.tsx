/**
 * @module Navigation
 * @description Main navigation component providing routing and user management controls
 * Note: System Logs route (/admin/logs) is available but hidden from navigation.
 * Can be re-enabled by uncommenting the logs entry in the links array below.
 */

import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Loader2,
  User,
  Settings,

} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useLegacyBranding } from "@/hooks/use-branding";

// TUF component removed - deprecated system

// Import fallback logo
import genericLogo from "@/assets/generic-logo.svg";

/**
 * @component Navigation
 * @description Main navigation component with role-based access control
 * @returns {JSX.Element} The rendered navigation bar
 * 
 * @example
 * ```tsx
 * <Navigation />
 * ```
 */
export default function Navigation() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const branding = useLegacyBranding();
  
  // Tenant detection for AWS management visibility
  const [currentTenant, setCurrentTenant] = useState<string | null>(null);
  
  useEffect(() => {
    const hostname = window.location.hostname;
    
    if (hostname.startsWith('admin.')) {
      setCurrentTenant('admin');
    } else if (hostname.startsWith('moravian.')) {
      setCurrentTenant('moravian');
    } else if (hostname.startsWith('template.')) {
      setCurrentTenant('template');
    } else if (hostname.startsWith('staging.')) {
      setCurrentTenant('staging');
    } else {
      // Default to admin for edsteward.ai or localhost
      setCurrentTenant('admin');
    }
  }, []);

  // Note: Document title is now managed by the useBranding hook
  // No longer needed here as the hook handles title updates

  useQuery({
    queryKey: ["/api/setup/status"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/setup/status");
    },
  });

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ...(user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "compliance_officer"
      ? [
        { href: "/regulations/updates", label: "Regulation Updates", icon: FileText },
      ]
      : []),
    ...(user?.role?.toLowerCase() === "admin"
      ? [
        // Admin Dashboard - DISABLED
        // ...(currentTenant === 'admin' 
        //   ? [{ href: "/admin/dashboard", label: "Admin Dashboard", icon: LayoutDashboard }]
        //   : []
        // ),
        { href: "/admin/settings", label: "System Settings", icon: Settings },
        // AWS Tenant Management - DISABLED
        // ...(currentTenant === 'admin' 
        //   ? [{ href: "/admin/aws-tenant-management", label: "AWS Tenant Management", icon: Server }]
        //   : []
        // ),
        // System Logs route is available at /admin/logs but hidden from navigation
        // Uncomment the following line to show it in the navigation:
        // { href: "/admin/logs", label: "System Logs", icon: FileText }
      ]
      : []),
  ];

  return (
    <nav className="shadow" style={{ backgroundColor: branding.primaryColor }}>
      <div className="max-w-[95%] xl:max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Navigation Links */}
          <div className="flex items-center min-w-0">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center">
                <Link href="/">
                  <button className="flex-shrink-0 flex items-center">
                    <img
                      className="h-8 w-auto"
                      src={branding.logo}
                      alt={`${branding.name} Logo`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.warn('Logo failed to load:', branding.logo, 'Falling back to generic logo');
                        // Only fallback if we haven't already fallen back
                        if (target.src !== genericLogo) {
                          target.src = genericLogo;
                        }
                      }}
                      onLoad={() => {
                        console.log('🖼️  NAVIGATION: Logo loaded successfully:', branding.logo);
                        console.log('🖼️  NAVIGATION: Full branding object:', branding);
                      }}
                    />

                    <span className="text-xl font-bold text-white hover:text-gray-200 transition-colors ml-3">
                      Compliance Portal
                    </span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden sm:flex sm:ml-6 overflow-x-auto">
              <div className="flex space-x-2">
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive = location === link.href;
                  return (
                    <Link key={link.href} href={link.href}>
                      <Button
                        variant="ghost"
                        className={`${isActive
                          ? "text-white border-b-2 border-white"
                          : "text-gray-300 hover:text-white hover:border-b-2 hover:border-gray-300"
                          } flex items-center space-x-2 rounded-none px-2 h-16 whitespace-nowrap`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Security Status and User Menu */}
          <div className="flex items-center flex-shrink-0 gap-3">
            {/* TUF Status removed - deprecated system */}
{/* <WebSocketStatus /> */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-gray-300 hover:text-white flex items-center space-x-2"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:block truncate max-w-[120px]">
                    {user?.username}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/account/settings">
                  <DropdownMenuItem className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  {logoutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Logging out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}