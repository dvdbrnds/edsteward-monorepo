/**
 * Deadline Calendar Component
 * Shows compliance deadlines in a calendar view with visual indicators
 */

import { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Loader2
} from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Link } from "wouter";
import type { Deadline, Regulation } from "@shared/schema";

export default function DeadlineCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const { data: deadlines, isLoading: deadlinesLoading } = useQuery<Deadline[]>({
    queryKey: ["/api/deadlines"],
  });

  const { data: regulations } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });

  // Create a map of dates to deadlines
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    
    (deadlines || []).forEach(deadline => {
      const dateKey = format(new Date(deadline.dueDate), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(deadline);
    });
    
    return map;
  }, [deadlines]);

  // Get deadlines for a specific date
  const getDeadlinesForDate = (date: Date): Deadline[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return deadlinesByDate.get(dateKey) || [];
  };

  // Get regulation name for a deadline
  const getRegulationName = (deadline: Deadline): string => {
    const regulation = (regulations || []).find(r => r.id === deadline.regulationId);
    return regulation?.name || regulation?.topic || `Regulation #${deadline.regulationId}`;
  };

  // Get status color
  const getStatusColor = (deadline: Deadline): string => {
    const dueDate = new Date(deadline.dueDate);
    const today = new Date();
    
    if (deadline.status === 'completed') return 'bg-green-500';
    if (dueDate < today) return 'bg-red-500';
    
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // Get the deadlines for selected date
  const selectedDateDeadlines = selectedDate ? getDeadlinesForDate(selectedDate) : [];

  // Count deadlines in current month view
  const monthDeadlineCount = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    return (deadlines || []).filter(d => 
      isWithinInterval(new Date(d.dueDate), { start, end })
    ).length;
  }, [deadlines, currentMonth]);

  // Custom day renderer to show deadline indicators
  const modifiers = useMemo(() => {
    const hasDeadline: Date[] = [];
    const overdue: Date[] = [];
    const dueSoon: Date[] = [];
    const completed: Date[] = [];
    
    const today = new Date();
    
    deadlinesByDate.forEach((deadlineList, dateKey) => {
      const date = new Date(dateKey);
      hasDeadline.push(date);
      
      deadlineList.forEach(deadline => {
        if (deadline.status === 'completed') {
          if (!completed.some(d => isSameDay(d, date))) completed.push(date);
        } else if (date < today) {
          if (!overdue.some(d => isSameDay(d, date))) overdue.push(date);
        } else {
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 7 && !dueSoon.some(d => isSameDay(d, date))) {
            dueSoon.push(date);
          }
        }
      });
    });
    
    return { hasDeadline, overdue, dueSoon, completed };
  }, [deadlinesByDate]);

  const modifiersStyles = {
    hasDeadline: {
      fontWeight: 'bold',
    },
    overdue: {
      backgroundColor: 'rgb(254 226 226)',
      color: 'rgb(185 28 28)',
      borderRadius: '50%',
    },
    dueSoon: {
      backgroundColor: 'rgb(254 249 195)',
      color: 'rgb(161 98 7)',
      borderRadius: '50%',
    },
    completed: {
      backgroundColor: 'rgb(220 252 231)',
      color: 'rgb(22 101 52)',
      borderRadius: '50%',
    },
  };

  if (deadlinesLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Deadline Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-500" />
            Deadline Calendar
          </CardTitle>
          <Badge variant="outline">
            {monthDeadlineCount} this month
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border"
          />
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-200" />
              <span className="text-muted-foreground">Overdue</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-200" />
              <span className="text-muted-foreground">Due Soon</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-200" />
              <span className="text-muted-foreground">Completed</span>
            </div>
          </div>
          
          {/* Selected date details */}
          {selectedDate && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h4>
              {selectedDateDeadlines.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedDateDeadlines.map(deadline => (
                    <Link 
                      key={deadline.id} 
                      href={`/regulations/${deadline.regulationId}`}
                    >
                      <div className="p-2 rounded-lg border hover:bg-muted cursor-pointer transition-colors">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(deadline)}`} />
                          <span className="text-sm font-medium truncate flex-1">
                            {getRegulationName(deadline)}
                          </span>
                          <Badge 
                            variant={deadline.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {deadline.status}
                          </Badge>
                        </div>
                        {deadline.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate pl-4">
                            {deadline.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No deadlines on this date</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

