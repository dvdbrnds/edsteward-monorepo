# 🔗 AWS EdSteward Integration Setup Instructions

## What I Need From You (EdSteward AI)

I need to configure the local MCP Engine to send regulation updates to your AWS production deployment. Please provide the following information:

### 1. **Primary API Endpoint URL** ⭐ CRITICAL
```
What is your AWS production URL?
Examples:
- https://edsteward.your-domain.com
- https://your-app.us-east-1.elasticbeanstalk.com  
- https://abc123.execute-api.us-east-1.amazonaws.com
- https://your-alb-123456789.us-east-1.elb.amazonaws.com
```

### 2. **Regulation Updates API Endpoint** ⭐ CRITICAL
```
Does this endpoint exist and work?
POST {YOUR_AWS_URL}/api/regulation-updates

If not, what is the correct endpoint path for receiving regulation updates?
```

### 3. **Health Check Endpoint** 
```
What endpoint can I use to test if your AWS instance is running?
Examples:
- GET {YOUR_AWS_URL}/api/health
- GET {YOUR_AWS_URL}/health
- GET {YOUR_AWS_URL}/status
```

### 4. **Authentication Requirements**
```
Do I need any authentication to send updates?
- API Key? If so, what header name? (e.g., 'X-API-Key', 'Authorization')
- Bearer token?
- Basic auth?
- No authentication needed?
```

### 5. **WebSocket Support** (Optional)
```
Do you support WebSocket connections for real-time updates?
If yes, what's the WebSocket URL?
Examples:
- wss://your-aws-url.com/ws
- wss://your-aws-url.com/websocket
```

### 6. **Expected Payload Format**
```
What format do you expect for regulation updates?
The MCP Engine will send something like:

{
  "regulationId": 269,           // Master Key Field ID (1-354)
  "name": "Qualified Tuition Reductions",
  "originalContent": "old content...",
  "updatedContent": "new content...",
  "status": "pending",
  "metadata": {
    "source": "MCP_ENGINE",
    "timestamp": "2025-01-02T10:30:00Z",
    "mcpRegulationSlug": "qualified-tuition-reductions"
  }
}

Is this format correct, or do you need different field names?
```

## 🧪 Testing Instructions

Once you provide the URL, I will test the connection by running:

```bash
# Test 1: Health check
curl -X GET {YOUR_AWS_URL}/api/health

# Test 2: Regulation update
curl -X POST {YOUR_AWS_URL}/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 55,
    "name": "TEACH Act Test",
    "originalContent": "test old content",
    "updatedContent": "test new content", 
    "status": "pending"
  }'
```

## 🎯 What This Enables

Once configured, your AWS EdSteward will automatically receive:
- ✅ Real-time regulation updates from the local MCP Engine
- ✅ All 354 regulations properly mapped with Master Key Fields (1-354)
- ✅ Federal + Pennsylvania regulation coverage
- ✅ Enhanced LLM-generated summaries and requirements

## 🚨 Urgency Level

**HIGH PRIORITY** - This is needed for the management meeting and Moravian University deployment readiness.

---

**Please provide at minimum the AWS production URL so I can configure the integration immediately.**
