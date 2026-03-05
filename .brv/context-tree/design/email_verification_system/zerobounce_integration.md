**Athletic Association Platform - Complete Email Verification System with ZeroBounce**

Built comprehensive email verification system with ZeroBounce API integration, bulk verification, credit tracking, and automated status updates.

## Backend Implementation

### Verification Service (`backend/src/services/verificationService.ts`):
```typescript
// Single email verification
export const verifyEmail = async (email: string): Promise<VerificationResult> => {
  const params = new URLSearchParams({
    api_key: ZEROBOUNCE_API_KEY,
    email,
    ip_address: '',
  });
  
  const response = await axios.get(
    `${ZEROBOUNCE_API_URL}/validate?${params.toString()}`,
    { timeout: 30000 }
  );
  
  return { ...response.data, credits_used: 1 };
};

// Bulk verification with rate limiting
export const verifyBulkEmails = async (emails: string[]): Promise<BulkVerificationResult[]> => {
  const batchSize = 100;
  const delayMs = 1000; // 1 second between batches
  
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchPromises = batch.map(email => verifyEmail(email));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

// Status mapping
export const mapToEmailStatus = (status: string): 'VALID' | 'BOUNCED' | 'UNVERIFIED' => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'valid' || statusLower === 'catch-all') return 'VALID';
  if (['invalid', 'spamtrap', 'abuse', 'do_not_mail'].includes(statusLower)) return 'BOUNCED';
  return 'UNVERIFIED';
};

// Credit tracking
export const getCredits = async (): Promise<number> => {
  const response = await axios.get(
    `${ZEROBOUNCE_API_URL}/getcredits?api_key=${ZEROBOUNCE_API_KEY}`
  );
  return parseInt(response.data.Credits, 10) || 0;
};
```

### Verification Controller (`backend/src/controllers/verificationController.ts`):
```typescript
// Verify contacts by filter
export const verifyByFilter = async (req, res) => {
  const filters = req.body;
  const where: any = { isActive: true, emailStatus: 'UNVERIFIED' };
  
  if (filters.state) where.state = filters.state;
  if (filters.county) where.county = { contains: filters.county };
  if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
  
  // Get contacts (limit 1000)
  const contacts = await prisma.contact.findMany({ where, take: 1000 });
  
  // Verify emails
  const emails = contacts.map(c => c.primaryEmail);
  const results = await verifyBulkEmails(emails);
  
  // Update contacts
  const updatePromises = results.map((result, index) => {
    const emailStatus = mapToEmailStatus(result.status);
    return prisma.contact.update({
      where: { id: contacts[index].id },
      data: { emailStatus, emailVerifiedDate: new Date(), updatedById: userId }
    });
  });
  await Promise.all(updatePromises);
  
  const stats = getVerificationStats(results);
  res.json({ message: `Successfully verified ${contacts.length} contacts`, data: stats });
};

// Preview verification
export const previewVerification = async (req, res) => {
  const filters = req.body;
  const where: any = { isActive: true, emailStatus: 'UNVERIFIED' };
  // Apply filters...
  const count = await prisma.contact.count({ where });
  res.json({ data: { count, estimatedCredits: count } });
};
```

## Frontend Implementation

### Verification Page (`frontend/src/pages/Verification.tsx`):

**Credits Display Card:**
```tsx
<Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.light' }}>
  <Grid container spacing={3}>
    <Grid item xs={12} md={6}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <CreditIcon sx={{ fontSize: 48 }} />
        <Box>
          <Typography variant="h3">{credits.remaining.toLocaleString()}</Typography>
          <Typography>Credits Remaining</Typography>
        </Box>
      </Box>
    </Grid>
    <Grid item xs={12} md={6}>
      <Typography variant="h6">Usage This Month</Typography>
      <Typography>{credits.usedThisMonth.toLocaleString()} credits used</Typography>
      <LinearProgress value={(credits.usedThisMonth / total) * 100} />
    </Grid>
  </Grid>
</Paper>
```

**Statistics Cards:**
1. Valid Emails - Count with valid rate progress bar
2. Bounced Emails - Count with bounced rate progress bar
3. Unverified - Count needing verification
4. Recently Verified - Last 30 days count

**Bulk Verification Interface:**
```tsx
// Filters
<TextField select label="State" value={state} onChange={e => setState(e.target.value)}>
  {US_STATES.map(s => <MenuItem value={s}>{s}</MenuItem>)}
</TextField>
<TextField label="County" value={county} onChange={e => setCounty(e.target.value)} />
<TextField select label="Verification Status" value={verificationStatus}>
  <MenuItem value="NEEDS_VERIFICATION">Needs Verification</MenuItem>
</TextField>

// Preview & Verify
<Button onClick={handlePreview}>Preview & Verify</Button>
```

**Confirmation Dialog:**
```tsx
<Dialog open={verificationDialogOpen}>
  <DialogTitle>Confirm Bulk Verification</DialogTitle>
  <DialogContent>
    <Alert severity="warning">
      <Typography>This will verify {previewCount} contacts</Typography>
      <Typography>Estimated credits: {estimatedCredits}</Typography>
      <Typography>Credits remaining after: {credits.remaining - estimatedCredits}</Typography>
    </Alert>
    
    {/* Show filters applied */}
    {credits.remaining < estimatedCredits && (
      <Alert severity="error">Insufficient credits!</Alert>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={handleVerify} disabled={credits.remaining < estimatedCredits}>
      Start Verification
    </Button>
  </DialogActions>
</Dialog>
```

## ZeroBounce API Integration

**Status Mapping:**
- `valid`, `catch-all` → VALID (safe to send)
- `invalid`, `spamtrap`, `abuse`, `do_not_mail` → BOUNCED (do not send)
- `unknown` → UNVERIFIED (could not verify)

**Rate Limiting:**
- Process 100 emails per batch
- 1 second delay between batches
- Respects API rate limits

**Credit System:**
- 1 credit per validation
- Track usage monthly
- Display remaining credits
- Warn if insufficient credits

## API Endpoints

**GET /api/v1/verification/dashboard**
- Returns: statistics (total, valid, bounced, unverified) and credits info

**POST /api/v1/verification/preview**
- Body: { state?, county?, verificationStatus? }
- Returns: { count, estimatedCredits, message }

**POST /api/v1/verification/single**
- Body: { contactId }
- Verifies single contact email
- Returns: { status, emailStatus, isValid, details }

**POST /api/v1/verification/bulk**
- Body: { contactIds: string[] }
- Verifies multiple selected contacts
- Returns: { total, valid, invalid, unknown, errors, creditsUsed, results }

**POST /api/v1/verification/by-filter** (MANAGER, ADMIN)
- Body: { state?, county?, verificationStatus? }
- Verifies all unverified contacts matching filters (max 1000)
- Returns: { total, valid, invalid, unknown, creditsUsed }

**GET /api/v1/verification/credits**
- Returns: { remaining, usedThisMonth, apiKeyValid }

**GET /api/v1/verification/test** (ADMIN)
- Tests ZeroBounce API configuration
- Returns: { apiKeyValid, creditsAvailable }

## Configuration

**Required Environment Variable:**
```bash
# backend/.env
ZEROBOUNCE_API_KEY=your_api_key_here
```

**Get API Key:**
- Sign up at https://www.zerobounce.net/
- Free tier: 100 validations/month
- Paid plans for higher volume

## Usage Example

```typescript
// Preview verification
POST /api/v1/verification/preview
{ "state": "CA", "verificationStatus": "NEEDS_VERIFICATION" }
// Response: { "count": 247, "estimatedCredits": 247 }

// Verify filtered contacts
POST /api/v1/verification/by-filter
{ "state": "CA", "verificationStatus": "NEEDS_VERIFICATION" }
// Response: { "total": 247, "valid": 210, "invalid": 30, "unknown": 7 }

// Check credits
GET /api/v1/verification/credits
// Response: { "remaining": 753, "usedThisMonth": 247, "apiKeyValid": true }
```

## Benefits

1. **Reduce Bounce Rates** - Remove invalid emails before sending
2. **Protect Sender Reputation** - Avoid spam traps and abuse addresses
3. **Improve Deliverability** - Higher inbox placement rates
4. **Save Money** - Don't waste campaign credits on invalid emails
5. **Maintain Clean Database** - Keep contacts up-to-date
6. **Compliance** - Follow email best practices

This provides a complete email verification system integrated with ZeroBounce for production use.