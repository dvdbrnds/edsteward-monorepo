## Godot 4 Drag-and-Drop Implementation

**Problem**: `set_drag_forwarding()` doesn't work properly with `Button` nodes in Godot 4.x for drag-and-drop functionality.

**Solution**: Create custom `Control`-derived classes that implement the virtual methods:

```gdscript
# DraggableFigure class (extends PanelContainer)
func _get_drag_data(_at_position: Vector2) -> Variant:
    # Create preview
    var preview = Label.new()
    preview.text = "🎮 " + figure.name
    set_drag_preview(preview)
    return figure  # Return the data to pass to drop zone

# DropZone class (extends PanelContainer)
func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
    if data is ActionFigure:
        # Highlight drop zone
        return true
    return false

func _drop_data(_at_position: Vector2, data: Variant) -> void:
    if data is ActionFigure:
        figure_dropped.emit(data)  # Emit signal
```

**Key Points**:
- Use `PanelContainer` or `Control` as base class, NOT `Button`
- Implement `_get_drag_data()` to start drag (returns data to pass)
- Implement `_can_drop_data()` to validate drop (return true/false)
- Implement `_drop_data()` to handle drop (receive data)
- Use `set_drag_preview()` in `_get_drag_data()` to show preview
- Use signals to communicate drop events to parent

This is the proper Godot 4.x pattern for custom drag-and-drop UI elements.