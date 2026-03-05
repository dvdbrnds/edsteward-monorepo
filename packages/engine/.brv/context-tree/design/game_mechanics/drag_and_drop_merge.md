## Mobile-Style Merge Mechanic in Godot

**Pattern**: Direct drag-and-drop merge where items can be both draggable AND drop zones.

**Implementation**:
```gdscript
# Each draggable item implements both drag and drop
extends PanelContainer
class_name DraggableFigure

signal merge_requested(source, target)

# Start drag
func _get_drag_data(_at_position: Vector2) -> Variant:
    var preview = Label.new()
    preview.text = "🎮 " + figure.name
    set_drag_preview(preview)
    return figure  # Pass data

# Accept drops
func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
    if not data is ActionFigure or data == figure:
        return false
    
    # Visual feedback
    if figure.can_merge_with(data):
        # Show green highlight
        return true
    else:
        # Show orange highlight
        return false

# Handle drop
func _drop_data(_at_position: Vector2, data: Variant) -> void:
    merge_requested.emit(data, figure)

# Reset style when drag ends
func _notification(what: int) -> void:
    if what == NOTIFICATION_DRAG_END:
        # Reset to original style
        pass
```

**Benefits**:
- More intuitive than separate merge slots
- Feels like mobile idle games (Merge Dragons, 2048, etc.)
- Instant visual feedback on hover
- Less UI clutter
- Works great on both desktop and touch devices

**Key Points**:
- Every item is both a drag source AND drop target
- Use `_notification(NOTIFICATION_DRAG_END)` to reset styles
- Provide clear visual feedback (colors) during drag
- Use signals to communicate merge events to parent