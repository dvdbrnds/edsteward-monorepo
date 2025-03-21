import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RoadmapItem {
  title: string;
  isCompleted: boolean;
  children?: RoadmapItem[];
}

export default function SecretRoadmapPage() {
  console.log('[SecretRoadmapPage] Component mounting');
  const [roadmapData, setRoadmapData] = useState<RoadmapItem[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    console.log('[SecretRoadmapPage] Running useEffect for data initialization');
    parseRoadmapData();
  }, []);

  // Mark items that are completed 
  const parseRoadmapData = () => {
    console.log('[SecretRoadmapPage] Parsing roadmap data');
    const completedPhases = [
      "Core Infrastructure",
      "User Management & Content",
      "Regulation Management",
      "Notes & Evidence System"
    ];

    const inProgressPhases = [
      "Testing & Documentation"
    ];

    const phases = [
      {
        title: "Phase 1: Core Infrastructure",
        isCompleted: true,
        children: [
          { title: "TypeScript and React frontend with Vite", isCompleted: true },
          { title: "PostgreSQL database with ETL capabilities", isCompleted: true },
          { title: "Authentication system with role-based access", isCompleted: true },
          { title: "Compliance tracking interface", isCompleted: true },
          { title: "Responsive design with Moravian branding", isCompleted: true },
          { title: "Basic deployment setup", isCompleted: true }
        ]
      },
      {
        title: "Phase 2: User Management & Content",
        isCompleted: true,
        children: [
          { title: "User management with password reset", isCompleted: true },
          { title: "Commenting system implementation", isCompleted: true },
          { title: "Evidence files management system", isCompleted: true },
          { title: "File upload and storage system", isCompleted: true },
          { title: "Image and PDF preview support", isCompleted: true },
          { title: "Enhanced error handling and feedback", isCompleted: true }
        ]
      },
      {
        title: "Phase 3: Regulation Management",
        isCompleted: true,
        children: [
          { title: "Enhanced regulation list interface", isCompleted: true },
          { title: "Optimized column layout", isCompleted: true },
          { title: "ID number search functionality", isCompleted: true },
          { title: "Multi-jurisdiction regulation support", isCompleted: true },
          { title: "Automated regulation data collection", isCompleted: true }
        ]
      },
      {
        title: "Phase 4: Notes & Evidence System",
        isCompleted: true,
        children: [
          { title: "Comprehensive notes management", isCompleted: true },
          { title: "Evidence file upload with preview", isCompleted: true },
          { title: "Private/public note visibility", isCompleted: true },
          { title: "Notes linking to regulations", isCompleted: true }
        ]
      },
      {
        title: "Phase 5: Testing & Documentation",
        isCompleted: false,
        children: [
          { title: "Backend Unit Tests", isCompleted: false },
          { title: "Frontend Unit Tests", isCompleted: false },
          { title: "API Integration Tests", isCompleted: false },
          { title: "Documentation Enhancement", isCompleted: false }
        ]
      },
      {
        title: "Phase 6: AI Integration",
        isCompleted: false,
        children: [
          { title: "AI-driven regulation data collection", isCompleted: false },
          { title: "Automated compliance analysis", isCompleted: false },
          { title: "Smart document comparison", isCompleted: false },
          { title: "Regulatory change detection", isCompleted: false },
          { title: "Model Context Protocol (MCP)", isCompleted: false }
        ]
      },
      {
        title: "Phase 7: Enhanced Monitoring",
        isCompleted: false,
        children: [
          { title: "Performance monitoring dashboard", isCompleted: false },
          { title: "Error reporting system", isCompleted: false },
          { title: "Automated health checks", isCompleted: false },
          { title: "Load testing infrastructure", isCompleted: false }
        ]
      }
    ];

    setRoadmapData(phases);

    // Calculate overall progress
    const totalItems = phases.reduce((acc, phase) => acc + (phase.children?.length || 0), 0);
    const completedItems = phases.reduce((acc, phase) => 
      acc + (phase.children?.filter(item => item.isCompleted)?.length || 0), 0
    );
    setProgress((completedItems / totalItems) * 100);
  };

  const RoadmapItem = ({ item }: { item: RoadmapItem }) => (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox checked={item.isCompleted} disabled />
        <span className={`${item.isCompleted ? 'text-green-600 font-medium' : ''}`}>
          {item.title}
        </span>
      </div>
      {item.children && (
        <div className="pl-6 space-y-2">
          {item.children.map((child, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <Checkbox checked={child.isCompleted} disabled />
              <span className={`${child.isCompleted ? 'text-green-600' : ''}`}>
                {child.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-[#002147]">
            Moravian Compliance Platform Progress
          </CardTitle>
          <div className="flex flex-col items-center gap-2 mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Overall Progress: {Math.round(progress)}%
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6">
              {roadmapData.map((phase, idx) => (
                <RoadmapItem key={idx} item={phase} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}