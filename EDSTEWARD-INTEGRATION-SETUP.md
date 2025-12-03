# 🔗 **EdSteward Integration Setup Guide**

## **Issue Identified**
The MCP Engine regulation updates are not appearing in EdSteward because of a **missing authentication configuration**.

## **✅ Problem Fixed**
1. **ES Module Error**: Fixed `require is not defined` error in `edsteward-integration.js` (line 280)
2. **Authentication Missing**: EdSteward requires Basic Auth credentials that aren't configured

## **🔧 Current Status**
- ✅ **EdSteward Server**: Running on `http://localhost:3000`
- ✅ **MCP Engine Services**: All operational
- ✅ **API Endpoint**: `/api/regulation-updates` exists and responding
- ❌ **Authentication**: Missing credentials (HTTP 401 error)

## **📋 Required Action**

### **Step 1: Get EdSteward Credentials**
You need to provide the EdSteward authentication credentials. Check your EdSteward configuration for:
- Username/Password (for Basic Auth)
- OR API Key (for Bearer Token)

### **Step 2: Configure MCP Engine**
Update the `.env.edsteward` file with your actual credentials:

```bash
# Option A: Basic Authentication
export EDSTEWARD_USERNAME="your_actual_username"
export EDSTEWARD_PASSWORD="your_actual_password"

# Option B: API Key (alternative)
export EDSTEWARD_API_KEY="your_actual_api_key"
```

### **Step 3: Load Environment Variables**
```bash
# Load the EdSteward configuration
source .env.edsteward

# Restart the MCP Engine delivery system
npm run start:delivery
```

## **🧪 Test Integration**
Once credentials are configured, test the integration:

```bash
# Trigger a regulation update
curl -X POST http://localhost:3051/api/trigger-update \
  -H "Content-Type: application/json" \
  -d '{"regulationId": "REG-66", "changeType": "TEST", "message": "Testing EdSteward integration"}'
```

**Expected Result**: 
- ✅ MCP Engine logs: "EdSteward update successful"
- ✅ EdSteward UI: New regulation update appears
- ✅ HTTP 200 response instead of HTTP 401

## **🔍 Troubleshooting**

### **If you see HTTP 401 errors:**
- Verify EdSteward username/password are correct
- Check if EdSteward uses API keys instead of Basic Auth
- Ensure credentials are loaded in environment variables

### **If you see "Connection refused":**
- Confirm EdSteward is running: `curl http://localhost:3000`
- Check if EdSteward is on a different port
- Verify firewall settings

### **If updates still don't appear:**
- Check EdSteward logs for incoming requests
- Verify the `/api/regulation-updates` endpoint implementation
- Test the endpoint manually with curl

## **📞 Next Steps**
1. **Provide EdSteward credentials** (username/password or API key)
2. **Update environment configuration**
3. **Restart MCP Engine delivery system**
4. **Test regulation update delivery**

The integration is ready to work once the authentication is properly configured!


