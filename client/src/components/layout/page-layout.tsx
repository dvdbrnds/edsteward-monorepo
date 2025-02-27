import { BugReportButton } from "@/components/common/bug-report-button";

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-4 right-4 z-50">
        <BugReportButton />
      </div>
      {children}
    </div>
  );
}
