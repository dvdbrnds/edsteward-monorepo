## Dungeon Core Cultivation - Session Summary (Dec 20, 2025)

### New Systems Implemented

**Wisp Adventure System**
- Wisps can be sent on exploration missions to discover new abilities
- Trade-off: wisps on adventure don't generate mana
- Adventure speed scales with number of wisps sent
- Inline explore buttons (×1, ½, ALL) - half/all locked until Expedition Party discovery

**Discovery Progression Order:**
1. Mana Sense - unlocks mana counter display
2. Wisp Consciousness - unlocks buying more wisps
3. Expedition Party - unlocks sending half/all wisps
4. Mana Reservoir - unlocks capacity upgrades
5. Mana Compression - unlocks density upgrades
6. Dungeon Tunnels - unlocks room building
7. The Study - (future)

**Core Tier System**
- 10 tiers per rank (G-10 through S-1)
- Core size scales with tier (10% at G-10 to 100% at max)
- Wisp capacity limited by core size (3 base + tier bonus + rank bonus)
- Mana capacity capped by core size
- "Expand Core" for tier advances, "Breakthrough" for rank advances
- Breakthroughs consume all wisps

**Floating Wisps**
- Canvas-based rendering with TimelineView for 60fps animation
- Fractal orbital patterns (Circle, Lemniscate, Rose, Trefoil, Lissajous)
- 3D depth effects (wisps pass in front/behind core)
- Wisps disappear when on adventure
- Breakthrough animation: wisps converge to core

**UI/UX Improvements**
- Progressive UI reveal (elements appear when affordable/relevant)
- Tutorial system with versioning (auto-resets on tutorial changes)
- Awakening sequence merged into ContentView for seamless transitions
- Fixed layout shifts with fixed-height bottom action area
- Explore buttons moved higher to avoid iOS swipe-up gesture

**Code Structure**
- `WispAdventure.swift` - Adventure and Discovery models
- `WispAdventureManager` - Manages active adventures and discoveries
- `FloatingWisps.swift` - Animated wisp orbits with Canvas
- `TutorialOverlay.swift` - Tutorial prompts and TutorialManager
- `CoreEntity.tier` and `CoreTier` enum for sub-rank progression

**DEV Balance Settings (for fast testing)**
- Adventure durations: 5-30 seconds
- Starting mana capacity: 25
- Base wisp cost: 5.0
- Base capacity cost: 15.0