## EdSteward Regulation Assignment Notifications (January 2026)

When a regulation is assigned to a user via the Primary DRI field, the system creates an in-app notification:

**Implementation in `server/routes/api/regulations.ts`:**
```typescript
router.patch("/:regulationId/owner", requireAuth, async (req, res) => {
  // ... update owner logic ...
  
  if (ownerValue !== null) {
    await tenantStorage.createNotificationQueueItem({
      regulationId: regulationId,
      userId: ownerValue,
      type: 'regulation_assigned',
      content: {
        title: 'You have been assigned a regulation',
        message: `${assignedByName} has assigned you as the Primary DRI for "${regulationName}".`,
        regulationId: regulationId,
        regulationName: regulationName,
        assignedBy: req.user?.id,
        assignedByName: assignedByName
      },
      status: 'pending',
      priority: 'high'
    });
  }
});
```

**Key Details:**
- Uses existing `notificationQueue` table and system
- Notification type: `regulation_assigned`
- Priority: `high`
- Shows assigner name and regulation name
- Appears in user's notifications on next login