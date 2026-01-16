import { Settings2, Eye, EyeOff, RotateCcw, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { useDashboardWidgets, DASHBOARD_WIDGETS, type WidgetId, type Widget } from '@/hooks/use-dashboard-widgets';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface WidgetSettingsProps {
  className?: string;
}

// Sortable widget item component
function SortableWidgetItem({ 
  widget, 
  isVisible, 
  onToggle 
}: { 
  widget: Widget; 
  isVisible: boolean; 
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
        isDragging && "shadow-lg ring-2 ring-primary/20 z-50",
        !isVisible && "opacity-60"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
        aria-label={`Drag to reorder ${widget.name}`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Widget info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isVisible ? (
            <Eye className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-medium text-sm truncate">{widget.name}</span>
        </div>
        <p className="text-xs text-muted-foreground pl-5.5 truncate">
          {widget.description}
        </p>
      </div>

      {/* Visibility toggle */}
      <Switch
        checked={isVisible}
        onCheckedChange={onToggle}
        disabled={!widget.canHide}
        aria-label={`Toggle ${widget.name} visibility`}
      />
    </div>
  );
}

export function WidgetSettings({ className }: WidgetSettingsProps) {
  const { 
    isWidgetVisible, 
    toggleWidget, 
    showAllWidgets, 
    hiddenCount,
    widgetOrder,
    reorderWidgets,
    resetOrder,
  } = useDashboardWidgets();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgetOrder.indexOf(active.id as WidgetId);
      const newIndex = widgetOrder.indexOf(over.id as WidgetId);
      const newOrder = arrayMove(widgetOrder, oldIndex, newIndex);
      reorderWidgets(newOrder);
    }
  };

  const orderedWidgets = widgetOrder
    .map(id => DASHBOARD_WIDGETS.find(w => w.id === id))
    .filter((w): w is Widget => w !== undefined);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Settings2 className="h-4 w-4 mr-2" />
          Customize
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {hiddenCount} hidden
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customize Dashboard</span>
          </DialogTitle>
          <DialogDescription>
            Drag to reorder widgets. Toggle visibility with the switch.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm text-muted-foreground">
            {hiddenCount > 0 ? `${hiddenCount} widget${hiddenCount > 1 ? 's' : ''} hidden` : 'All widgets visible'}
          </span>
          <div className="flex gap-2">
            {hiddenCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={showAllWidgets}
                className="h-7 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                Show All
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetOrder}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Order
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={widgetOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
              {orderedWidgets.map((widget) => (
                <SortableWidgetItem
                  key={widget.id}
                  widget={widget}
                  isVisible={isWidgetVisible(widget.id)}
                  onToggle={() => toggleWidget(widget.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="pt-2 border-t text-xs text-muted-foreground text-center">
          💡 Tip: Changes are saved automatically
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Individual widget wrapper that can be hidden by user
interface WidgetWrapperProps {
  widgetId: WidgetId;
  children: React.ReactNode;
}

export function WidgetWrapper({ widgetId, children }: WidgetWrapperProps) {
  const { isWidgetVisible } = useDashboardWidgets();
  
  if (!isWidgetVisible(widgetId)) {
    return null;
  }

  return <>{children}</>;
}
