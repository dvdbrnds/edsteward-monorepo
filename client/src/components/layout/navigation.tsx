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
import { useState } from "react";
import {
  LayoutDashboard,
  Book,
  Bell,
  FileText,
  LogOut,
  Loader2,
  User,
  Settings,
  Cog,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

// Import the logo using relative path from client's perspective
import moravianLogo from "@/assets/Screenshot_2025-02-12_at_9.15.57_AM-removebg-preview.png";

/**
 * @constant CHANGELOG
 * @description Version history and feature changelog for the application
 * @type {Array<{version: string, date: string, changes: string[]}>}
 */
const CHANGELOG = [
  {
    version: "0.3.2",
    date: "March 21, 2025",
    changes: [
      "Added regulation timeline visualization for tracking regulation history",
      "Implemented evidence file preview functionality",
      "Enhanced regulation detail page with historical version tracking",
      "Improved user interface for compliance status indicators",
      "Fixed various display issues in timeline components"
    ],
  },
  {
    version: "0.3.1",
    date: "March 15, 2025",
    changes: [
      "Fixed regulation detail page cards missing due to component version mismatch",
      "Consolidated regulation detail components into single source",
      "Restored complete set of information cards including Agency Information and Timeline",
      "Enhanced card layout and organization for better readability"
    ],
  },
  {
    version: "0.3.0",
    date: "March 15, 2025",
    changes: [
      "Redesigned regulations list for improved readability",
      "Added Directly Responsible Office (DRO) column",
      "Optimized column ordering for better user experience",
      "Enhanced ID number search functionality",
      "Improved status visualization with streamlined layout"
    ],
  },
  {
    version: "0.2.9",
    date: "March 15, 2025",
    changes: [
      "Enhanced action icons with improved color psychology",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.8",
    date: "March 14, 2025",
    changes: [
      "Added hover preview functionality for evidence files",
      "Enhanced evidence files display with uploader information",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.7",
    date: "March 12, 2025",
    changes: [
      "Enhanced PA regulation collector with improved error handling",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.6",
    date: "March 12, 2025",
    changes: [
      "Added dedicated endpoint for updating regulation categories",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.5",
    date: "March 4, 2025",
    changes: [
      "Added CSV export functionality to system logs",
      "Enhanced system logs display with improved formatting",
      "Replaced comments with comprehensive diary functionality",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.4",
    date: "February 27, 2025",
    changes: [
      "Added comprehensive JSDoc documentation",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.3",
    date: "February 27, 2025",
    changes: [
      "Enhanced user management in admin settings",
      "Added password reset functionality",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.2",
    date: "February 24, 2025",
    changes: [
      "Added interactive health score dashboard",
      "Implemented dynamic circular progress indicators",
      "Enhanced category breakdown visualization"
    ],
  },
  {
    version: "0.2.1",
    date: "February 24, 2025",
    changes: [
      "Added jurisdiction filtering for regulations",
      "Implemented sortable columns in regulations table",
      "Bug Fixes"
    ],
  },
  {
    version: "0.2.0",
    date: "February 21, 2025",
    changes: [
      "Added comprehensive submission guidelines system",
      "Enhanced compliance wizard with category requirements",
      "Added regulation-specific notification override",
      "Improved deadline tracking visualization"
    ],
  },
  {
    version: "0.1.9",
    date: "February 21, 2025",
    changes: [
      "Updated pie chart colors with distinct color scheme",
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.8",
    date: "February 20, 2025",
    changes: [
      "Updated setup wizard to focus on compliance offices",
      "Added support for department distribution lists",
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.7",
    date: "February 20, 2025",
    changes: [
      "Moved notification controls to Admin Settings",
      "Added Recent Notifications card to dashboard",
      "Enhanced notification management workflow"
    ],
  },
  {
    version: "0.1.6",
    date: "February 18, 2025",
    changes: [
      "Improved regulation title display in Upcoming Deadlines",
      "Added combined view of regulation IDs and topics"
    ],
  },
  {
    version: "0.1.5",
    date: "February 18, 2025",
    changes: [
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.4",
    date: "February 18, 2025",
    changes: [
      "Added in-platform submission guide feature",
      "Integrated guide system with markdown support",
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.3",
    date: "February 18, 2025",
    changes: [
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.2",
    date: "February 18, 2025",
    changes: [
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.1",
    date: "February 18, 2025",
    changes: [
      "Added changelog tracking system",
      "Bug Fixes"
    ],
  },
  {
    version: "0.1.0",
    date: "February 12, 2025",
    changes: [
      "Initial alpha release",
      "Core authentication system",
      "Basic compliance tracking",
      "Department-specific views",
      "Responsive design implementation"
    ],
  },
] as const;

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
  const [changelogOpen, setChangelogOpen] = useState(false);

  const { data: setupComplete } = useQuery({
    queryKey: ["/api/setup/status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/setup/status");
      return response.json();
    },
  });

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/regulations", label: "Regulations", icon: Book },
    ...(user?.role?.toLowerCase() === "admin"
      ? [
          { href: "/admin/settings", label: "System Settings", icon: Settings },
          { href: "/roadmap", label: "Development Roadmap", icon: FileText },
          // System Logs route is available at /admin/logs but hidden from navigation
          // Uncomment the following line to show it in the navigation:
          // { href: "/admin/logs", label: "System Logs", icon: FileText }
        ]
      : []),
  ];

  return (
    <nav className="bg-[#002147] shadow">
      <div className="max-w-[95%] xl:max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Navigation Links */}
          <div className="flex items-center min-w-0">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center">
                <Link href="/">
                  <button className="flex items-center focus:outline-none">
                    <img
                      src={moravianLogo}
                      alt="Moravian University Logo"
                      className="h-8 hover:opacity-80 transition-opacity"
                    />
                    <span className="text-xl font-bold text-white hover:text-gray-200 transition-colors ml-3">
                      Compliance Portal
                    </span>
                  </button>
                </Link>
                <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
                  <DialogTrigger asChild>
                    <button
                      className="text-xs text-gray-300 ml-2 hover:text-white transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setChangelogOpen(true);
                      }}
                    >
                      Alpha v0.3.2
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Changelog</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pr-2">
                      {CHANGELOG.map((release) => (
                        <div key={release.version} className="pb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2 sticky top-0 bg-background pt-2">
                            v{release.version}
                            <span className="text-sm font-normal text-gray-500">
                              {release.date}
                            </span>
                          </h3>
                          <ul className="mt-2 list-disc list-inside space-y-1">
                            {release.changes.map((change, idx) => (
                              <li key={idx} className="text-sm text-gray-600 pl-2">
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
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
                        className={`${
                          isActive
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

          {/* User Menu Dropdown */}
          <div className="flex items-center flex-shrink-0">
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
                <DropdownMenuItem disabled className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                  <span className="ml-auto text-xs text-muted-foreground">(Coming Soon)</span>
                </DropdownMenuItem>
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