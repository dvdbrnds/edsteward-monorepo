Fixed React hooks lint errors in admin-settings-page.tsx on January 2, 2026. The issue was that hooks were being called conditionally after an early return statement checking for admin access.

**The Problem:**
```tsx
// BAD - early return BEFORE hooks
if (!user || user.role !== "admin") {
  return <AccessDenied />;
}
const form = useForm(); // ❌ Called conditionally!
useEffect(() => {}, []); // ❌ Called conditionally!
```

**The Solution:**
```tsx
// GOOD - all hooks BEFORE any conditional returns
const isAdmin = user?.role?.toLowerCase() === "admin";
const form = useForm(); // ✅ Always called
useEffect(() => {
  if (!isAdmin) return; // Guard inside hook, not outside
  // ... fetch data
}, [isAdmin]);
// ... other hooks

// Conditional render AFTER all hooks
if (!user || !isAdmin) {
  return <AccessDenied />;
}
return <AdminPage />;
```

**Key Rules:**
1. React hooks must be called in the same order every render
2. Never put hooks after conditional early returns
3. Use guard clauses INSIDE useEffect instead of conditionally calling useEffect
4. Move role checks to after all hooks, then render conditionally