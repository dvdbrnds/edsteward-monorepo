## Dungeon Core Cultivation - Skill Tree System Design (Dec 2024)

### Overview
Path of Exile-style interconnected skill tree with 8 branches radiating from center Core. Total target: 300-400 nodes.

### Currency: Insight
- Earned from: rank-ups, raids, achievements, daily login, discoveries
- Never sold directly, only Insight Boosters (2x for 24hrs) monetized
- Respec: Free every 24hrs, or 1 Diamondoid (no scaling)

### Node Types
1. **Minor Nodes** (cost 1): Small stat bumps (+2% mana regen, etc.)
2. **Notable Nodes** (cost 3-5): Meaningful unlocks (rooms, spells, visual tiers)
3. **Keystone Nodes** (cost 5-10): Build-defining with trade-offs
4. **Jewel Sockets**: Accept found/crafted jewels

### Branch Structure
```
         [ARCANE ARTS]
              │
   [ARRAYS]───┼───[ARTIFICE]
              │
[EXPANSION]───●───[DENIZENS]
              │
  [MASTERY]───┼───[ATTUNEMENT]
              │
        [AESTHETICS]
```

### Grade Gates
- G: Core Mastery only
- F: + Arcane Arts, Expansion, Automation
- E: + Denizens, Arrays, Aesthetics
- D: + Artifice, Attunement
- B+: Keystones available
- S: Transcendent nodes

### Aesthetics Branch Visual Progression
Unlockable tiers: 4-bit → 8-bit → 16-bit → 32-bit → GBA/DS → HD Pixel → Illustrated → Transcendent

Notable nodes unlock each tier (AE_N01 "16-Bit Awakening", etc.)
Keystone AE_K01 "Aesthetic Purist" locks at chosen tier for +25% stats

### Implementation Files
```
Models/SkillTree/SkillNode.swift
Models/SkillTree/SkillTreeProgress.swift
Data/SkillTree/CoreMasteryNodes.swift
Data/SkillTree/AestheticsNodes.swift
ViewModels/SkillTreeViewModel.swift
Views/SkillTree/SkillTreeView.swift
```

Full design doc created with complete node tables for Core Mastery (40 nodes) and Aesthetics (35 nodes) branches.