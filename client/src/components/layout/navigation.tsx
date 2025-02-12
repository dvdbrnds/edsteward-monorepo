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
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              {/* Moravian University Logo - Using SVG for vector scaling */}
              <svg width="40" height="40" viewBox="0 0 512 512" className="text-white">
                <path
                  fill="currentColor"
                  d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 464c-114.7 0-208-93.31-208-208S141.3 48 256 48s208 93.31 208 208S370.7 464 256 464z"
                />
                <path
                  fill="currentColor"
                  d="M256 128c-70.69 0-128 57.31-128 128s57.31 128 128 128s128-57.31 128-128S326.7 128 256 128zM256 336c-44.13 0-80-35.88-80-80s35.88-80 80-80s80 35.88 80 80S300.1 336 256 336z"
                />
              </svg>
              <span className="ml-3 text-xl font-bold text-white">
                Moravian Compliance
              </span>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <a
                      className={`${
                        location === link.href
                          ? "border-white text-white"
                          : "border-transparent text-gray-300 hover:border-gray-300 hover:text-white"
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {link.label}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-white hover:text-gray-300"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}