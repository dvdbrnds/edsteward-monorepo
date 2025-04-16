/**
 * @module PublicNavigation
 * @description Public navigation component for board of trustees dashboard
 */

import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

// Import the logo using relative path from client's perspective
import moravianLogo from "@/assets/Screenshot_2025-02-12_at_9.15.57_AM-removebg-preview.png";

export default function PublicNavigation() {
  const [location] = useLocation();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <img
                className="block h-10 w-auto"
                src={moravianLogo}
                alt="Moravian University"
              />
              <div className="ml-4 flex flex-col">
                <h1 className="text-lg font-semibold text-gray-900">
                  Moravian University
                </h1>
                <h2 className="text-sm text-gray-600">
                  Board of Trustees Dashboard
                </h2>
              </div>
            </div>
            <nav className="ml-10 flex items-center space-x-4">
              <Link href="/public-dashboard">
                <a
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location === "/public-dashboard"
                      ? "bg-gray-100 text-[#00267A]"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Regulations
                </a>
              </Link>
            </nav>
          </div>
          <div className="flex items-center">
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://www.moravian.edu/board-of-trustees" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <FileText className="h-4 w-4 mr-2" />
                Board Portal
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}