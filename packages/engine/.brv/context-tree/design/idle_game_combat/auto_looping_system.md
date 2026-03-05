## Idle Combat System in Godot

**Pattern**: Auto-starting, auto-looping combat that runs continuously in the background.

**Implementation**:

```gdscript
# CombatManager singleton (autoload)
extends Node

var in_combat: bool = false
var current_enemy: Enemy = null

func _ready() -> void:
    # Auto-start after delay
    await get_tree().create_timer(1.5).timeout
    start_combat()

func _process(delta: float) -> void:
    if not in_combat:
        return
    
    # Update attack timers
    player_attack_timer += delta
    if player_attack_timer >= attack_interval:
        _player_attack()
        player_attack_timer = 0.0
    
    # Check victory/defeat
    if enemy.is_defeated():
        _end_combat(true)
    elif player_hp <= 0:
        _end_combat(false)

func _end_combat(victory: bool) -> void:
    in_combat = false
    
    if victory:
        # Give rewards, advance stage
        combat_ended.emit(true, rewards)
        
        # Auto-start next battle
        await get_tree().create_timer(2.0).timeout
        start_combat()
    else:
        # Auto-respawn and retry
        await get_tree().create_timer(5.0).timeout
        start_combat()
```

**Key Features**:
- Combat starts automatically on game load
- Loops continuously: victory → next stage → next battle
- Defeat respawns and retries same stage
- No manual start button needed
- Runs in background via `_process()`
- Works across all game tabs/scenes

**UI Updates**:
```gdscript
func _process(_delta: float) -> void:
    # Animated status indicator
    if CombatManager.in_combat:
        var dots = int(Time.get_ticks_msec() / 500) % 4
        idle_status.text = "🌀 IDLE COMBAT ACTIVE" + ".".repeat(dots)
    else:
        idle_status.text = "⏳ Respawning..."
```

This creates the "always active" feeling essential to idle games.