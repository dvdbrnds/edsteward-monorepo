## Evidence Hover Preview with Signature Display (Dec 17, 2025)

Added hover preview functionality for task evidence files with full signature tracking.

### HoverCard Implementation
```tsx
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

<HoverCard>
  <HoverCardTrigger asChild>
    <div className="cursor-pointer hover:bg-white transition-colors">
      {/* Evidence item summary */}
    </div>
  </HoverCardTrigger>
  <HoverCardContent align="start" className="w-80">
    {/* File Preview */}
    {evidence.fileUrl && (
      evidence.fileType?.startsWith('image/') ? (
        <img src={evidence.fileUrl} className="object-cover w-full h-full" />
      ) : evidence.fileType === 'application/pdf' ? (
        <iframe src={`${evidence.fileUrl}#toolbar=0&navpanes=0`} />
      ) : (
        <FileText className="h-10 w-10" />
      )
    )}
    {/* Signature Block */}
    <div className="bg-gray-50 rounded-md p-2">
      <p>{uploader.firstName} {uploader.lastName}</p>
      <p>{uploader.email}</p>
      <p>{format(new Date(evidence.uploadedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
    </div>
  </HoverCardContent>
</HoverCard>
```

### File Upload Race Condition Fix
The busboy file upload had a race condition where `file_url` was null because the async file write completed after the database record was saved:
```typescript
let fileWritePromise: Promise<void> | null = null;

bb.on('file', (_name, file, info) => {
  file.on('end', () => {
    fileWritePromise = (async () => {
      // Write file and set uploadedFileUrl
    })();
  });
});

bb.on('close', async () => {
  // Wait for file write to complete before resolving
  if (fileWritePromise) {
    await fileWritePromise;
  }
  resolve({ fileUrl: uploadedFileUrl, ... });
});
```

### Schema Note
Task evidence uses `uploadedAt` field (not `createdAt`) for the upload timestamp.