## Email Attestation Feature Implementation

Implemented one-click email attestation for low-risk regulations in EdSteward. This allows field compliance officers to attest to compliance directly from their email without logging in.

### Database Schema
```sql
-- New table for attestation tokens
CREATE TABLE attestation_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  attestation_type TEXT NOT NULL DEFAULT 'quarterly',
  attestation_statement TEXT NOT NULL,
  attestation_period TEXT,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_ip TEXT,
  used_user_agent TEXT,
  email_sent_at TIMESTAMP,
  email_sent_to TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Added to regulations table
ALTER TABLE regulations ADD COLUMN risk_level TEXT DEFAULT 'medium';
ALTER TABLE regulations ADD COLUMN email_attestation_enabled BOOLEAN DEFAULT false;
ALTER TABLE regulations ADD COLUMN attestation_frequency TEXT DEFAULT 'annual';
```

### API Endpoints (server/routes/api/attestation.ts)
- `POST /api/attestation/send` - Admin sends attestation request
- `GET /api/attestation/verify/:token` - Verify token (no auth - token is auth)
- `POST /api/attestation/confirm/:token` - Complete attestation (no auth)
- `GET /api/attestation/pending` - Admin view pending attestations
- `GET /api/attestation/history/:regulationId` - View attestation history

### Frontend Components
- `/attest/:token` - Public attestation confirmation page
- `SendAttestationDialog` - Admin dialog to send requests from regulation detail page

### Security
- Cryptographically secure tokens (32 bytes, base64url)
- 14-day expiration
- Single-use tokens
- IP and user agent logged for audit