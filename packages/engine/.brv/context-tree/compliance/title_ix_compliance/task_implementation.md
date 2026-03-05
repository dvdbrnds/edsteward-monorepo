## Title IX Comprehensive Task Implementation (January 21, 2026)

### Database Consolidation
Title IX had 3 duplicate records in the database:
- ID 29: "Amendment" (typo), REG-003, 4 tasks - DEACTIVATED
- ID 57: "Amendments" (correct), REG-002, 62 tasks - CANONICAL
- ID 398: duplicate, no key, 21 tasks - DEACTIVATED

Fixed by setting `is_current = false` on IDs 29 and 398, keeping ID 57 as authoritative.

### Title IX Task Coverage (62 Total Tasks)
Based on thorough review of 34 CFR Part 106:

| Category | CFR Section | Tasks |
|----------|-------------|-------|
| Core Compliance | §106.8 | 25 |
| Athletics | §106.41 | 7 |
| Employment | §106.51-61 | 6 |
| Recordkeeping | §106.8 | 4 |
| Admissions | §106.21-23 | 3 |
| Pregnancy/Parental | §106.40 | 3 |
| Retaliation | §106.71 | 3 |
| Housing | §106.32 | 2 |
| Financial Aid | §106.37 | 2 |
| Counseling | §106.36 | 2 |
| Climate Assessment | - | 2 |
| Health/Education | §106.39, §106.31 | 3 |

### Key Roles and Task Distribution
- Title IX Coordinator: 26 tasks (15 critical)
- HR Director: 7 tasks
- Athletic Director: 6 tasks
- President/Chancellor: 4 tasks (all critical)
- Communications Director: 5 tasks
- Plus 9 other specialized roles

### Comparison
- Clery Act (REG-001): 39 tasks, 7 deadlines
- Title IX (REG-002): 62 tasks, 5 deadlines

Commit: 140a928