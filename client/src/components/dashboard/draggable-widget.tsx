import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface DraggableWidgetProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function DraggableWidget({ id, children, className }: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-90",
        className
      )}
    >
      {/* Drag handle - appears on hover */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -left-2 top-1/2 -translate-y-1/2 z-10",
          "p-1.5 rounded-md bg-background border shadow-sm",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "cursor-grab active:cursor-grabbing",
          "hover:bg-muted",
          isDragging && "opacity-100 cursor-grabbing"
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      {/* Widget content */}
      <div className={cn(
        "transition-all duration-200",
        isDragging && "ring-2 ring-primary/20 rounded-lg shadow-xl scale-[1.02]"
      )}>
        {children}
      </div>
    </div>
  );
}
