EdSteward UX/UI Improvements Session - December 7, 2025

Major changes made to the Regulation Detail Page:

1. **Duplicate Content Fix**: Removed duplicate Notes & Comments section from right sidebar - now only appears in left column

2. **Markdown Rendering**: Added `marked` library to render markdown in Summary, Requirements, and Full Text sections. Previously showed raw markdown syntax like `###` and `**`.

3. **Debug UI Removal**: Removed yellow debug border and "📋 Regular User - Basic Timeline" text from non-admin timeline view

4. **Cleaned Up Meta-Text**: Removed "Admin Tools" instructional text from Additional Details card

5. **Removed Redundancy**: Removed duplicate "Action Required" card from bottom of sidebar (info already shown in Deadlines and Compliance Status)

6. **Improved Empty States**: All empty states now have consistent design with:
   - Colored icons in soft circular backgrounds
   - Gradient backgrounds (gray to white)
   - Dashed borders
   - Helpful guidance text

7. **Escalation Feature**: 
   - Added `responsible_office` and `escalation_target` columns to regulations
   - Auto-assigned 355 regulations to 19 institutional offices
   - Mapped offices to supervisor escalation targets (VPs)
   - Created EscalateIssueDialog component with:
     - Auto-detection of compliance issues (missing attestations, overdue deadlines)
     - Auto-suggested urgency levels
     - Email preview before sending
     - Optional CC to field office
     - Audit trail logging

8. **Default Deadlines**:
   - Added October 31 (Halloween) as default compliance review deadline
   - 236 regulations received default deadlines
   - All 355 regulations now have deadlines
   - Orange/pumpkin visual theme for default deadlines
   - `is_default` and `description` columns added to deadlines table