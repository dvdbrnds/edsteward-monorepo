## Dungeon Core Idler - Session Summary (Dec 21, 2025)

### Major Features Implemented:

**Skill Tree System (Path of Exile style)**
- Full skill tree with Minor, Notable, Keystone, and Jewel Socket nodes
- Insight currency earned from tier/rank advancements
- "Wisp Bond" notable node preserves wisps during breakthrough
- Pan/zoom gestures for navigation
- All nodes viewable for planning, not just purchasable ones
- Unlocks at F-grade via "Path of Cultivation" discovery

**Discovery/Progression System Overhaul**
- Rank-gated discoveries: G-grade (Mana Sense, Wisp Consciousness, Expedition Party, Core Resonance), F-grade (Mana Compression, Path of Cultivation), D-grade (Arcane Study)
- Dungeon Tunnels disabled (S-grade) until combat system built
- Removed redundant Mana Reservoir - capacity auto-updates on core expansion

**Core Mechanics**
- Core size grows within grade, condenses on rank breakthrough
- Core expansion sets capacity to new maxManaCapacity automatically
- Tap anywhere on background = tap core (playability)
- Wisp cost is pure doubling (1, 2, 4, 8...) without rank scaling

**UI/UX**
- Discovery toasts auto-dismiss after 4 seconds (no button)
- Dev +10K mana button in top bar for testing
- Tutorial popups removed (redundant)
- Wisp spawn animation from core surface
- Exploring wisps bounce and latch onto UI elements
- Fixed core position stability when mana display appears

**File Structure:**
- `/Data/SkillTree/` - CoreMasteryNodes.swift, SkillTreeData.swift
- `/Models/SkillTree/` - Insight.swift, SkillNode.swift, SkillTreeBonuses.swift, SkillTreeProgress.swift
- `/Views/SkillTree/` - SkillTreeView.swift, NodeView.swift, ConnectionsView.swift
- `/ViewModels/` - SkillTreeViewModel.swift