## Art Generation System for Game Sprites

**Context:** Nostalgia Idle game uses a generation-based art tracking system for sprites.

**Generation System:**
- Gen 1 = AI-generated prototypes (current)
- Gen 2 = Professional/commissioned art (future)
- Gen 3 = Final polish (future)

**File Naming Convention:**
```
{figure_id}_gen{number}.png

Examples:
he_man_figure_gen1.png
gi_joe_figure_gen1.png
optimus_prime_figure_gen1.png
```

**Code Implementation (Godot 4.x):**
```gdscript
# In draggable_figure.gd
const CURRENT_GEN = 1

var sprite_path = "res://resources/sprites/%s_gen%d.png" % [figure.id, CURRENT_GEN]

# Fallback chain:
if ResourceLoader.exists(sprite_path):
    texture_rect.texture = load(sprite_path)
else:
    # Try legacy naming (no generation)
    var legacy_path = "res://resources/sprites/%s.png" % figure.id
    if ResourceLoader.exists(legacy_path):
        texture_rect.texture = load(legacy_path)
    else:
        # Use colored placeholder
        texture_rect.texture = _create_placeholder_texture()
```

**Upgrading Generations:**
1. Create new sprites: `{figure_id}_gen2.png`
2. Change `CURRENT_GEN = 2` in code
3. Keep old Gen 1 files for comparison
4. Update tracking document

**Benefits:**
- Version control for artwork
- Easy A/B testing of art styles
- Preserves old versions
- Clear upgrade path
- Professional asset management

**Documentation:**
- `ART_GENERATIONS.md` - Tracks all generations
- `SPRITE_GENERATION_PROMPTS.md` - AI prompts for Gen 1
- `ADDING_SPRITES.md` - How-to guide