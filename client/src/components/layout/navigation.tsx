import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Book,
  Bell,
  FileText,
  LogOut,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Import the logo using relative path from client's perspective
import moravianLogo from "../../assets/Screenshot_2025-02-12_at_9.15.57_AM-removebg-preview.png";

const CHANGELOG = [
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
];

export default function Navigation() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/regulations", label: "Regulations", icon: Book },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <nav className="bg-[#002147] shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Navigation Links */}
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <img 
                src={moravianLogo}
                alt="Moravian University Logo" 
                className="h-8"
              />
              <div className="ml-3">
                <span className="text-xl font-bold text-white">
                  Compliance Portal
                </span>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="text-xs text-gray-300 ml-2 hover:text-white transition-colors">
                      Alpha v0.1.1
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Changelog</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      {CHANGELOG.map((release) => (
                        <div key={release.version}>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            v{release.version}
                            <span className="text-sm font-normal text-gray-500">
                              {release.date}
                            </span>
                          </h3>
                          <ul className="mt-2 list-disc list-inside space-y-1">
                            {release.changes.map((change, idx) => (
                              <li key={idx} className="text-sm text-gray-600">
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
            <div className="hidden sm:flex sm:space-x-4">
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
                      } flex items-center space-x-2 rounded-none px-1 h-16`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{link.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300 hidden sm:block">
              {user?.username}
            </span>
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-gray-300 hover:text-white flex items-center space-x-2"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}