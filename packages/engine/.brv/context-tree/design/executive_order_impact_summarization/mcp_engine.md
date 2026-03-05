## EO Impact AI Summarization System - MCP Engine

Created AI-powered Executive Order impact summarization:

**Service Location**: `src/regulatory-sources/eo-impact-summarizer.js`

**API Endpoint**: `POST /api/regulations/:regKey/executive-orders/summarize`

**Usage**:
```javascript
import { EOImpactSummarizer } from './src/regulatory-sources/eo-impact-summarizer.js';
const summarizer = new EOImpactSummarizer({ anthropicApiKey: 'your-key' });
await summarizer.summarizeAllPending({ limit: 10 });
```

**CLI Commands**:
```bash
# Summarize all pending (no AI summary yet)
node src/regulatory-sources/eo-impact-summarizer.js --all 50

# Summarize specific EO-regulation pair
node src/regulatory-sources/eo-impact-summarizer.js --eo <eoId> <regId>

# Get EO impacts for a regulation
node src/regulatory-sources/eo-impact-summarizer.js --regulation <regId>
```

**Key Features**:
- Uses Claude (claude-sonnet-4-20250514) to analyze EO impact on specific regulations
- Stores AI summaries in `eo_regulation_impacts.impact_summary`
- Falls back to keyword-based summary if no API key
- Batch processing with 1-second rate limiting
- Confidence scoring (0.9 for AI, 0.7 for fallback)