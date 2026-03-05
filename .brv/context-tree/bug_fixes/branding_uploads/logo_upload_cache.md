EdSteward Branding Logo Upload Cache Fix (December 2025)

Fixed issue where logo/favicon uploads appeared successful but the preview didn't update.

**Root Cause:** Browser caching. The uploaded files always save to the same filename (`institution-logo.png`, `institution-favicon.png`), so the browser shows cached old images.

**Solution:** Added cache-busting timestamps to upload response URLs in `server/routes/api/uploads.ts`:

```typescript
const timestamp = Date.now();
results.logoUrl = `/assets/${logoFile.filename}?v=${timestamp}`;
results.faviconUrl = `/assets/${faviconFile.filename}?v=${timestamp}`;
```

This forces browsers to fetch fresh images after upload since the URL changes with each upload.