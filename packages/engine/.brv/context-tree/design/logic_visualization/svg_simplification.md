Aristotle's Logic Explorer - Introduction Page Step 3 Reset

After extensive experimentation with complex SVG masking and animation for the mutually exclusive categories (Mammals and Fish), the implementation was simplified to a clean starting point:

**Current Clean State:**
- Two simple overlapping circles representing Mammals (blue) and Fish (green)
- No masks, no white gaps, no animations
- Basic SVG structure with filled circles and stroke outlines
- Simple and maintainable code ready for incremental feature additions

**Key Learning:**
When SVG masking and clipping becomes overly complex with multiple layers (fill masks, stroke clips, animated transitions), it's better to restart with a minimal implementation and add complexity incrementally based on clear user requirements.

**Implementation Pattern:**
```tsx
// Simple overlapping circles in Introduction.tsx Step 3
<svg viewBox="0 0 400 300">
  <circle cx="150" cy="150" r="70" fill="#bae6fd" fillOpacity="0.7" />
  <circle cx="150" cy="150" r="70" fill="none" stroke="#0284c7" strokeWidth="3" />
  <circle cx="250" cy="150" r="70" fill="#a7f3d0" fillOpacity="0.7" />
  <circle cx="250" cy="150" r="70" fill="none" stroke="#059669" strokeWidth="3" />
</svg>
```

**Navigation:**
- Route: `/introduction` 
- Component: `src/pages/Introduction.tsx`
- Uses React useState for step progression (6 steps total)
- Step 3 focuses on two-category relationships