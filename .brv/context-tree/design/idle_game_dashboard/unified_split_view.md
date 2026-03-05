## Unified Dashboard for Idle Games

**Pattern**: Single-screen dashboard showing all game systems simultaneously instead of tabs.

**Why It Works for Idle Games**:
- Players need to see progress happening in real-time
- Switching tabs breaks the idle flow
- Merging should affect combat immediately (visible feedback)
- Information density > navigation

**Implementation** (Godot):

```gdscript
# Use HSplitContainer for resizable split view
HSplitContainer
├─ LeftPanel (Combat)
│  ├─ Status header
│  ├─ Battle zone (Player vs Enemy)
│  ├─ HP bars
│  └─ Combat log
└─ RightPanel (Collection)
   ├─ Power display
   ├─ Instructions
   └─ Scrollable grid (drag-and-drop)

# Single script handles both systems
extends Control

func _ready():
    # Connect both combat AND collection signals
    CombatManager.combat_started.connect(_on_combat_started)
    GameState.collection_updated.connect(_on_collection_updated)
```

**Key Features**:
- **Split view** (not tabs) - see both at once
- **Real-time updates** - merge → see power increase → see combat improve
- **Compact info** - dense but readable
- **No navigation** needed - everything visible
- **Resizable** - player can adjust split

**UX Benefits**:
- Immediate feedback loop
- No context switching
- Better engagement
- Feels more "alive"
- Proper idle game flow

Example games: Almost all successful idle/incremental games use unified dashboards, not tabs.