EdSteward customer frontend improvements (Jan 2026): 

1. Mobile responsiveness: Added responsive layouts to home-page.tsx (card heights, trustees card stacking), RegulationDetailPage.tsx (pending updates banner), admin-settings-page.tsx (flexible wrapping tabs).

2. Search/filter improvements in regulation-list.tsx: Added StatusFilter type with 'all' | 'overdue' | 'upcoming' | 'no-deadlines', getRegulationDeadlineStatus() helper, clear search button, filter count display, "Clear filters" option.

3. Agency submission logic: Created POST /api/regulations/:id/submit-to-agency endpoint in server/routes/api/regulations.ts. Updates agency_submission action to 'completed', logs to audit trail via AuditService. Frontend submission-wizard.tsx now calls this real API instead of simulating.

4. Removed vendor admin components: tenant-feature-manager.tsx, admin-feature-management-page.tsx, and their lazy component references. Vendor admin belongs in admin-console or MCP Engine, not customer frontend.