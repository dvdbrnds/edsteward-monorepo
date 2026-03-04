# MCP Regulation Server Registry

This system allows you to import XLSX files containing regulation data and automatically create Model Context Protocol (MCP) servers for each regulation. The registry manages the creation, starting, and stopping of these MCP servers.

## Architecture

The solution consists of several components:

1. **Regulation Registry Server** - A Node.js server that maintains a registry of all regulations and provides APIs to manage MCP servers
2. **Enhanced Regulation Uploader** - A React component that allows users to upload Excel files with regulation data
3. **Enhanced Regulation Manager** - A React component that displays registered regulations and allows users to manage MCP servers

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Start the registry server:
   ```
   node start-registry.js
   ```

3. Start the web application:
   ```
   cd src/client
   npm start
   ```

4. Navigate to the web interface at the displayed URL (typically http://localhost:PORT)

## Importing Regulations

1. Prepare an Excel file (.xlsx or .xls) with your regulation data
2. The Excel file should have columns for at least:
   - regulationId (or id, code)
   - name (or title)
   - description (optional)
   - version (optional)
   - Additional fields are also supported

3. Use the web interface to upload the file:
   - Drag and drop the file into the upload area
   - Review the parsed data before submitting
   - Click "Register Regulations with MCP" to register them

## Managing MCP Servers

Once regulations are registered, you can:

1. Start an MCP server for a specific regulation
2. Stop a running MCP server
3. View regulation details
4. Search for specific regulations

## API Endpoints

The registry server provides the following API endpoints:

- `GET /api/regulations` - Get all registered regulations
- `GET /api/regulations/:regulationId` - Get details of a specific regulation
- `POST /api/regulations` - Register new regulations
- `POST /api/regulations/:regulationId/start-server` - Start MCP server for a regulation
- `POST /api/regulations/:regulationId/stop-server` - Stop MCP server for a regulation
- `GET /api/regulations/:regulationId/server-status` - Get status of a regulation's MCP server

## Integrating with MCP Clients

MCP clients can connect to the regulation servers using the JSON-RPC 2.0 protocol at:

```
http://localhost:{PORT}/mcp
```

Where PORT is the dynamically assigned port for each regulation's MCP server.

## Regulation MCP Server Capabilities

Each regulation MCP server provides the following capabilities:

- `getRegulationInfo` - Get basic information about the regulation
- `getKeyProvisions` - Get key provisions of the regulation
- `getAgenciesCreated` - Get agencies created by the regulation
- `getFullText` - Get a URL to the full text of the regulation

## Duplicate Handling

The system automatically detects duplicate regulations by comparing regulation IDs and versions. If a regulation with the same ID and version already exists, it will be skipped during import. 