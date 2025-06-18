// =========================================
// Regulatory Change Timeline Component
// For use in React/TypeScript projects
// =========================================

// Required dependencies in package.json:
// "@types/react": "^18.2.0",
// "date-fns": "^3.0.0",
// "framer-motion": "^11.0.0",
// "lucide-react": "^0.330.0",
// "@radix-ui/react-card": "^1.0.0"

// Setup Instructions:
// 1. Create a new React + TypeScript project
// 2. Install dependencies:
//    npm install date-fns framer-motion lucide-react @radix-ui/react-card
//    npm install --save-dev @types/react
//
// 3. If not using shadcn/ui, replace the Card components with your own styled div elements:
//    - Replace Card with: <div className="rounded-lg border bg-white shadow-sm">
//    - Replace CardHeader with: <div className="p-6">
//    - Replace CardContent with: <div className="p-6 pt-0">
//    - Replace CardTitle with: <h3 className="text-lg font-semibold">
//
// 4. Required Tailwind CSS classes (if using Tailwind):
//    Add these to your tailwind.config.js:
//    ```js
//    module.exports = {
//      content: ["./src/**/*.{js,jsx,ts,tsx}"],
//      theme: {
//        extend: {
//          colors: {
//            border: "hsl(var(--border))",
//            background: "hsl(var(--background))",
//            foreground: "hsl(var(--foreground))",
//            card: "hsl(var(--card))",
//            "muted-foreground": "hsl(var(--muted-foreground))"
//          }
//        }
//      }
//    };
//    ```
//
// 5. If not using Tailwind, add these CSS classes and variables:
//    ```css
//    :root {
//      --border: 220 13% 91%;
//      --background: 0 0% 100%;
//      --foreground: 224 71.4% 4.1%;
//      --card: 0 0% 100%;
//      --muted-foreground: 220 8.9% 46.1%;
//    }
//    
//    .bg-background { background-color: white; }
//    .bg-card { background-color: white; }
//    .text-muted-foreground { color: #666; }
//    .border { border: 1px solid #e5e7eb; }
//    .border-2 { border-width: 2px; }
//    .rounded-lg { border-radius: 0.5rem; }
//    .space-y-8 > * + * { margin-top: 2rem; }
//    .relative { position: relative; }
//    .absolute { position: absolute; }
//    .p-4 { padding: 1rem; }
//    .mt-2 { margin-top: 0.5rem; }
//    .mb-2 { margin-bottom: 0.5rem; }
//    .text-sm { font-size: 0.875rem; }
//    .font-medium { font-weight: 500; }
//    ```

// Types
interface Regulation {
  originationDate?: string | null;
  effectiveDate?: string | null;
  lastUpdated?: string | null;
  nextReviewDate?: string | null;
  changeSummary?: string | null;
}

interface TimelineEvent {
  date: Date;
  title: string;
  description: string;
  type: "origin" | "effective" | "update" | "upcoming";
  icon: JSX.Element;
}

// Component
import { FC, useMemo } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { History, AlertCircle, CheckCircle, Clock } from "lucide-react";

// If you're not using shadcn/ui, replace these with your own styled components
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface RegulationTimelineProps {
  regulation: Regulation;
}

export const RegulationTimeline: FC<RegulationTimelineProps> = ({ regulation }) => {
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    if (regulation.originationDate) {
      events.push({
        date: new Date(regulation.originationDate),
        title: "Regulation Originated",
        description: "Initial publication of the regulation",
        type: "origin",
        icon: <History className="h-5 w-5 text-blue-500" />
      });
    }

    if (regulation.effectiveDate) {
      events.push({
        date: new Date(regulation.effectiveDate),
        title: "Regulation Effective",
        description: "Regulation became effective",
        type: "effective",
        icon: <CheckCircle className="h-5 w-5 text-green-500" />
      });
    }

    if (regulation.lastUpdated) {
      events.push({
        date: new Date(regulation.lastUpdated),
        title: "Last Updated",
        description: regulation.changeSummary || "Regulation was updated",
        type: "update",
        icon: <History className="h-5 w-5 text-purple-500" />
      });
    }

    if (regulation.nextReviewDate) {
      events.push({
        date: new Date(regulation.nextReviewDate),
        title: "Next Review Due",
        description: "Scheduled review date",
        type: "upcoming",
        icon: <Clock className="h-5 w-5 text-orange-500" />
      });
    }

    // Sort events by date
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [regulation]);

  if (timelineEvents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Regulation Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          {/* Timeline events */}
          <div className="space-y-8">
            {timelineEvents.map((event, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.2 }}
                className="relative"
              >
                {/* Timeline dot */}
                <div className="absolute -left-8 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2">
                  {event.icon}
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-2 font-medium">{event.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(event.date, "PPP")}
                  </div>
                  <div className="mt-2 text-sm">
                    {event.description}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Usage example:
// import { RegulationTimeline } from './RegulationTimeline';
// 
// function RegulationDetailPage() {
//   const regulation = {
//     originationDate: "2024-01-01",
//     effectiveDate: "2024-02-01",
//     lastUpdated: "2024-03-01",
//     nextReviewDate: "2024-12-01",
//     changeSummary: "Updated compliance requirements"
//   };
//
//   return (
//     <div>
//       <h1>Regulation Details</h1>
//       <RegulationTimeline regulation={regulation} />
//     </div>
//   );
// }