## Dungeon Core Cultivation - Session Summary (Dec 20, 2025 - Part 3)

### Wisp System Overhaul
**Removed hard wisp cap** - wisps are now unlimited with exponential cost scaling:
- Costs: 1, 2, 4, 8, 16, 32, 64... (doubles each time)
- Natural soft cap based on mana capacity
- `isAtMaxWisps` always returns false now
- UI shows "×3" instead of "3/5"

**Constants changed:**
```swift
static let baseWispCost: Double = 1.0      // was 5.0
static let wispCostScaling: Double = 2.0   // was 1.1
```

### Breakthrough Rewards Fixed
- Mana capacity now increases on EVERY tier advance (not just rank changes)
- Capacity boosted to 80% of new maxManaCapacity on breakthrough
- Mana drains to zero on breakthrough (represents consumption)
- All wisps still consumed on breakthrough

### Tutorial Card Position
- "Tap your Core" tutorial card now appears below the core instead of blocking it
- Changed `TutorialPosition.belowCore` Y position from 0.55 to 0.72

### Discovery System
Split mana tracking and wisp spawning into separate exploration rewards:
1. Mana Sense (5s) - see mana counter
2. Wisp Consciousness (8s) - buy more wisps
3. Expedition Party (10s) - send half/all wisps
4. Mana Reservoir (12s) - capacity upgrades
5. Mana Compression (15s) - density upgrades
6. Dungeon Tunnels (20s) - room building

### Explore Button
Inline wisp sending options (×1, ½, ALL) positioned higher to avoid iOS swipe-up gesture. ½ and ALL locked until Expedition Party discovery.