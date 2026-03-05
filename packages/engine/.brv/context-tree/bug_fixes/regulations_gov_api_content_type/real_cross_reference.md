## Fix: Regulations.gov API - Content-Type Detection

**Problem**: Regulations.gov API was returning "no_results" even though the API was working correctly.

**Root Cause**: The Regulations.gov API returns `Content-Type: application/vnd.api+json` (JSON:API format) instead of the standard `application/json`. The `fetchWithTimeout` function in `real-cross-reference.js` only checked for `application/json`, causing the response to be treated as raw text instead of JSON.

**Fix**: Updated the isJson detection in `fetchWithTimeout()` to handle both content types:
```javascript
const isJson = contentType.includes('application/json') || contentType.includes('application/vnd.api+json');
```

**File**: `src/llm-gateway/services/real-cross-reference.js`

**Lesson**: When integrating with external APIs, check the actual Content-Type header they return. JSON:API (vnd.api+json) is a common format for REST APIs.