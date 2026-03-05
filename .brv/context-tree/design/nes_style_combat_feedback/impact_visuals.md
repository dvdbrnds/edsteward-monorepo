## NES-Style Combat Feedback Implementation (Godot 4.x)

**Context:** Adding authentic 8-bit NES game feel to idle game combat system.

**Key NES Techniques Implemented:**

1. **Screen Flash on Hits** (like Mega Man):
```gdscript
# Full-screen overlay that flashes
extends ColorRect
class_name NESScreenFlash

func flash_white(intensity: float = 0.6):
    color = Color.WHITE
    var tween = create_tween()
    tween.tween_property(self, "modulate:a", intensity, 0.05)  # 3 frames at 60fps
    tween.tween_property(self, "modulate:a", 0.0, 0.05)
```

2. **Hit Pause/Freeze Frames** (adds impact):
```gdscript
func _hit_pause(duration: float):
    get_tree().paused = true
    await get_tree().create_timer(duration, true, false, true).timeout
    get_tree().paused = false
    
# Usage:
_hit_pause(0.05)  # 3 frames for player hit
_hit_pause(0.03)  # 2 frames for enemy hit
```

3. **Chunky Segmented HP/Mana Bars** (like Castlevania):
```gdscript
# 20 segments, 8 pixels each
const SEGMENT_WIDTH = 8
const SEGMENT_HEIGHT = 16
const NUM_SEGMENTS = 20

func _update_segments():
    var percent = float(current_value) / float(max_value)
    var filled_segments = int(percent * NUM_SEGMENTS)
    for i in range(NUM_SEGMENTS):
        segments[i].visible = (i < filled_segments)
        segments[i].color = _get_bar_color(percent)
```

4. **Chunky Damage Numbers** (like Final Fantasy):
```gdscript
# No smooth easing - discrete jumps
var tween = create_tween()
tween.set_trans(Tween.TRANS_LINEAR)  # No easing!
for i in range(4):
    var step_pos = start_pos + Vector2(0, -jump_height * (i + 1) / 4.0)
    tween.tween_property(self, "position", step_pos, 0.1)
```

5. **NES Color Palette**:
```gdscript
var nes_bg = Color(0.1, 0.1, 0.15)  # Dark blue-black
# HP: Green → Yellow → Red transitions
# MP: Blue → Purple transitions
```

**Integration Pattern:**
```gdscript
# On combat hit:
screen_flash.flash_white(0.7)        # Visual feedback
_hit_pause(0.05)                     # Add impact
hp_bar_nes.flash_damage()            # Flash bar
_spawn_nes_damage_number(damage)     # Show damage
```

**Result:** Authentic NES game feel with freeze frames, screen flashes, chunky visuals, and impactful feedback. Every hit feels like classic Mega Man or Castlevania!