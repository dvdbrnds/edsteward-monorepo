Implemented dark mode support for EdSteward on December 31, 2025. Key implementation details:

1. **ThemeProvider** (`client/src/hooks/use-theme.tsx`): Created React context provider with localStorage persistence. Supports 'light', 'dark', and 'system' themes. Uses CSS class-based dark mode (adds/removes 'dark' class on document root).

2. **CSS Variables** (`client/src/index.css`): Added complete light and dark mode CSS variable definitions for all theme colors including background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, and chart colors.

3. **Navigation Toggle**: Added sun/moon icon button in top navigation bar (`client/src/components/layout/navigation.tsx`) for easy theme switching. Shows Sun icon in dark mode (click for light), Moon icon in light mode (click for dark).

4. **Dark Mode Compatible Components**: Updated `home-page.tsx`, `regulation-list.tsx`, `upcoming-deadlines.tsx` to use theme-aware Tailwind classes:
   - `bg-background` instead of `bg-gray-50`
   - `text-foreground` instead of `text-gray-900`
   - `text-muted-foreground` instead of `text-gray-500`
   - `hover:bg-muted` instead of `hover:bg-gray-50`
   - `bg-card` or `bg-background dark:bg-secondary` for cards

5. **Login Page Exempt**: Auth page (`auth-page.tsx`) explicitly overrides CSS variables to always use light mode, preserving branding colors regardless of user theme preference.

Theme preference persists in localStorage under key 'edsteward-theme'.