# Internal Operations Suite Implementation

## Complete Internal Business Tool Features

Built for a bespoke internal tool to manage 10,000+ athletic association contacts with API access, bulk import, and cost tracking.

## 1. API Key Management System

### Backend (`apiKeyController.ts`, `apiKeyRoutes.ts`)

```typescript
// Generate secure API key
function generateApiKey(): string {
  const prefix = 'aa_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
}

// API key authentication middleware
export const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const keyRecord = await prisma.apiKey.findUnique({ where: { key: apiKey } });
  
  // Check active, not expired, user active
  if (!keyRecord?.isActive || keyRecord.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.user = keyRecord.createdBy;
  req.apiKey = keyRecord;
  next();
};

// Log API requests automatically
export const logApiRequest = async (req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    prisma.apiLog.create({
      data: {
        apiKeyId: req.apiKey.id,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
      },
    });
  });
  next();
};
```

### Frontend (`ApiKeys.tsx`)

```typescript
// Create API key
const createMutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.post('/api-keys', data);
    return response.data.data;
  },
  onSuccess: (data) => {
    setNewApiKey(data.key); // Show key once
    // Warning: Save this key! You won't see it again
  },
});

// Copy key to clipboard
const handleCopyKey = (key: string) => {
  navigator.clipboard.writeText(key);
};
```

## 2. Contact Import System

### Backend (`importController.ts`, `importRoutes.ts`)

```typescript
// Upload and parse file
export const uploadFile = async (req, res) => {
  const file = req.file; // multer
  const extension = file.originalname.split('.').pop();
  
  let headers = [];
  let previewData = [];
  
  if (extension === 'csv') {
    // Parse CSV with csv-parser
    await new Promise((resolve) => {
      Readable.from(file.buffer)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve);
    });
  } else {
    // Parse Excel with xlsx
    const workbook = xlsx.read(file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(sheet);
  }
  
  // Create import record
  const importRecord = await prisma.import.create({
    data: {
      fileName: file.originalname,
      totalRows: previewData.length,
      status: 'PENDING',
    },
  });
  
  res.json({ importId, headers, previewData });
};

// Start import with field mapping
export const startImport = async (req, res) => {
  const { importId, fieldMapping, skipDuplicates } = req.body;
  
  // Update status to PROCESSING
  await prisma.import.update({
    where: { id: importId },
    data: { status: 'PROCESSING', fieldMapping },
  });
  
  // Process in background
  processImport(importId, fieldMapping, skipDuplicates, req.user.id)
    .catch(err => logger.error('Import failed:', err));
  
  res.json({ message: 'Import started' });
};

// Background processing
async function processImport(importId, fieldMapping, skipDuplicates, userId) {
  const rows = await parseFile(importId);
  
  for (let i = 0; i < rows.length; i++) {
    const mappedData = mapFields(rows[i], fieldMapping);
    
    // Check duplicates
    if (skipDuplicates && mappedData.primaryEmail) {
      const exists = await prisma.contact.findFirst({
        where: { primaryEmail: mappedData.primaryEmail },
      });
      if (exists) continue;
    }
    
    // Create contact
    await prisma.contact.create({ data: mappedData });
    
    // Update progress every 100 rows
    if ((i + 1) % 100 === 0) {
      await prisma.import.update({
        where: { id: importId },
        data: { processedRows: i + 1 },
      });
    }
  }
  
  // Mark complete
  await prisma.import.update({
    where: { id: importId },
    data: { status: 'COMPLETED' },
  });
}
```

### Frontend (`ContactImport.tsx`)

```typescript
// 3-step wizard
const steps = ['Upload File', 'Map Fields', 'Review & Import'];

// Step 1: Upload
<input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />

// Step 2: Map fields
{headers.map(header => (
  <Select
    value={fieldMapping[header]}
    onChange={(e) => setFieldMapping({ ...fieldMapping, [header]: e.target.value })}
  >
    <MenuItem value="firstName">First Name *</MenuItem>
    <MenuItem value="primaryEmail">Primary Email *</MenuItem>
    // ... more fields
  </Select>
))}

// Step 3: Progress tracking
const { data: importStatus } = useQuery({
  queryKey: ['import-status', importId],
  queryFn: () => api.get(`/imports/${importId}`),
  refetchInterval: (data) => data?.status === 'PROCESSING' ? 2000 : false,
});

<LinearProgress 
  value={(importStatus.processedRows / importStatus.totalRows) * 100} 
/>
```

## 3. Cost Tracking System

### Backend (`costTrackingService.ts`)

```typescript
const SERVICE_COSTS = {
  ZEROBOUNCE: { verification: 0.008 },
  SENDGRID: { email: 0.001 },
  OPENAI: { 'gpt-3.5-turbo': 0.002 },
  GOOGLE_SEARCH: { query: 0.005 },
};

// Log cost
export async function logCost({ service, operation, quantity, metadata }) {
  const cost = SERVICE_COSTS[service][operation] * quantity;
  
  await prisma.costTracking.create({
    data: { service, operation, cost, quantity, metadata },
  });
  
  // Update monthly summary
  const now = new Date();
  await prisma.monthlyCost.upsert({
    where: { year_month_service: { year, month, service } },
    update: {
      totalCost: { increment: cost },
      totalQuantity: { increment: quantity },
    },
    create: { year, month, service, totalCost: cost, totalQuantity: quantity },
  });
}

// Get cost summary
export async function getCostSummary(startDate, endDate) {
  const totalCost = await prisma.costTracking.aggregate({
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { cost: true },
  });
  
  const costByService = await prisma.costTracking.groupBy({
    by: ['service'],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { cost: true, quantity: true },
  });
  
  return { totalCost, costByService };
}

// Project costs
export async function getCostProjection() {
  const daysPassed = new Date().getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyAverage = currentCost / daysPassed;
  const projectedCost = currentCost + (dailyAverage * (daysInMonth - daysPassed));
  
  return { currentMonthCost: currentCost, projectedMonthCost: projectedCost };
}
```

### Integration Example

```typescript
// In verificationService.ts
import { logCost } from './costTrackingService';

export async function verifyBulkEmails(emails: string[]) {
  // Verify with ZeroBounce
  const results = await zeroBounceApi.verify(emails);
  
  // Log cost
  await logCost({
    service: 'ZEROBOUNCE',
    operation: 'verification',
    quantity: emails.length,
    metadata: { batchId: 'abc123' },
  });
  
  return results;
}

// In emailService.ts
import { logCost } from './costTrackingService';

export async function sendCampaign(campaign, recipients) {
  // Send with SendGrid
  await sendgrid.send(emails);
  
  // Log cost
  await logCost({
    service: 'SENDGRID',
    operation: 'email',
    quantity: recipients.length,
    metadata: { campaignId: campaign.id },
  });
}
```

### Frontend (`CostTracking.tsx`)

```typescript
// Fetch dashboard
const { data } = useQuery({
  queryKey: ['cost-dashboard', days],
  queryFn: () => api.get(`/costs/dashboard?days=${days}`),
});

// Display charts
<LineChart data={summary.dailyCosts}>
  <Line dataKey="cost" stroke="#8884d8" />
</LineChart>

<PieChart>
  <Pie data={summary.costByService} dataKey="cost" nameKey="service" />
</PieChart>

// Projection card
<Card>
  <Typography>Projected Month: ${projection.projectedMonthCost}</Typography>
  <Typography>Based on ${projection.dailyAverage}/day average</Typography>
</Card>
```

## 4. Webhook System

### Backend (`webhookController.ts`)

```typescript
// Trigger webhook
export async function triggerWebhook(event: string, payload: any) {
  const webhooks = await prisma.webhook.findMany({
    where: { isActive: true, events: { has: event } },
  });
  
  for (const webhook of webhooks) {
    deliverWebhook(webhook, event, payload);
  }
}

// Deliver with signature
async function deliverWebhook(webhook, event, payload) {
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  await axios.post(webhook.url, payload, {
    headers: {
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
    },
  });
  
  // Log delivery
  await prisma.webhookDelivery.create({
    data: { webhookId: webhook.id, event, payload, success: true },
  });
}
```

## Database Schema Additions

```prisma
model ApiKey {
  id          String   @id @default(uuid())
  name        String
  key         String   @unique
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  isActive    Boolean  @default(true)
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  apiLogs     ApiLog[]
}

model Import {
  id            String       @id @default(uuid())
  fileName      String
  totalRows     Int
  processedRows Int          @default(0)
  successCount  Int          @default(0)
  errorCount    Int          @default(0)
  status        ImportStatus @default(PENDING)
  fieldMapping  Json?
  errors        Json?
  createdById   String
  createdBy     User         @relation(fields: [createdById], references: [id])
}

model CostTracking {
  id        BigInt   @id @default(autoincrement())
  service   String
  operation String
  cost      Decimal  @db.Decimal(10, 4)
  quantity  Int
  metadata  Json?
  createdAt DateTime @default(now())
}

model MonthlyCost {
  id            String   @id @default(uuid())
  year          Int
  month         Int
  service       String
  totalCost     Decimal  @db.Decimal(10, 2)
  totalQuantity Int
  @@unique([year, month, service])
}
```

## API Endpoints Summary

```
# API Keys
GET    /api/v1/api-keys          - List keys
POST   /api/v1/api-keys          - Create key (ADMIN/MANAGER)
DELETE /api/v1/api-keys/:id      - Delete key

# Imports
POST   /api/v1/imports/upload    - Upload file
POST   /api/v1/imports/start     - Start import
GET    /api/v1/imports/:id       - Get import status

# Costs
GET    /api/v1/costs/dashboard   - Dashboard (ADMIN/MANAGER)
GET    /api/v1/costs/report      - Report (ADMIN/MANAGER)

# Webhooks
GET    /api/v1/webhooks          - List webhooks
POST   /api/v1/webhooks          - Create webhook (ADMIN/MANAGER)
DELETE /api/v1/webhooks/:id      - Delete webhook
```

## Menu Navigation

```typescript
const menuItems = [
  { text: 'Import', icon: <ImportIcon />, path: '/import' },
  { text: 'API Keys', icon: <KeyIcon />, path: '/api-keys', roles: ['ADMIN', 'MANAGER'] },
  { text: 'Cost Tracking', icon: <MoneyIcon />, path: '/costs', roles: ['ADMIN', 'MANAGER'] },
];
```