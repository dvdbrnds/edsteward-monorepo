## Dungeon Core Cultivation - Session 2 Progress (Dec 2024)

### New Rank System (G through S)
Added G-rank as starting "Mortal Core" rank. Full progression:
- G: Mortal Core (Grey) - 5 sq units, 100 mana to advance
- F: Ruby Core (Red) - 10 sq units, 400 mana
- E: Amber Core (Orange) - 25 sq units, 2,000 mana
- D: Topaz Core (Yellow) - 50 sq units, 10,000 mana
- C: Emerald Core (Green) - 100 sq units, 75,000 mana
- B: Sapphire Core (Blue) - 200 sq units, 500,000 mana
- A: Amethyst Core (Violet) - 400 sq units, 5,000,000 mana
- S: Diamond Core (White) - 800 sq units, 50,000,000 mana

### Core Visual System
Core orb now displays mana fill visually:
- Rim always shows true rank color (player's actual rank)
- Fill interpolates from dark grey (empty) to rank color (full)
- G-rank uses cyan fill since grey wouldn't show contrast
- Glow intensity increases with mana fill percentage

### Awakening Intro Sequence
New `AwakeningView.swift` for first-time/prestige players:
1. Dormant - Black core, "..."
2. Stirring - "Something stirs..."
3. Thinking - "I... think..."
4. Aware - "I think, therefore I am."
5. Awakened - "Mortal Core" → Begin game

Flow controlled by `@AppStorage("hasAwakened")`. When false:
- Game resets to fresh state (clears saves)
- Shows AwakeningView
- On completion, sets hasAwakened = true

### BigNumber Fix
Fixed comparison operator for values < 1:
```swift
// Old: exponent comparison broke for 0.2 vs 0 (exponent -1 < 0)
// New: Properly handles zero and negative exponents
public static func < (lhs: BigNumber, rhs: BigNumber) -> Bool {
    if lhs.isZero && rhs.isZero { return false }
    if lhs.isZero { return rhs.mantissa > 0 }
    if rhs.isZero { return lhs.mantissa < 0 }
    // ... rest of comparison
}
```

### Dev Reset Button
Added red ↺ button in top bar for quick testing. Sets hasAwakened = false to trigger full reset + awakening.

### Code B Definition (Reminder)
"Code B" = Commit to GitHub + Store knowledge in ByteRover