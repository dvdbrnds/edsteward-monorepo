EdSteward Regulation Updates List Enhancement - Ordering & Bulk Delete

COMPLETED: Fixed regulation updates list ordering (newest to oldest) and added bulk delete functionality for testing.

## Changes Made:

### Backend (server/storage.ts):
1. **Fixed Ordering**: Updated `getPendingRegulationUpdates()` to order by newest first:
   ```typescript
   return await db.select().from(regulationUpdates)
     .where(eq(regulationUpdates.status, "pending"))
     .orderBy(desc(regulationUpdates.updateDate)); // Added desc ordering
   ```

2. **Added Bulk Delete Method**: 
   ```typescript
   async bulkDeleteRegulationUpdates(ids: number[]): Promise<void> {
     const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
     await pool.query(
       `DELETE FROM regulation_updates WHERE id IN (${placeholders})`,
       ids
     );
   }
   ```

3. **Updated Interface**: Added `bulkDeleteRegulationUpdates(ids: number[]): Promise<void>` to IStorage interface

### Backend API (server/regulation-updates-api.ts):
4. **Bulk Delete Endpoint**: Added `DELETE /api/regulation-updates/bulk` with:
   - Array validation for IDs
   - Authentication required (admin/compliance_officer only)
   - Returns count of deleted items
   - Proper error handling

### Frontend (client/src/pages/updates-list-page.tsx):
5. **Bulk Selection UI**: Added checkboxes to each update card
6. **Select All/None**: Master checkbox with indeterminate state
7. **Bulk Actions Bar**: Shows when items selected with delete button
8. **Bulk Delete Mutation**: Uses React Query for optimistic updates
9. **Testing Mode Badge**: Clear indication this is for testing
10. **Confirmation Dialog**: Prevents accidental deletions

## Features:
- ✅ **Newest First Ordering**: Updates now show in chronological order (newest to oldest)
- ✅ **Individual Selection**: Checkbox on each update card
- ✅ **Select All/None**: Master checkbox with proper indeterminate state
- ✅ **Bulk Delete**: Delete multiple updates at once for testing
- ✅ **Authentication**: Only admins/compliance officers can bulk delete
- ✅ **Confirmation**: Prevents accidental deletions
- ✅ **Real-time Updates**: List refreshes after bulk operations
- ✅ **Testing Badge**: Clear indication of testing functionality

## Security:
- Only authenticated users with admin/compliance_officer roles can bulk delete
- Confirmation dialog prevents accidental operations
- Proper error handling and user feedback
- SQL injection protection with parameterized queries

The updates list now provides a much better testing experience with proper ordering and efficient bulk management capabilities.