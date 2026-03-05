/**
 * MCP Server for Regulatory Sources
 * Based on the MCP Protocol specification
 */

// Use package.json-based imports
import pkg from '@modelcontextprotocol/sdk';
const { Server } = pkg;
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const StdioTransport = require('@modelcontextprotocol/sdk/dist/esm/server/stdio.js').StdioTransport;
const SseTransport = require('@modelcontextprotocol/sdk/dist/esm/server/sse.js').SseTransport;

// Import mock data and handlers for now
// In production, these would connect to actual regulatory sources
const federalRegisterClient = {
  async fetchRegulationByDocumentNumber(documentNumber) {
    console.log(`Fetching regulation: ${documentNumber}`);
    return {
      documentNumber,
      title: `Regulation ${documentNumber}`,
      agency: "Department of Education",
      publicationDate: "2023-04-15",
      effectiveDate: "2023-07-01",
      full_text: `This is a mock regulation text for ${documentNumber}. It contains educational requirements and guidelines.`
    };
  },
  
  async fetchRegulations(params = {}) {
    console.log(`Fetching regulations with params:`, params);
    return [
      { documentNumber: "ED-2023-001", title: "Educational Compliance Standard A" },
      { documentNumber: "ED-2023-002", title: "Educational Compliance Standard B" }
    ];
  },
  
  async initialize() {
    return true;
  }
};

// Mock LLM processing functions
async function extractRequirements(text, options = {}) {
  console.log(`Extracting requirements from text (${text.length} chars)`);
  return [
    { id: "REQ-1", subject: "Schools", obligation: "Must provide equal access", criticality: "high" },
    { id: "REQ-2", subject: "Teachers", obligation: "Must be certified", criticality: "high" }
  ];
}

async function summarizeRegulation(text, options = {}) {
  console.log(`Summarizing regulation text (${text.length} chars)`);
  return {
    title: "Education Compliance Regulation",
    purpose: "To ensure educational institutions meet compliance standards",
    key_requirements: ["Equal access", "Certification requirements"]
  };
}

// Error codes
const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  DocumentNotFound: -31000,
  LLMProcessingError: -31001
};

// Create MCP server
const server = new Server({
  name: "regulatory-tools-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Define schemas for tools
const FetchRegulationSchema = {
  type: "object",
  properties: {
    documentNumber: {
      type: "string",
      description: "Document number to fetch"
    }
  },
  required: ["documentNumber"]
};

const ExtractRequirementsSchema = {
  type: "object",
  properties: {
    documentNumber: {
      type: "string",
      description: "Document number to analyze"
    },
    text: {
      type: "string",
      description: "Regulation text to analyze"
    },
    progressToken: {
      type: "string",
      description: "Progress reporting token"
    }
  },
  oneOf: [
    { required: ["documentNumber"] },
    { required: ["text"] }
  ]
};

const SummarizeRegulationSchema = {
  type: "object",
  properties: {
    documentNumber: {
      type: "string",
      description: "Document number to summarize"
    },
    text: {
      type: "string",
      description: "Regulation text to summarize"
    },
    progressToken: {
      type: "string",
      description: "Progress reporting token"
    }
  },
  oneOf: [
    { required: ["documentNumber"] },
    { required: ["text"] }
  ]
};

// Define handler helpers
function createProgressReporter(extra, progressToken) {
  if (!progressToken || !extra || !extra.reportProgress) {
    return null;
  }
  
  return (progress) => {
    extra.reportProgress({
      token: progressToken,
      value: {
        message: progress.message || "",
        percentage: progress.percent || 0,
        total: 100
      }
    });
  };
}

async function getRegulationText(params, progressReporter) {
  if (params.text) {
    return params.text;
  }
  
  if (params.documentNumber) {
    try {
      if (progressReporter) {
        progressReporter({ percent: 20, message: "Fetching regulation..." });
      }
      
      const regulation = await federalRegisterClient.fetchRegulationByDocumentNumber(params.documentNumber);
      
      if (progressReporter) {
        progressReporter({ percent: 80, message: "Regulation fetched successfully" });
      }
      
      return regulation.full_text;
    } catch (error) {
      throw {
        code: ErrorCode.DocumentNotFound,
        message: `Could not retrieve regulation ${params.documentNumber}: ${error.message}`
      };
    }
  }
  
  throw {
    code: ErrorCode.InvalidParams,
    message: "Either text or documentNumber must be provided"
  };
}

// Register handlers
server.setRequestHandler("fetchRegulation", FetchRegulationSchema, async (params, extra) => {
  try {
    const regulation = await federalRegisterClient.fetchRegulationByDocumentNumber(params.documentNumber);
    return { success: true, regulation };
  } catch (error) {
    return {
      success: false,
      error: {
        code: ErrorCode.DocumentNotFound,
        message: `Regulation not found: ${params.documentNumber}`
      }
    };
  }
});

server.setRequestHandler("extractRequirements", ExtractRequirementsSchema, async (params, extra) => {
  try {
    const progressReporter = createProgressReporter(extra, params.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 10, message: "Starting requirements extraction" });
    }
    
    const text = await getRegulationText(params, progressReporter);
    
    if (progressReporter) {
      progressReporter({ percent: 40, message: "Processing with LLM" });
    }
    
    const requirements = await extractRequirements(text);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: "Extraction complete" });
    }
    
    return {
      success: true,
      requirements,
      documentNumber: params.documentNumber
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || "Failed to extract requirements"
      }
    };
  }
});

server.setRequestHandler("summarizeRegulation", SummarizeRegulationSchema, async (params, extra) => {
  try {
    const progressReporter = createProgressReporter(extra, params.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 10, message: "Starting regulation summary" });
    }
    
    const text = await getRegulationText(params, progressReporter);
    
    if (progressReporter) {
      progressReporter({ percent: 40, message: "Generating summary with LLM" });
    }
    
    const summary = await summarizeRegulation(text);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: "Summary complete" });
    }
    
    return {
      success: true,
      summary,
      documentNumber: params.documentNumber
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || "Failed to summarize regulation"
      }
    };
  }
});

// Main function to start server
async function startServer() {
  try {
    // Select transport based on environment
    const transport = process.env.MCP_TRANSPORT === 'http' 
      ? new SseTransport({ port: parseInt(process.env.MCP_PORT || "3000", 10) })
      : new StdioTransport();
    
    console.log(`Starting regulatory MCP server with ${process.env.MCP_TRANSPORT || 'stdio'} transport`);
    await server.connect(transport);
    console.log("MCP server connected and ready!");
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log("Shutting down MCP server...");
      await server.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log("Shutting down MCP server...");
      await server.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Start the server if this is the main module
if (process.argv[1] === import.meta.url) {
  startServer();
}

export { server, startServer }; 