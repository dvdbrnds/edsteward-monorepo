## Dungeon Core Cultivation - Session Summary (Dec 20, 2025 - Part 2)

### Critical Bug Fixed
**Game Loop Timing Bug**: The `try?` on `Task.sleep` was silently swallowing cancellation errors, causing the game loop to run at max CPU speed instead of 10 ticks/second. This made mana generate millions of times faster than intended. Fixed by properly catching the error and breaking the loop on cancellation.

### Balance Changes (Early Game)
- `baseManaPerWispPerSecond`: 0.2 → 0.05 (4x slower passive generation)
- `baseManaPerTap`: 1.0 → 0.25 (4x less per tap)
- With 1 wisp and 25 capacity: ~8 minutes to fill from passive alone

### Discovery System Updates
Split rewards into separate explorations:
1. **Mana Sense** (5s) - Unlocks mana counter display
2. **Wisp Consciousness** (8s) - Unlocks buying more wisps
3. **Expedition Party** (10s) - Unlocks sending half/all wisps on adventures
4. Mana Reservoir (12s) - Capacity upgrades
5. Mana Compression (15s) - Density upgrades
6. Dungeon Tunnels (20s) - Room building
7. The Study (30s) - Future feature

### UI Changes
- Explore buttons now inline (×1, ½ locked, ALL locked) - positioned higher to avoid iOS swipe-up gesture
- ½ and ALL buttons unlock after Expedition Party discovery
- Tutorial "Tap your Core" card positioned below core instead of blocking it
- Debug display now shows dynamic GameConstants values instead of hardcoded strings