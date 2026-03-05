Session: Distinct Visual Themes for Each Cultivation Grade

Implemented unique visual differentiation for each cultivation grade from G to S, with each grade representing a gaming console era:

## Core Styles Added:
- **G-Grade (Atari)**: Blocky square core, no glow, harsh colors
- **F-Grade (NES)**: Diamond-shaped 8-bit gem with facets and pixel sparkles
- **E-Grade (SNES)**: 16-bit circular orb with gradients and highlights
- **D-Grade (PS1)**: Hexagonal low-poly gem with facets
- **C-Grade (PS2)**: Octagonal crystal with warm FFX-inspired orange/violet palette, early bloom
- **B-Grade (PS3)**: Heavy bloom sphere with XMB-inspired blue/cyan, glossy specular
- **A-Grade (PS4)**: Refined sphere with angular gradient ring, purple/teal palette
- **S-Grade (PS5)**: Ethereal transcendent core with iridescent halo and divine glow

## Key Technical Details:
```swift
// GradeTheme.CoreStyle enum now has distinct cases:
enum CoreStyle {
    case blocky      // G: Atari
    case pixelated   // F: NES
    case sprite16    // E: SNES
    case lowPoly     // D: PS1
    case dvdEra      // C: PS2
    case hdBloom     // B: PS3
    case refined     // A: PS4
    case nextGen     // S: PS5
}
```

## Wisp Rendering:
Each grade has unique wisp shapes and effects:
- Atari: Simple squares
- NES: Diamond sprites
- SNES: 16-bit orbs with detail
- PS1: Hexagonal gems
- PS2: Warm glowing orbs with bloom
- PS3: Heavy bloom spheres with glossy speculars
- PS4: Refined particles with elegant rings
- S-Grade: Ethereal wisps with iridescent halos

## Color Palettes:
- PS2: Orange primary, violet secondary, golden accent (FFX vibes)
- PS3: XMB blue primary, ocean secondary, cyan accent
- PS4: Vibrant purple primary, teal secondary, soft pink accent
- S-Grade: Ethereal white-blue primary, iridescent violet secondary, divine gold accent