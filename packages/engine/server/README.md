# MCP Inspector Server

This server component provides API endpoints for launching and managing MCP Inspector instances.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

For development with auto-restart:
```bash
npm run dev
```

## API Endpoints

The server exposes the following endpoints:

### Launch MCP Inspector

```
POST /api/inspector/launch
```

Request body:
```json
{
  "serverId": "llm-gateway",
  "port": 3000,
  "serverType": "Gateway",
  "command": "npx @modelcontextprotocol/inspector node server.js --port=3000"
}
```

Response:
```json
{
  "success": true,
  "message": "MCP Inspector launched successfully",
  "serverId": "llm-gateway",
  "processId": 12345,
  "logFile": "/tmp/mcp-inspector-logs/inspector-llm-gateway-1234567890.log",
  "commandExecuted": "npx @modelcontextprotocol/inspector node server.js --port=3000"
}
```

### Check Inspector Status

```
GET /api/inspector/status/:processId
```

Response:
```json
{
  "success": true,
  "processId": "12345",
  "isRunning": true
}
```

### Terminate Inspector

```
DELETE /api/inspector/terminate/:processId
```

Response:
```json
{
  "success": true,
  "message": "MCP Inspector process 12345 terminated successfully",
  "processId": "12345"
}
```

## Usage with MCP Engine

This server is designed to work with the MCP Engine client-side application. The client will make API calls to this server to launch MCP Inspector instances for different MCP servers.

The server needs to be running for the "Launch MCP Inspector" feature to work in the client application. 

node start-all.js 