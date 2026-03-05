**PROJECT: Nostalgia Idle - Progression Fantasy Idle Game**

**Repository:** https://github.com/dvdbrnds/Nostidle (Private)
**Location:** /Users/dvdbrnds/Desktop/Nostidle/
**Platform:** Steam (macOS native, Windows/Linux later)
**Engine:** Godot 4.3+ (GDScript)
**Status:** Week 1 Complete - Prototype phase, core merge mechanic working
**Version:** 0.1.0-alpha

**VISION:** "Where Memories Become Power" - Players collect nostalgic artifacts from 1950s-2020s. Each collectible category has unique mechanics (records spin, action figures merge, cassettes rewind). Collections generate combat power, combat unlocks iconic avatar gear (He-Man's belt, Ghostbusters pack).

**TECH STACK:**
- Frontend: Godot 4.3+ (GDScript)
- Backend: Supabase (PostgreSQL + Auth + Edge Functions) - NOT DEPLOYED YET
- Cache: Redis (local Docker for testing)
- Analytics: PostHog (planned)
- Version Control: Git + GitHub (private repo)

**DEVELOPMENT STRATEGY: LOCAL-FIRST**
Everything runs locally with JSON saves during development. No cloud services or monthly fees required. Backend infrastructure ready (Docker Compose + Supabase migrations) but not deployed until needed. Smooth migration path: Local → Docker Backend → Supabase Cloud.

**PROJECT STRUCTURE:**
```
Nostidle/
├── game/ (Godot 4.x project)
│   ├── project.godot (main project file)
│   ├── scenes/ (main.tscn, test_scene.tscn, merge_ui.tscn)
│   ├── scripts/
│   │   ├── autoload/ (GameState, CombatCalculator, Analytics, Theme)
│   │   └── collectibles/ (ActionFigure class)
│   └── resources/collectibles/ (he_man, snake_eyes, optimus)
├── backend/ (Docker setup + Supabase migrations, ready but not deployed)
└── docs/ (Complete PRD documentation ~50,000 words)
```

**CORE SYSTEMS IMPLEMENTED:**

1. **GameState Singleton** (game/scripts/autoload/game_state.gd):
   - Central player data management
   - Collections dictionary: { "action_figures": [], "cassette_tapes": [], ... }
   - Save/load to local JSON: ~/Library/Application Support/Godot/app_userdata/Nostalgia Idle/save_game.json
   - Auto-save every 5 minutes + on quit
   - Signals: player_level_changed, collection_updated, gear_equipped, currency_changed
   - Methods: add_collectible(), remove_collectible(), calculate_total_power(), equip_gear()

2. **ActionFigure Resource Class** (game/scripts/collectibles/action_figure.gd):
   - Implements merge mechanic: 2 Level 1 → 1 Level 2
   - Power formula: base_atk * rarity_multiplier * (2^(level-1))
   - Rarity multipliers: Common(1x), Uncommon(2x), Rare(4x), Epic(8x), Legendary(20x), Mythic(50x), Nostalgic(100x)
   - Methods: can_merge_with(), merge(), get_power(), get_crit_bonus(), to_dict(), from_dict()
   - Exponential power scaling: He-Man Lv1 = 1,000 power → Lv2 = 4,000 → Lv3 = 16,000

3. **CombatCalculator Singleton** (game/scripts/autoload/combat_calculator.gd):
   - Power synthesis: ATK = base_atk * (1 + collection_bonuses) * gear_multipliers
   - Speed cap: 10 attacks/sec, Crit cap: 75%
   - DPS calculation: base_dps * (1 + (crit_chance * (crit_multiplier - 1)))
   - Enemy generation: Exponential scaling per stage (pow(1.15, stage-1)), bosses every 10 stages (3x multiplier)
   - Combat simulation: Returns victory/defeat, time, rewards

4. **Merge UI** (game/scenes/collection/merge_ui.tscn):
   - Collection grid display (4 columns)
   - Two-slot merge interface with validation
   - Real-time stats panel showing total power
   - Auto-refresh on collection updates

**SAMPLE CONTENT:**
- He-Man (Legendary, Base ATK 50, Lv1 Power: 1,000)
- Snake Eyes (Epic, Base ATK 30, Lv1 Power: 240)
- Optimus Prime (Epic, Base ATK 35, Lv1 Power: 280)

**TESTING:**
Run test_scene.tscn (F6 in Godot) - pre-loads 2x He-Man, 2x Snake Eyes, 1x Optimus.
Test merge: Select two He-Man figures → Click MERGE → 2 Level 1 become 1 Level 2 (Power: 1,000 → 4,000)

**SAVE SYSTEM:**
- Location: ~/Library/Application Support/Godot/app_userdata/Nostalgia Idle/save_game.json
- Format: JSON with player_level, collections, gear, currency, progression
- Triggers: Auto-save every 5 minutes, on quit, manual via GameState.save_game()
- View: cat ~/Library/Application\ Support/Godot/app_userdata/Nostalgia\ Idle/save_game.json | jq .
- Reset: rm ~/Library/Application\ Support/Godot/app_userdata/Nostalgia\ Idle/save_game.json

**BACKEND INFRASTRUCTURE (Ready but not deployed):**
- Database: backend/supabase/migrations/001_initial_schema.sql - Complete PostgreSQL schema (15+ tables: users, collectibles, user_collectibles, gear, combat_progress, transactions, guilds, etc.)
- Dynamic Pricing: backend/supabase/functions/calculate-bundle-price/index.ts - Adjusts bundle price based on owned items
- Docker: backend/docker-compose.yml - Local PostgreSQL + Redis + pgAdmin
- Start: cd backend && docker-compose up -d

**KEY FORMULAS IMPLEMENTED:**
```gdscript
// Power calculation
Power = base_atk * rarity_multiplier * (2^(level-1))

// Merge mechanic
merged.level = level + 1
merged.base_atk = base_atk * 2  // Doubles each level

// Combat stats
ATK = base_atk * (1 + collection_bonuses) * gear_multipliers
SPD = base_spd * (1 + speed_bonuses)  // Cap: 10/sec
HP = base_hp * (1 + hp_bonuses) * gear
CRIT = base_5% + collection_bonuses  // Cap: 75%
DPS = base_dps * (1 + (crit_chance * (crit_multiplier - 1)))
```

**DEVELOPMENT ROADMAP:**
- ✅ Week 1: Core systems (GameState, ActionFigure, CombatCalculator, Merge UI, Save/Load) - COMPLETE
- ⏳ Week 2: Combat system (auto-battle, enemy generation, victory rewards, stages 1-10)
- ⏳ Week 3: Gear system (5 iconic pieces: He-Man's Belt, Ghostbusters Pack, LA Lights, etc.)
- ⏳ Week 4: Second collectible category (Cassette Tapes with rewind mechanic OR Breakfast Cereals)
- ⏳ Weeks 5-8: Content & polish (80s era complete, 100+ collectibles, museum mode, audio)

**COST TIMELINE:**
- Development (now): $0 (local only)
- Alpha testing: $0 (Supabase free tier)
- Beta: $0-25/month (Supabase Pro optional)
- Production: $25-100+/month (only with real users)

**DOCUMENTATION:**
- README.md - Complete setup guide
- QUICKSTART.md - 5-minute start guide
- DEVELOPMENT.md - Local-first strategy & cloud migration
- PROJECT_STATUS.md - Current progress & roadmap
- PROJECT_RECORD.md - Comprehensive project overview (740 lines)
- GIT_WORKFLOW.md - Daily Git commands
- Complete PRD suite: NOSTALGIA_IDLE_PRD_COMPLETE.md, NOSTALGIA_IDLE_DEV_QUICK_REF.md, NOSTALGIA_IDLE_TECHNICAL_APPENDIX.md

**GIT WORKFLOW:**
```bash
cd /Users/dvdbrnds/Desktop/Nostidle
git add .
git commit -m "feat: description"
git push origin main
```

**QUICK START:**
```bash
# Open project
open /Users/dvdbrnds/Desktop/Nostidle/game/project.godot

# Run test scene in Godot
Press F6 → Select: scenes/test_scene.tscn

# Merge figures
Click He-Man #1 → Click He-Man #2 → Click MERGE
Watch: 2 Level 1 → 1 Level 2 (Power: 1,000 → 4,000)
```

**COMMITS:**
- Initial commit (33c5fc5): Complete Godot project structure, core systems, merge mechanic, 31 files
- Latest (87dd8e3): Added comprehensive project documentation

**KEY LEARNINGS:**
1. Local-first development is liberating (zero costs, fast iteration)
2. Godot 4.x excellent for 2D/UI idle games
3. Test scene pattern provides immediate feedback
4. PRD-first approach prevents scope creep
5. Exponential power scaling creates meaningful progression

**NEXT STEPS:**
Implement combat system: enemy generation, auto-battle logic, victory rewards, stage progression