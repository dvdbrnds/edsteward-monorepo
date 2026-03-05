Session: Build Fixes and Dev Tools Update

## Build Error Fixes

### SwiftUI ButtonStyle Conflict
The project had a naming conflict between our custom `ButtonStyle` enum and SwiftUI's `ButtonStyle` protocol. This caused compilation failures.

**Fix:**
- Renamed enum from `ButtonStyle` to `ThemeButtonStyle`
- Renamed property from `buttonStyle` to `buttonAppearance`
- Updated all references in GradeTheme.swift and ContentView.swift

```swift
// Before (conflicted with SwiftUI)
enum ButtonStyle { case blocky, beveled, gradient, glassmorphic }
let buttonStyle: ButtonStyle

// After (no conflict)
enum ThemeButtonStyle { case blocky, beveled, gradient, glassmorphic }
let buttonAppearance: ThemeButtonStyle
```

### Unused Variable Warnings
Fixed warnings in FloatingWisps.swift:
- `latchProgress` → replaced with `_` in tuple destructuring
- `glowRect` → removed unused variable declaration

## Dev Tools Improvements

Added better dev buttons for testing grade progression:

```swift
HStack(spacing: 8) {
    // +10K Mana (green)
    Button { 
        viewModel.mana.increaseCapacity(by: BigNumber(10000))
        viewModel.mana.fillToCapacity()
    } label: { Text("+10K") }
    
    // Next Grade (orange) - jumps to next cultivation grade
    Button {
        if let nextRank = viewModel.core.rank.nextRank {
            viewModel.core.rank = nextRank
            viewModel.core.tier = 10
        }
    } label: { Text("LVL+") }
}
```

Both buttons have consistent styling with 14pt monospaced font, 12px horizontal padding, and colored backgrounds.