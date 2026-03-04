# Civil Service Reform Act of 1978 MCP Server

An MCP (Model Context Protocol) server that provides access to information about the Civil Service Reform Act of 1978. This server enables LLMs and orchestrators to retrieve structured information about the Act, including key provisions, agencies created, legal requirements, and more.

## Overview

The Civil Service Reform Act of 1978 (Public Law 95-454) was a comprehensive reform of the federal civil service system that replaced the Civil Service Commission with the Office of Personnel Management, the Merit Systems Protection Board, and the Federal Labor Relations Authority.

This MCP server provides:
- Basic information about the Act
- Key provisions and their descriptions
- Agencies created by the Act
- Utility functions to extract requirements, summarize, and classify the regulation
- Related legal cases and their significance
- Access to the full text of the Act

## Installation

1. Ensure you have Node.js installed (v14+)
2. Clone this repository or download the source files
3. Install dependencies:
   ```
   npm install express cors body-parser axios
   ```

## Usage

### Starting the Server

Run the server with:

```
node civil-service-act-mcp-server.cjs
```

The server will start on port 3001 by default. You can modify the port by setting the `PORT` environment variable.

### Testing with the Client

A sample client is provided to test the MCP server:

```
node civil-service-act-client.cjs
```

### Endpoints

- **MCP JSON-RPC endpoint**: `http://localhost:3001/mcp`
- **Health check**: `http://localhost:3001/health`
- **API documentation**: `http://localhost:3001/api-docs`

## MCP Methods

This server supports the following MCP methods:

| Method | Description | Parameters |
|--------|-------------|------------|
| `initialize` | Initialize the connection | None |
| `getActInfo` | Get basic information about the Act | None |
| `getKeyProvisions` | Get key provisions of the Act | None |
| `getAgenciesCreated` | Get agencies created by the Act | None |
| `extractRequirements` | Extract requirements from text | `text` |
| `summarizeRegulation` | Summarize the regulation | `text` |
| `classifyRegulation` | Classify the regulation | `text` |
| `detectRegulationChanges` | Detect changes between versions | `oldText`, `newText` |
| `getRelatedCases` | Get related legal cases | None |
| `getFullText` | Get URL to full text | None |

## Sample Request

```javascript
// Example JSON-RPC request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getKeyProvisions",
  "params": {}
}
```

## Sample Response

```javascript
// Example JSON-RPC response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "provisions": [
      {
        "title": "Merit System Principles",
        "description": "Established nine merit system principles that federal personnel management should be based on."
      },
      // Additional provisions...
    ]
  }
}
```

## Integration with Orchestrators

This MCP server can be integrated with LLM orchestrators to provide specialized knowledge about the Civil Service Reform Act. Orchestrators can connect to this server to:

1. Retrieve factual information about the Act
2. Extract structured data about legal requirements
3. Access summaries and classifications
4. Get relevant legal case information

The server follows the MCP JSON-RPC specification, making it compatible with any MCP-compliant client.

## Data Sources

The current implementation uses a mock database with verified information about the Civil Service Reform Act. In a production environment, this could be extended to connect to authoritative legal databases.

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request. 