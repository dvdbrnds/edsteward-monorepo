import { FC, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { type Regulation } from "@shared/schema";
import { motion } from "framer-motion";

interface RegulationTimelineProps {
  regulation: Regulation;
}

export const RegulationTimeline: FC<RegulationTimelineProps> = ({ regulation }) => {
  const timelineEvents = useMemo(() => {
    const events = [];

    // Add origination date if available
    if (regulation.originationDate) {
      events.push({
        date: new Date(regulation.originationDate),
        title: "Regulation Originated",
        description: "Initial publication of the regulation",
        type: "origin",
        icon: <History className="h-5 w-5 text-blue-500" />
      });
    }

    // Add effective date if available
    if (regulation.effectiveDate) {
      events.push({
        date: new Date(regulation.effectiveDate),
        title: "Regulation Effective",
        description: "Regulation became effective",
        type: "effective",
        icon: <CheckCircle className="h-5 w-5 text-green-500" />
      });
    }

    // Add last updated if available
    if (regulation.lastUpdated) {
      events.push({
        date: new Date(regulation.lastUpdated),
        title: "Last Updated",
        description: regulation.changeSummary || "Regulation was updated",
        type: "update",
        icon: <History className="h-5 w-5 text-purple-500" />
      });
    }

    // Add next review date if available
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