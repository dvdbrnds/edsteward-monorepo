import { FC, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline, TrackList, Track, TimelineRow } from "@/components/ui/timeline";
import { format } from "date-fns";
import { type Regulation } from "@shared/schema";
import { History, AlertCircle, CheckCircle } from "lucide-react";

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
        type: "origin"
      });
    }

    // Add effective date if available
    if (regulation.effectiveDate) {
      events.push({
        date: new Date(regulation.effectiveDate),
        title: "Regulation Effective",
        description: "Regulation became effective",
        type: "effective"
      });
    }

    // Add last updated if available
    if (regulation.lastUpdated) {
      events.push({
        date: new Date(regulation.lastUpdated),
        title: "Last Updated",
        description: regulation.changeSummary || "Regulation was updated",
        type: "update"
      });
    }

    // Add next review date if available
    if (regulation.nextReviewDate) {
      events.push({
        date: new Date(regulation.nextReviewDate),
        title: "Next Review Due",
        description: "Scheduled review date",
        type: "upcoming"
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
        <div className="space-y-8">
          {timelineEvents.map((event, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                {event.type === "upcoming" ? (
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <div>
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-gray-500">
                  {format(event.date, "PPP")}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {event.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
