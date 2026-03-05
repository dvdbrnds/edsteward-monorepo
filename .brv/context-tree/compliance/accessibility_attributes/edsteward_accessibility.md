## EdSteward Accessibility Improvements (January 2026)

Added ARIA labels and accessibility attributes across the application:

**Icon-only Buttons:**
```tsx
// Task actions menu
<Button aria-label="Task actions menu"><MoreHorizontal /></Button>

// Expand/collapse with state
<button 
  aria-label={expanded ? "Collapse sub-tasks" : "Expand sub-tasks"}
  aria-expanded={expanded}
>

// Clear buttons
<Button aria-label="Clear search"><X /></Button>
<Button aria-label="Remove file"><X /></Button>
<Button aria-label="Clear selection"><X /></Button>

// Mobile menu
<Button 
  aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
  aria-expanded={mobileMenuOpen}
>
```

**Form Inputs:**
```tsx
<Input aria-label="Search regulations" placeholder="Search..." />
```

**Table Headers (`client/src/components/ui/table.tsx`):**
```tsx
<th scope="col" {...props} /> // Added scope="col" by default
```

**Files Modified:**
- compliance-tasks-panel.tsx
- regulation-list.tsx
- submission-wizard.tsx
- bulk-task-operations.tsx
- navigation.tsx
- table.tsx (UI component)