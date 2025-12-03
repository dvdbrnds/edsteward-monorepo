# EdSteward Authentication Fix

## Problem

You're getting regulation update toast notifications but no actual content showing up in EdSteward.

## Root Cause

EdSteward's `/api/regulation-updates` endpoint requires Basic Authentication, but the MCP Engine doesn't have credentials configured.

Error from EdSteward:
```json
{
  "error": "Basic Authentication required",
  "message": "MCP Engine integration requires Basic Auth with valid credentials"
}
```

## What's Happening

1. ✅ MCP Engine triggers update
2. ✅ WebSocket notifications sent to clients (toasts appear)
3. ❌ HTTP POST to EdSteward fails silently (no auth credentials)
4. ❌ EdSteward never receives the actual regulation content
5. ✅ You see toast, but no content update

## The Fix

You need to set EdSteward credentials as environment variables:

```bash
export EDSTEWARD_USERNAME="your_username"
export EDSTEWARD_PASSWORD="your_password"
```

Or create a `.env` file:

```bash
EDSTEWARD_URL=http://localhost:3000
EDSTEWARD_USERNAME=your_username
EDSTEWARD_PASSWORD=your_password
```

## Quick Test

After setting credentials, restart and test:

```bash
# Set credentials
export EDSTEWARD_USERNAME="admin"
export EDSTEWARD_PASSWORD="your_password_here"

# Restart MCP Engine
npm start

# Trigger update
curl -X POST http://localhost:3051/api/trigger-update \
  -H "Content-Type: application/json" \
  -d '{"regulationId":"technology-education-and-copyright-harmonization-a"}'
```

## Check EdSteward Logs

Look for successful POST in MCP Engine logs:
```
📤 EdSteward notified: Update ID [id]
```

Instead of:
```
❌ EdSteward notification failed: [error]
```

## What Credentials to Use?

Check with EdSteward what the MCP Engine integration credentials should be. You may need to create a service account in EdSteward specifically for MCP Engine integration.









