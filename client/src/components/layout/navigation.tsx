/**
 * @module Navigation
 * @description Main navigation component providing routing and user management controls
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
    version: "0.2.5",
    date: "March 4, 2025",
    changes: [
      "Added CSV export functionality to system logs for administrators",
      "Enhanced system logs display with improved column formatting",
      "Added IP address and user agent tracking to log entries",
      "Improved log entry readability with color-coded severity levels",
      "Replaced deprecated comments section with comprehensive diary functionality",
      "Added structured diary entries for better compliance tracking",
      "Implemented automated diary entry timestamps and user attribution"
    ],
  },
  {
    version: "0.2.4",
    date: "February 27, 2025",
    changes: [
      "Added comprehensive JSDoc documentation to core UI components",
      "Enhanced developer experience with detailed component documentation",
      "Improved code maintainability with standardized documentation format",
      "Added accessibility and compliance documentation to UI components",
      "Included usage examples in component documentation"
    ],
  },
  {
    version: "0.2.3",
    date: "February 27, 2025",
    changes: [
      "Enhanced user management in admin settings",
      "Added password reset functionality for existing users",
      "Improved user editing interface with better validation",
      "Added secure password management for admin users",
      "Fixed version number dialog to work correctly from all pages",
      "Enhanced admin section visibility with purple highlighting",
    ],
  },
  {
    version: "0.2.2",
    date: "February 24, 2025",
    changes: [
      "Added interactive health score dashboard with collapsible category details",
      "Implemented dynamic circular progress indicators for compliance scores",
      "Enhanced category breakdown visualization with expandable insights",
      "Improved overall compliance health score calculation"
    ],
  },
  {
    version: "0.2.1",
    date: "February 24, 2025",
    changes: [
      "Added jurisdiction filtering for federal and state regulations",
      "Implemented sortable columns in regulations table",
      "Fixed user registration workflow with proper email field validation",
      "Enhanced table UI with sort indicators and improved column headers"
    ],
  },
  {
    version: "0.2.0",
    date: "February 21, 2025",
    changes: [
      "Added comprehensive submission guidelines system with markdown support",
      "Enhanced compliance wizard with category-specific requirements",
      "Added regulation-specific notification override for admins",
      "Improved deadline tracking and status visualization",
      "Enhanced regulation detail page with better document organization",
    ],
  },
  {
    version: "0.1.9",
    date: "February 21, 2025",
    changes: [
      "Updated pie chart colors to use 9 distinct colors from different parts of the color wheel",
      "Unified Student Services category colors",
      "Improved color consistency across compliance overview and regulations page",
    ],
  },
  {
    version: "0.1.8",
    date: "February 20, 2025",
    changes: [
      "Updated setup wizard to focus on compliance offices instead of individual officers",
      "Added support for department distribution lists in compliance assignments",
      "Improved setup wizard UX with suggested email distribution lists",
      "Enhanced setup flow with better admin existence detection",
    ],
  },
  {
    version: "0.1.7",
    date: "February 20, 2025",
    changes: [
      "Moved notification controls to Admin Settings for centralized management",
      "Added Recent Notifications card to dashboard",
      "Improved notification management workflow for compliance officers",
    ],
  },
  {
    version: "0.1.6",
    date: "February 18, 2025",
    changes: [
      "Improved regulation title display in Upcoming Deadlines",
      "Added combined view of regulation IDs and topics for better clarity",
    ],
  },
  {
    version: "0.1.5",
    date: "February 18, 2025",
    changes: [
      "Fixed agency name display in upcoming deadlines dropdown",
      "Improved agency URL mapping and display consistency",
    ],
  },
  {
    version: "0.1.4",
    date: "February 18, 2025",
    changes: [
      "Added in-platform submission guide feature",
      "Integrated guide system with markdown support",
      "Fixed external URL dependencies",
    ],
  },
  {
    version: "0.1.3",
    date: "February 18, 2025",
    changes: [
      "Fixed HTML formatting in regulation summaries",
      "Improved readability of regulation details",
    ],
  },
  {
    version: "0.1.2",
    date: "February 18, 2025",
    changes: [
      "Fixed regulation detail page navigation",
      "Improved route parameter handling",
      "Added comprehensive logging for debugging",
    ],
  },
  {
    version: "0.1.1",
    date: "February 18, 2025",
    changes: [
      "Fixed legend formatting in reports page pie charts",
      "Added changelog tracking system",
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
      "Responsive design implementation",
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
    ...(user?.role === "admin"
      ? [
          { href: "/admin/settings", label: "Admin Settings", icon: Settings },
          { href: "/admin/logs", label: "System Logs", icon: FileText }
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
                      Alpha v0.2.5
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