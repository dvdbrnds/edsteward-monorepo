## Game Balance Tuning - Idle Game Progression

**Context:** Nostalgia Idle game balance pass to improve feel and pacing.

**Problem:** Original balance had aggressive scaling that created difficulty walls and punishing defeats.

**Solution:** Comprehensive rebalancing across multiple systems.

**Key Changes:**

1. **Enemy Scaling:** `pow(1.15, stage-1)` → `pow(1.12, stage-1)`
   - Reduces exponential growth from 15% to 12% per stage
   - Stage 20: 16.4x → 9.6x difficulty (41% easier)
   - Creates smoother progression curve

2. **Enemy Base Stats:**
   - HP: 500 → 300 (40% reduction)
   - ATK: 50 → 40 (20% reduction)
   - Makes early game more accessible

3. **Drop Rates:**
   - Normal enemies: 5% → 10%
   - Bosses: 15% → 50%
   - Milestones (every 5 stages): 100% guaranteed
   - More frequent rewards reduce grind feel

4. **Boss Rewards:**
   - 2x XP and currency multiplier
   - Combined with existing 3x stats
   - Makes bosses feel rewarding

5. **Rest/Defeat Mechanic:**
   - Scaling: `pow(1.08, stage-1)` → `pow(1.05, stage-1)`
   - Cap: 60s → 30s max
   - Stage 50: 141s → 30s rest time
   - Less punishing defeats

6. **Fast Victory Bonus:**
   - Fixed 10s threshold → `5s + (stage × 0.5s)`
   - Scales with difficulty
   - Remains relevant at all stages

**Implementation Pattern (Godot/GDScript):**
```gdscript
# In enemy generation:
var base_multiplier = pow(1.12, stage_num - 1)  # Balanced scaling
enemy.max_hp = int(300 * base_multiplier)       # Lower base stats

# Milestone bonuses:
var is_milestone = (stage_num % 5) == 0 and not is_boss
if is_milestone:
    collectible_drop_rate = 1.0  # Guaranteed every 5 stages

# Rest scaling:
var stage_scaling = pow(1.05, stage - 1)        # Gentler scaling
rest_time = min(base * stage_scaling, 30.0)     # Lower cap
```

**Testing Approach:**
- Document expected values at key stages (1, 10, 20, 50)
- Create testing guide with clear success/failure indicators
- Test early/mid/late game separately
- Measure: progression smoothness, reward frequency, defeat punishment

**Result:** Smoother curve, more frequent rewards, less punishing gameplay while maintaining challenge.