## Rest/Healing Mechanic in Idle Games

**Pattern**: Scaled rest period after defeat to create engagement and encourage upgrades.

**Why It Works**:
- Adds consequence to defeat (not instant retry)
- Creates urgency to get stronger
- Natural teaching moment (shows why merging matters)
- Scales with difficulty (harder = longer rest)

**Implementation**:

```gdscript
# In CombatManager
var is_resting: bool = false
var rest_time_remaining: float = 0.0
var rest_heal_per_second: float = 0.0

func _start_rest() -> void:
    is_resting = true
    
    # Scale rest time with progression
    var base_time = 3.0
    var scaling = pow(1.08, stage - 1)  # 8% per stage
    rest_time_total = min(base_time * scaling, 60.0)  # Cap
    
    # Calculate healing rate
    rest_heal_per_second = float(max_hp) / rest_time_total
    
    rest_started.emit(rest_time_total)

func _update_rest(delta: float) -> void:
    rest_time_remaining -= delta
    
    # Heal gradually
    player_hp = min(max_hp, player_hp + int(heal_per_sec * delta))
    rest_updated.emit(time_remaining, hp_percent)
    
    if rest_time_remaining <= 0 or player_hp >= max_hp:
        _finish_rest()
```

**UI Features**:
- Live countdown timer
- Healing progress bar
- Random tips during rest
- Visual state change (orange color)

**Scaling Formula**:
`rest_time = min(3.0 * 1.08^(stage-1), 60.0)`

Stage 1: 3s, Stage 10: 6s, Stage 20: 13s, Stage 30: 28s, Stage 40+: 60s (cap)

**Player Psychology**:
- Early: Quick, feels fair
- Mid: Builds pressure
- Late: Makes defeat costly
- Result: Strong incentive to upgrade

This adds meaningful progression pressure without being punishing.