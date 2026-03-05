# Federal Register API Integration

## Overview

The MCP Engine has been enhanced with Federal Register API integration to provide comprehensive regulation data that combines CFR codified text with Federal Register implementation guidance, preambles, and regulatory context.

## Architecture

### Components

1. **FederalRegisterAPIClient** (`src/llm-gateway/federal-register-api-client.js`)
   - Interfaces with Federal Register API (https://www.federalregister.gov/api/v1)
   - Parses CFR citations and searches for related documents
   - Retrieves full Federal Register documents with preambles and context

2. **EnhancedRegulationProcessor** (`src/llm-gateway/enhanced-regulation-processor.js`)
   - Combines CFR text with Federal Register context
   - Extracts CFR citations from regulation text
   - Builds comprehensive regulation packages for EdSteward

3. **Enhanced CFR Endpoints** (`src/llm-gateway/simple-usc-gateway.js`)
   - New `/api/llm/cfr/enhanced/:regulationSlug` endpoint
   - Backward-compatible legacy endpoint enhancement
   - Federal Register integration toggle via query parameter

## Data Flow

```
CFR Regulation Request
        ↓
Extract CFR Citations (e.g., "37 CFR 201")
        ↓
Search Federal Register API
        ↓
Retrieve Related Documents & Context
        ↓
Combine CFR + Federal Register Content
        ↓
Enhanced Regulation Package → EdSteward
```

## API Endpoints

### Enhanced CFR Endpoint

```
GET /api/llm/cfr/enhanced/:regulationSlug?federal_register=true
```

**Parameters:**
- `regulationSlug`: Regulation identifier (e.g., 'teach-act')
- `federal_register`: Enable/disable Federal Register enhancement (default: true)

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "regulation": "37 CFR 201.40",
    "title": "Technology, Education and Copyright Harmonization Act (TEACH Act) of 2002",
    "source": "Code of Federal Regulations + Federal Register",
    "enhanced": true,
    "regulation_text": "# Enhanced regulation text with Federal Register context...",
    "summary": "Enhanced summary combining CFR and Federal Register insights...",
    "submission_guidelines": "Comprehensive compliance guidelines...",
    "requirements": ["Array of compliance requirements"],
    "source_attribution": "MCP Engine + Federal Register",
    "federal_register_enhancement": {
      "attempted": true,
      "successful": true,
      "contexts_found": 2,
      "cfr_citations_processed": ["37 CFR 201"],
      "total_documents_referenced": 15
    },
    "metadata": {
      "confidence": 95,
      "federal_register_enhanced": true,
      "source": "MCP Engine + Federal Register"
    }
  }
}
```

### Legacy CFR Endpoint (Enhanced)

```
GET /api/llm/cfr/teach-act?enhanced=true
```

The legacy endpoint now automatically redirects to the enhanced version for better data quality.

## EdSteward Integration

### Enhanced Payload Structure

EdSteward now receives enriched regulation updates with:

```json
{
  "regulationId": 4661,
  "name": "TEACH Act Enhanced",
  "originalContent": "Previous regulation text...",
  "updatedContent": "Enhanced regulation text with Federal Register context...",
  "status": "pending",
  "summary": "Enhanced summary...",
  "submission_guidelines": "Comprehensive guidelines...",
  "requirements": ["Enhanced requirements array"],
  "source_attribution": "MCP Engine + Federal Register",
  "federal_register_enhancement": {
    "successful": true,
    "cfr_citations_processed": ["37 CFR 201"],
    "total_documents_referenced": 15
  },
  "metadata": {
    "mcpEngineId": "REG-66",
    "enhanced": true,
    "federalRegisterEnhanced": true,
    "timestamp": "2025-09-10T..."
  }
}
```

## Federal Register API Integration

### CFR Citation Parsing

The system automatically extracts CFR citations from regulation text using multiple patterns:

- `34 CFR 668.14` → Title: 34, Part: 668
- `CFR Title 34, Part 99` → Title: 34, Part: 99
- `37 C.F.R. § 201` → Title: 37, Part: 201

### Document Search & Retrieval

1. **Search by CFR Citation**: Uses `conditions[cfr][title]` and `conditions[cfr][part]` parameters
2. **Document Retrieval**: Fetches full documents by document number
3. **Content Extraction**: Extracts preambles, implementation guidance, and regulatory context

### Enhanced Content Generation

The system builds comprehensive regulation packages including:

- **CFR Regulation Text**: Original codified requirements
- **Federal Register Context**: Preambles and implementation guidance
- **Regulatory History**: Timeline of related Federal Register documents
- **Key Provisions**: Extracted regulatory provisions and requirements
- **Implementation Guidance**: Practical compliance information

## Configuration

### Environment Variables

```bash
# Federal Register API (no authentication required)
FEDERAL_REGISTER_CACHE_DURATION=3600000  # 1 hour cache
FEDERAL_REGISTER_TIMEOUT=30000           # 30 second timeout
```

### Cache Configuration

- **Federal Register API Cache**: 1 hour (configurable)
- **Enhanced Processor Cache**: 30 minutes (configurable)
- **Automatic cache invalidation** for fresh data

## Testing

### Test Suite

Run the comprehensive test suite:

```bash
node test-federal-register-integration.js
```

**Test Coverage:**
- Federal Register API client functionality
- CFR citation parsing accuracy
- Enhanced regulation processing
- EdSteward payload compatibility
- End-to-end integration validation

### Manual Testing

1. **Test Enhanced Endpoint**:
   ```bash
   curl "http://localhost:3002/api/llm/cfr/enhanced/teach-act?federal_register=true"
   ```

2. **Test Legacy Endpoint**:
   ```bash
   curl "http://localhost:3002/api/llm/cfr/teach-act?enhanced=true"
   ```

3. **Disable Federal Register**:
   ```bash
   curl "http://localhost:3002/api/llm/cfr/enhanced/teach-act?federal_register=false"
   ```

## Supported Regulations

### Currently Enhanced

- **TEACH Act** (`teach-act`): 37 CFR 201.40 with Federal Register context

### Planned Enhancements

- **FERPA**: 34 CFR 99
- **Title IX**: 34 CFR 106
- **Clery Act**: 34 CFR 668
- **ADA**: 28 CFR 35

## Error Handling

### Graceful Degradation

- **Federal Register API Unavailable**: Falls back to CFR-only content
- **Network Timeouts**: Returns base regulation with error metadata
- **Invalid CFR Citations**: Logs warnings, continues processing
- **Document Retrieval Failures**: Processes available documents only

### Error Response Format

```json
{
  "federal_register_enhancement": {
    "attempted": true,
    "successful": false,
    "error": "Request timeout for Federal Register API",
    "fallback_used": true
  }
}
```

## Performance Considerations

### Caching Strategy

- **Multi-level caching**: Memory + persistent cache
- **Intelligent invalidation**: Based on document publication dates
- **Background refresh**: Proactive cache warming for popular regulations

### API Rate Limiting

- **Federal Register API**: No authentication required, reasonable rate limits
- **Request batching**: Efficient document retrieval
- **Timeout handling**: 30-second default timeout with retries

## Monitoring & Observability

### Logging

- **Federal Register API calls**: Request/response logging
- **Enhancement success rates**: Success/failure metrics
- **Performance metrics**: Response times and cache hit rates

### Health Checks

- **Federal Register API connectivity**: Periodic health checks
- **Cache performance**: Cache hit/miss ratios
- **Enhancement success rates**: Quality metrics

## Deployment

### Production Considerations

1. **Cache Configuration**: Tune cache durations for production load
2. **Timeout Settings**: Adjust timeouts based on network conditions
3. **Error Monitoring**: Set up alerts for enhancement failures
4. **Performance Monitoring**: Track response times and success rates

### Rollback Strategy

- **Feature Toggle**: Disable Federal Register enhancement via query parameter
- **Legacy Endpoint**: Maintains backward compatibility
- **Graceful Degradation**: Automatic fallback to CFR-only content

## Future Enhancements

### Planned Features

1. **Additional Regulations**: Expand to FERPA, Title IX, Clery Act, ADA
2. **Advanced Parsing**: Improved CFR citation extraction
3. **Content Summarization**: AI-powered content summarization
4. **Real-time Updates**: WebSocket notifications for Federal Register changes

### API Improvements

1. **Bulk Processing**: Batch enhancement for multiple regulations
2. **Custom Date Ranges**: Filter Federal Register documents by date
3. **Content Filtering**: Select specific Federal Register document types
4. **Export Formats**: PDF, Word, and other format exports

---

## Quick Start

1. **Start MCP Engine**: `npm start`
2. **Test Integration**: `node test-federal-register-integration.js`
3. **Use Enhanced Endpoint**: `GET /api/llm/cfr/enhanced/teach-act`
4. **Verify EdSteward**: Check enhanced payloads in EdSteward logs

The Federal Register integration provides comprehensive regulatory context that significantly enhances the value of regulation data sent to EdSteward, giving users complete regulatory context beyond basic CFR codification.

