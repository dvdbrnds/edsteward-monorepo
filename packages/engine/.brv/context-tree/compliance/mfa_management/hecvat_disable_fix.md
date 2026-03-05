Successfully implemented and fixed MFA disable functionality for HECVAT 4.0 compliance in EdSteward. Key implementation details:

**Frontend (client/src/components/features/mfa/mfa-setup.tsx):**
```typescript
const disableMfaMutation = useMutation({
  mutationFn: () => apiRequest('POST', '/api/mfa/disable', {}),
  onSuccess: () => {
    toast.success('MFA disabled successfully');
    queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
  },
  onError: (error: any) => {
    toast.error(`Disable Failed\n${JSON.stringify(error.response?.data || error.message)}`);
  }
});

// Added "Disable MFA" button with confirmation dialog
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">
      Disable MFA
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Disable Multi-Factor Authentication</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to disable MFA? This will reduce your account security.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => disableMfaMutation.mutate()}>
        Yes, Disable MFA
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Backend API (server/routes/api/mfa.ts):**
```typescript
router.post('/disable', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    await MFAService.disableMFA(userId);
    res.json({ success: true, message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('❌ Error disabling MFA:', error);
    res.status(500).json({ success: false, error: 'Failed to disable MFA' });
  }
});
```

**MFA Service (server/services/mfa.ts):**
```typescript
static async disableMFA(userId: number): Promise<void> {
  try {
    const storage = getDatabaseStorage(); // CRITICAL: Must call getDatabaseStorage()
    await storage.updateUser(userId, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
      mfaSetupAt: null,
    });
    console.log(`✅ MFA disabled for user ${userId}`);
  } catch (error) {
    console.error(`❌ Error disabling MFA for user ${userId}:`, error);
    throw error;
  }
}
```

**Critical Fix:** The initial implementation failed with `ReferenceError: storage is not defined` because the `disableMFA` method was trying to use a global `storage` variable. Fixed by calling `getDatabaseStorage()` to get the storage instance.

**Server restart required:** Changes to server-side code require full server restart, not just hot reload. Use `pkill -f "tsx server/index.ts"` and `lsof -ti:3000 | xargs kill -9` to ensure clean restart.

**HECVAT 4.0 Compliance:** This disable option satisfies HECVAT 4.0 requirements for MFA management, allowing users to disable MFA when needed while maintaining security through confirmation dialogs.