# TUF Integration for EdSteward

## Overview

EdSteward now supports The Update Framework (TUF) for cryptographically secure regulation delivery. This provides enterprise-grade security with tamper detection, rollback protection, and cryptographic verification using Ed25519 signatures and SHA-256 hashes.

## Architecture

```
MCP Engine (TUF Repository)     EdSteward
Port 3052 (HTTP)               Port 3000
Port 3053 (WebSocket)          
                               
┌─────────────┐                ┌─────────────┐
│ TUF Server  │────HTTP────────│ TUF Client  │
│             │                │             │
│ - root.json │                │ - Verify    │
│ - targets/  │                │ - Download  │
│ - metadata/ │                │ - Store     │
└─────────────┘                └─────────────┘
        │                               │
        └────WebSocket Notifications────┘
```

## Security Features

### Cryptographic Verification
- **Ed25519 Signatures**: All metadata is cryptographically signed
- **SHA-256 Hashes**: All regulation files have verifiable hashes
- **Rollback Protection**: Version numbers prevent downgrade attacks
- **Tamper Detection**: Hash mismatches are automatically detected

### Trust Model
- Root metadata contains trusted signing keys
- All updates must be signed by trusted keys
- Invalid signatures are rejected immediately
- Hash verification ensures file integrity

## API Endpoints

### TUF Health Check
```http
GET /api/tuf/health
```

Response:
```json
{
  "tufRepository": {
    "status": "ok",
    "timestamp": "2025-08-19T13:00:00.000Z"
  },
  "edstewardIntegration": {
    "status": "healthy",
    "timestamp": "2025-08-19T13:00:00.000Z"
  }
}
```

### Get Available Regulations
```http
GET /api/tuf/regulations
```

Response:
```json
{
  "regulations": [
    {
      "regulationId": "REG-66",
      "path": "regulations/REG-66.json",
      "hash": "62e2255593c2f50e...",
      "length": 261,
      "updateTime": "2025-08-19T13:00:00.000Z",
      "metadata": {...}
    }
  ],
  "count": 1,
  "source": "TUF",
  "timestamp": "2025-08-19T13:00:00.000Z"
}
```

### Download Specific Regulation
```http
GET /api/tuf/regulations/REG-66
```

Response:
```json
{
  "regulation": {
    "regulationId": "REG-66",
    "content": {...},
    "metadata": {...},
    "hash": "62e2255593c2f50e...",
    "updateTime": "2025-08-19T13:00:00.000Z",
    "verified": true,
    "tufPath": "regulations/REG-66.json"
  },
  "verified": true,
  "source": "TUF",
  "timestamp": "2025-08-19T13:00:00.000Z"
}
```

### Check for Updates
```http
GET /api/tuf/check-updates
```

Response:
```json
{
  "updates": [
    {
      "regulationId": "REG-66",
      "content": {...},
      "verified": true,
      "hash": "newHash123...",
      "updateTime": "2025-08-19T13:00:00.000Z"
    }
  ],
  "count": 1,
  "source": "TUF",
  "timestamp": "2025-08-19T13:00:00.000Z"
}
```

## Integration Payloads

### TUF-Verified Regulation Update
When sending TUF-verified content to `/api/regulation-updates`:

```json
{
  "regulationId": "REG-66",
  "verified": true,
  "hash": "62e2255593c2f50e...",
  "updateTime": "2025-08-19T13:00:00.000Z",
  "tufPath": "regulations/REG-66.json",
  "content": {...},
  "metadata": {...},
  "source": "tuf"
}
```

### Security Validation
EdSteward will:
1. ✅ Verify the `verified` field is `true`
2. ✅ Store cryptographic hash for audit trail
3. ✅ Mark as cryptographically verified in database
4. ❌ Reject any unverified content

## Frontend Integration

### TUF Status Component
The navigation bar displays real-time TUF repository status:

- 🛡️ **Green**: TUF repository healthy, X regulations available
- ⚠️ **Yellow**: TUF repository warning
- ❌ **Red**: TUF repository error or unreachable

### React Hook Usage
```typescript
import { useTUF } from '@/services/tuf-client';

function MyComponent() {
  const { getAvailableRegulations, downloadRegulation, getHealth } = useTUF();
  
  const handleDownload = async () => {
    try {
      const regulation = await downloadRegulation('REG-66');
      console.log('Downloaded verified regulation:', regulation);
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };
}
```

## Environment Variables

```bash
# Backend TUF Configuration
MCP_ENGINE_TUF_URL=http://localhost:3052
TUF_WEBSOCKET_URL=ws://localhost:3053
TUF_METADATA_DIR=./tuf-metadata
TUF_TARGETS_DIR=./tuf-targets

# Frontend TUF Configuration
VITE_TUF_REPOSITORY_URL=http://localhost:3052
```

## Error Handling

### Cryptographic Verification Failures
```javascript
try {
  const regulation = await downloadRegulation('REG-66');
} catch (error) {
  if (error.message.includes('hash mismatch')) {
    // File was tampered with
    console.error('SECURITY VIOLATION: File tampered with!', error);
  } else if (error.message.includes('signature')) {
    // Metadata signature invalid
    console.error('SECURITY VIOLATION: Invalid signature!', error);
  }
}
```

### Network Failures
```javascript
try {
  const health = await getHealth();
} catch (error) {
  console.error('TUF repository unreachable:', error);
  // Fall back to cached regulations or show warning
}
```

## Security Considerations

### Production Deployment
1. **Use HTTPS/TLS**: All TUF communication must use HTTPS
2. **Pin Certificates**: Pin TUF repository certificates
3. **Secure Storage**: Store trusted root metadata securely
4. **Regular Updates**: Keep TUF client libraries updated

### Audit Trail
EdSteward stores TUF-specific metadata for each regulation:
- `tufHash`: SHA-256 hash for verification
- `tufPath`: Original path in TUF repository
- `tufUpdateTime`: Timestamp from TUF metadata
- `cryptographicallyVerified`: Boolean flag

### Monitoring
- TUF status is displayed in real-time in the UI
- Health checks run every 30 seconds
- Failed verifications are logged as security events
- WebSocket notifications provide instant updates

## Testing

### Manual Testing
```bash
# Test TUF repository health
curl http://localhost:3000/api/tuf/health

# Get available regulations
curl http://localhost:3000/api/tuf/regulations

# Download specific regulation
curl http://localhost:3000/api/tuf/regulations/REG-66

# Check for updates
curl http://localhost:3000/api/tuf/check-updates
```

### Integration Testing
```bash
# Send TUF-verified regulation update
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": "REG-66",
    "verified": true,
    "hash": "abc123...",
    "updateTime": "2025-08-19T13:00:00.000Z",
    "tufPath": "regulations/REG-66.json",
    "content": {...},
    "source": "tuf"
  }'
```

## Migration Guide

### From Legacy MCP Engine
1. Update MCP Engine to support TUF repository on port 3052
2. Configure TUF WebSocket notifications on port 3053
3. Update environment variables to include TUF URLs
4. EdSteward will automatically detect and handle TUF-verified payloads

### Backward Compatibility
EdSteward maintains full backward compatibility:
- Legacy MCP Engine payloads continue to work
- Simple regulation update format still supported
- TUF integration is additive, not replacing existing functionality

## Troubleshooting

### Common Issues

**TUF Status Shows Error**
- Check MCP Engine TUF repository is running on port 3052
- Verify network connectivity
- Check console for detailed error messages

**Verification Failures**
- Ensure TUF repository metadata is properly signed
- Check that file hashes match TUF metadata
- Verify Ed25519 keys are correctly configured

**Performance Issues**
- TUF verification adds cryptographic overhead
- Consider caching verified regulations
- Monitor memory usage for large regulation files

### Debug Logging
Enable detailed TUF logging by checking browser console for:
- `🔒 Initializing TUF client...`
- `✅ TUF client initialized successfully`
- `📥 Downloading regulation X with TUF verification...`
- `✅ Regulation X downloaded and verified successfully`

## Conclusion

TUF integration provides EdSteward with enterprise-grade security for regulation delivery, ensuring cryptographic verification, tamper detection, and rollback protection. The implementation is backward-compatible and adds minimal overhead while significantly enhancing security posture.
