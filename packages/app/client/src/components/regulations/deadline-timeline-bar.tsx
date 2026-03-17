import { CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineTimelineBarProps {
  dueDate: string;
  status: string;
}

const TIMELINE_WINDOW_DAYS = 90;

function getDaysRemaining(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getBarColor(daysRemaining: number): string {
  if (daysRemaining < 0) return 'bg-red-600';
  if (daysRemaining <= 7) return 'bg-red-500';
  if (daysRemaining <= 14) return 'bg-orange-500';
  if (daysRemaining <= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getTextColor(daysRemaining: number): string {
  if (daysRemaining < 0) return 'text-red-700 dark:text-red-400';
  if (daysRemaining <= 7) return 'text-red-600 dark:text-red-400';
  if (daysRemaining <= 14) return 'text-orange-600 dark:text-orange-400';
  if (daysRemaining <= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function getLabel(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return overdue === 1 ? '1d overdue' : `${overdue}d overdue`;
  }
  if (daysRemaining === 0) return 'Due today';
  return daysRemaining === 1 ? '1d left' : `${daysRemaining}d left`;
}

export function DeadlineTimelineBar({ dueDate, status }: DeadlineTimelineBarProps) {
  if (status === 'completed') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Complete</span>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(dueDate);
  const isOverdue = daysRemaining < 0;
  const daysElapsed = TIMELINE_WINDOW_DAYS - daysRemaining;
  const fillPercent = Math.max(0, Math.min(100, (daysElapsed / TIMELINE_WINDOW_DAYS) * 100));

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <div className="relative w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
            getBarColor(daysRemaining),
            isOverdue && 'animate-pulse'
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <div className="flex items-center gap-1">
        {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
        <span className={cn('text-[11px] font-medium whitespace-nowrap', getTextColor(daysRemaining))}>
          {getLabel(daysRemaining)}
        </span>
      </div>
    </div>
  );
}
