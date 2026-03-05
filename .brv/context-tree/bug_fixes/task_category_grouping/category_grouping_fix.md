## Console Task Display - Category Grouping Fix (January 22, 2026)

### Problem
Title IX console showed 62 tasks as a flat list while Clery showed grouped tasks. The database had 41 tasks with NULL category values, and the console JavaScript only grouped by parentTaskId, not by category.

### Solution
1. **Database Fix**: Updated all 41 uncategorized Title IX tasks with proper categories based on CFR sections:
   - Athletics (§106.41): 6 tasks
   - Employment (§106.51-61): 6 tasks
   - Recordkeeping (§106.8): 5 tasks
   - Core Compliance: 9 tasks
   - Training: 5 tasks
   - + 10 more categories

2. **Console JavaScript Fix**: Updated `loadTasksDeadlines()` function in both Clery and Title IX consoles to:
   - First group tasks by `t.category` into a categories object
   - Sort categories alphabetically
   - Render each category with a blue gradient header showing category name and task count
   - Within each category, render tasks with priority badges and child task hierarchy

### Key Code Pattern
```javascript
const categories = {};
tasks.forEach(t => {
    const cat = t.category || 'Uncategorized';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(t);
});
const sortedCategories = Object.keys(categories).sort();
```

### Files Modified
- jeanne-clery-disclosure-of-campus-security-policy--console.html (lines ~4169-4210)
- title-ix-of-the-education-amendments-of-1972-console.html (lines ~4169-4210)