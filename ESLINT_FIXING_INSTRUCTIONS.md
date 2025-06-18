# ESLint Fixing Session Instructions

## Current Status (As of 2025-06-18)

**Progress**:
- **Started**: 899 errors
- **Current**: 879 errors  
- **Total Reduced**: 20 errors (2.2% improvement)
- **Next Milestone**: 800 errors (79 errors remaining)

**Server Status**: ✅ Healthy and running at localhost:3000
- Database: Connected to Neon PostgreSQL
- Users: 16
- Regulations: 367
- All API endpoints responding normally

## Strategy & Approach

### Systematic Batching Strategy
1. **Check current error count**: `npx eslint client/src --format=compact | grep -c "error"`
2. **Target 10-15 errors per batch** for manageable changes
3. **Always verify server health** after each batch using [user preference][[memory:7391773961581000073]]
4. **Push to GitHub at 100-error milestones** (900, 800, 700, etc.) per [user preference][[memory:6832516527283966100]]

### Technical Approach
- **Use parallel tool calls** for maximum efficiency when reading files or searching
- **Focus on "safe" mechanical fixes**: unused imports, variables, type safety
- **Avoid complex API integration files** that cause cascading errors
- **Use proper TypeScript patterns** for type safety improvements
- **Handle React Hook dependencies** with `useCallback` patterns when needed

## Files Successfully Modified (Batches 26-28)

### Batch 26 (13 errors reduced)
1. **bug-report-button.tsx**: Replaced `any` with `unknown` and proper error checking
2. **upcoming-deadlines.tsx**: Fixed types using `Deadline & { regulationName?: string }`
3. **DifferentialView.tsx**: Removed unused imports (`DiffType`, `Tabs`, `TabsContent`, `TabsList`)
4. **queryClient.ts**: Prefixed unused parameter with underscore

### Batch 27 (2 errors reduced)
1. **submission-wizard.tsx**: Fixed React Hook dependency by moving `form` definition before `useEffect`
2. **note-section.tsx**: Fixed React Hook dependency using `useCallback` pattern with proper imports

### Batch 28 (2 errors reduced)
1. **UpdatesList.tsx**: Removed unused `PenTool` import

## Excluded/Problematic Files

**Avoid these files** due to complex dependencies or cascading errors:
- `regulation-updates/*` (complex API integration)
- `inspect-pa-regulations.*` (external API dependencies)
- `RegulationDetailPage.tsx` (complex state management)
- `debug-tools.tsx` (complex debugging features)
- Auth hooks with circular dependencies

## Common Error Patterns & Solutions

### 1. Unused Imports/Variables
```bash
# Search pattern
grep -r "is defined but never used" --include="*.tsx" --include="*.ts" client/src
```
**Solution**: Remove unused imports, or prefix variables with `_` if needed for API compatibility

### 2. Type Safety (`any` types)
```typescript
// Bad
const error: any = e;

// Good
const error: unknown = e;
if (error instanceof Error) {
  // Handle error safely
}
```

### 3. React Hook Dependencies
```typescript
// Bad - missing dependencies
useEffect(() => {
  form.reset();
}, []);

// Good - proper dependencies with useCallback
const resetForm = useCallback(() => {
  form.reset();
}, [form]);

useEffect(() => {
  resetForm();
}, [resetForm]);
```

### 4. TypeScript Interface Extensions
```typescript
// Good pattern for extending interfaces
type DeadlineWithRegulation = Deadline & { regulationName?: string };
```

## Error Checking Commands

```bash
# Get current error count
npx eslint client/src --format=compact | grep -c "error"

# Get detailed error list
npx eslint client/src --format=compact

# Check server health
curl http://localhost:3000/api/health

# Start development server
npm run dev
```

## Server Health Verification

After each batch, verify:
1. **Server starts successfully** without transform errors
2. **Database connection** is established
3. **API endpoints respond** (check /api/health)
4. **No critical console errors** in browser
5. **Application loads** at localhost:3000

## Known Issues to Watch

1. **Transform Errors**: Check for syntax errors in TypeScript files
2. **Missing Exports**: Ensure all imports have corresponding exports
3. **Circular Dependencies**: Particularly in auth-related hooks
4. **React Fast Refresh**: Some changes may require full page reload

## Next Steps for Resume

1. **Check current error count** to confirm starting point
2. **Verify server is running** and healthy
3. **Search for unused imports** as easiest targets
4. **Focus on type safety improvements** in components
5. **Continue systematic approach** until 800-error milestone
6. **Push to GitHub** when milestone is reached

## User Preferences Applied

- [Continue without asking permission][[memory:26304341263656496]] - proceed with systematic approach
- [Check server health after every batch][[memory:7391773961581000073]] - verify stability
- [Push at 100-error milestones][[memory:6832516527283966100]] - maintain version control

## Technical Environment

- **OS**: macOS with zsh shell
- **Package Manager**: Homebrew
- **Node Version**: 24.1.0
- **Development Server**: Vite + Express
- **Database**: Neon PostgreSQL
- **Linting**: ESLint with TypeScript

## Success Metrics

- **Primary Goal**: Reach 800 errors (30% improvement from 899)
- **Quality Goal**: Maintain server stability throughout
- **Efficiency Goal**: Average 10+ errors reduced per batch
- **Safety Goal**: No breaking changes to application functionality 