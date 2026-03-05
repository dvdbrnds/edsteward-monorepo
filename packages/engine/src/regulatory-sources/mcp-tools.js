/**
 * MCP Server for Regulatory Sources
 * MCP-compliant server that provides regulatory data sources as tools
 */

// Import MCP SDK
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/transports/stdio.js';
import { SseServerTransport } from '@modelcontextprotocol/sdk/server/transports/sse.js';

// Import local modules
import FederalRegisterCollector from './FederalRegisterCollector.js';
import SourceCollector from './SourceCollector.js';
import { extractRequirements, summarizeRegulation, detectRegulationChanges, classifyRegulation, callLLM } from './llm-processing.js';

// Standard MCP error codes
const ErrorCode = {
  // Standard JSON-RPC error codes
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  
  // Custom error codes (above -32000)
  DocumentNotFound: -31000,
  InvalidRegulationFormat: -31001,
  LLMProcessingError: -31002,
  SourceNotFound: -31003,
  FetchError: -31004,
  DatabaseError: -31005
};

// Initialize collectors
const federalRegisterCollector = new FederalRegisterCollector();

// We'll add more collectors as they're implemented
const collectors = {
  'FEDERAL_REGISTER': federalRegisterCollector,
  // 'ED_GOV': edGovCollector,  // Uncomment when implemented
  // 'ECFR_GOV': ecfrCollector, // Uncomment when implemented
};

// Mock DB for now - replace with actual DB integration
const db = {
  saveRegulations: async (sourceCode, regulations) => {
    console.log(`Saved ${regulations.length} regulations from ${sourceCode}`);
    return true;
  },
  getLastRegulationUpdate: async (sourceCode) => null,
  updateLastRegulationCheck: async (sourceCode, timestamp) => {},
  findOne: async (query) => null, // Mock method
};

/**
 * Create and configure the MCP Server
 */
const server = new Server({
  name: "regulatory-sources-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {} // Declare tools capability
  }
});

/**
 * Tool Schemas
 */

// FetchRegulationsFromFederalRegister Schema
const FetchRegulationsSchema = {
  type: "object",
  properties: {
    startDate: {
      type: "string",
      description: "Start date in YYYY-MM-DD format"
    },
    endDate: {
      type: "string",
      description: "End date in YYYY-MM-DD format"
    },
    query: {
      type: "string",
      description: "Search query term"
    },
    regulationIdNumber: {
      type: "string",
      description: "Regulation ID Number (RIN) to search for"
    },
    page: {
      type: "number",
      description: "Page number for paginated results"
    },
    perPage: {
      type: "number",
      description: "Number of results per page"
    }
  }
};

// FetchRegulationByDocumentNumber Schema
const FetchRegulationByDocumentNumberSchema = {
  type: "object",
  properties: {
    documentNumber: {
      type: "string",
      description: "The document number to fetch"
    }
  },
  required: ["documentNumber"]
};

// InitializeRegulationCollection Schema
const InitializeRegulationCollectionSchema = {
  type: "object",
  properties: {
    sources: {
      type: "array",
      description: "Sources to collect from (all if empty)",
      items: {
        type: "string",
        enum: Object.keys(collectors)
      }
    },
    saveToDatabase: {
      type: "boolean",
      description: "Whether to save collected regulations to database",
      default: true
    }
  }
};

// ListAvailableSources Schema
const ListAvailableSourcesSchema = {
  type: "object",
  properties: {}
};

// ExtractRegulationRequirements Schema
const ExtractRequirementsSchema = {
  type: "object",
  properties: {
    regulationText: {
      type: "string",
      description: "The full text of the regulation to analyze"
    },
    documentNumber: {
      type: "string",
      description: "Document number to fetch and analyze (alternative to providing text)"
    },
    options: {
      type: "object",
      description: "Additional options for LLM processing",
      properties: {
        temperature: {
          type: "number",
          description: "LLM temperature parameter (0-1)"
        },
        model: {
          type: "string",
          description: "LLM model to use"
        }
      }
    },
    progressToken: {
      type: "string",
      description: "Token for reporting progress updates"
    }
  },
  oneOf: [
    { required: ["regulationText"] },
    { required: ["documentNumber"] }
  ]
};

// SummarizeRegulation Schema
const SummarizeRegulationSchema = {
  type: "object",
  properties: {
    regulationText: {
      type: "string",
      description: "The full text of the regulation to summarize"
    },
    documentNumber: {
      type: "string",
      description: "Document number to fetch and summarize (alternative to providing text)"
    },
    options: {
      type: "object",
      description: "Additional options for LLM processing",
      properties: {
        temperature: {
          type: "number",
          description: "LLM temperature parameter (0-1)"
        },
        model: {
          type: "string",
          description: "LLM model to use"
        }
      }
    },
    progressToken: {
      type: "string",
      description: "Token for reporting progress updates"
    }
  },
  oneOf: [
    { required: ["regulationText"] },
    { required: ["documentNumber"] }
  ]
};

// DetectRegulationChanges Schema
const DetectChangesSchema = {
  type: "object",
  properties: {
    oldDocumentNumber: {
      type: "string",
      description: "Document number of the previous version"
    },
    newDocumentNumber: {
      type: "string",
      description: "Document number of the new version"
    },
    oldText: {
      type: "string",
      description: "The full text of the previous version"
    },
    newText: {
      type: "string",
      description: "The full text of the new version"
    },
    options: {
      type: "object",
      description: "Additional options for LLM processing",
      properties: {
        temperature: {
          type: "number",
          description: "LLM temperature parameter (0-1)"
        },
        model: {
          type: "string",
          description: "LLM model to use"
        }
      }
    },
    progressToken: {
      type: "string",
      description: "Token for reporting progress updates"
    }
  },
  oneOf: [
    { required: ["oldDocumentNumber", "newDocumentNumber"] },
    { required: ["oldText", "newText"] }
  ]
};

// ClassifyRegulation Schema
const ClassifyRegulationSchema = {
  type: "object",
  properties: {
    regulationText: {
      type: "string",
      description: "The full text of the regulation to classify"
    },
    documentNumber: {
      type: "string",
      description: "Document number to fetch and classify (alternative to providing text)"
    },
    options: {
      type: "object",
      description: "Additional options for LLM processing",
      properties: {
        temperature: {
          type: "number",
          description: "LLM temperature parameter (0-1)"
        },
        model: {
          type: "string",
          description: "LLM model to use"
        }
      }
    },
    progressToken: {
      type: "string",
      description: "Token for reporting progress updates"
    }
  },
  oneOf: [
    { required: ["regulationText"] },
    { required: ["documentNumber"] }
  ]
};

// ProcessRegulationWithLLM Schema
const ProcessRegulationWithLLMSchema = {
  type: "object",
  properties: {
    regulationText: {
      type: 'string',
      description: 'The full text of the regulation to process'
    },
    documentNumber: {
      type: 'string',
      description: 'The document number or identifier of the regulation'
    },
    operation: {
      type: 'string',
      enum: ['extract_requirements', 'summarize', 'classify', 'detect_changes'],
      description: 'The type of LLM processing to perform'
    },
    compareWithVersion: {
      type: 'string',
      description: 'Document number of previous version to compare with (for change detection)'
    },
    llmOptions: {
      type: 'object',
      description: 'Options for the LLM API call',
      properties: {
        temperature: {
          type: 'number',
          description: 'Controls randomness in the response (0.0-1.0)'
        },
        model: {
          type: 'string',
          description: 'LLM model to use'
        }
      }
    },
    progressToken: {
      type: "string",
      description: "Token for reporting progress updates"
    }
  },
  required: ['operation'],
  oneOf: [
    { required: ["regulationText"] },
    { required: ["documentNumber"] }
  ]
};

/**
 * Register request handlers with the server
 */
server.setRequestHandler("fetchRegulationsFromFederalRegister", FetchRegulationsSchema, handleFetchRegulationsFromFederalRegister);
server.setRequestHandler("fetchRegulationByDocumentNumber", FetchRegulationByDocumentNumberSchema, handleFetchRegulationByDocumentNumber);
server.setRequestHandler("initializeRegulationCollection", InitializeRegulationCollectionSchema, handleInitializeRegulationCollection);
server.setRequestHandler("listAvailableSources", ListAvailableSourcesSchema, handleListAvailableSources);
server.setRequestHandler("extractRegulationRequirements", ExtractRequirementsSchema, handleExtractRegulationRequirements);
server.setRequestHandler("summarizeRegulation", SummarizeRegulationSchema, handleSummarizeRegulation);
server.setRequestHandler("detectRegulationChanges", DetectChangesSchema, handleDetectRegulationChanges);
server.setRequestHandler("classifyRegulation", ClassifyRegulationSchema, handleClassifyRegulation);
server.setRequestHandler("processRegulationWithLLM", ProcessRegulationWithLLMSchema, handleProcessRegulationWithLLM);

/**
 * Input validation helper
 */
function validateParameters(params, requiredFields = []) {
  const missing = requiredFields.filter(field => !params[field]);
  
  if (missing.length > 0) {
    throw {
      code: ErrorCode.InvalidParams,
      message: `Missing required parameters: ${missing.join(', ')}`
    };
  }
  
  return true;
}

/**
 * Progress reporting helper
 */
function createProgressReporter(extra, progressToken, totalSteps = 100) {
  if (!progressToken || !extra || !extra.reportProgress) {
    return null;
  }
  
  return (progress) => {
    const { percent = 0, message = '' } = progress;
    extra.reportProgress({
      token: progressToken,
      value: {
        message,
        percentage: Math.min(Math.max(0, percent), 100),
        total: totalSteps
      }
    });
  };
}

/**
 * Fetch regulation text by document number if needed
 * @param {object} parameters - Parameters containing either text or document number
 * @param {function} progressReporter - Progress reporting function
 * @returns {Promise<string>} - The regulation text
 */
async function getRegulationText(parameters, progressReporter) {
  if (parameters.regulationText) {
    return parameters.regulationText;
  }
  
  if (parameters.documentNumber) {
    try {
      if (progressReporter) {
        progressReporter({ percent: 10, message: 'Initializing Federal Register collector' });
      }
      
      await federalRegisterCollector.initialize();
      
      if (progressReporter) {
        progressReporter({ percent: 30, message: 'Fetching regulation by document number' });
      }
      
      const regulation = await federalRegisterCollector.fetchRegulationByDocumentNumber(
        parameters.documentNumber
      );
      
      if (progressReporter) {
        progressReporter({ percent: 80, message: 'Processing regulation text' });
      }
      
      // Use full text from the regulation if available
      return regulation.full_text || regulation.abstract || 
             regulation.description || JSON.stringify(regulation);
    } catch (error) {
      throw {
        code: ErrorCode.DocumentNotFound,
        message: `Failed to fetch regulation: ${error.message}`,
        data: { documentNumber: parameters.documentNumber }
      };
    }
  }
  
  throw {
    code: ErrorCode.InvalidParams,
    message: 'Either regulationText or documentNumber must be provided'
  };
}

/**
 * Handle fetchRegulationsFromFederalRegister tool requests
 */
async function handleFetchRegulationsFromFederalRegister(parameters, extra) {
  try {
    const progressReporter = createProgressReporter(extra, parameters.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 10, message: 'Initializing collector' });
    }
    
    await federalRegisterCollector.initialize();
    
    if (progressReporter) {
      progressReporter({ percent: 40, message: 'Fetching regulations' });
    }
    
    const regulations = await federalRegisterCollector.fetchRegulations(parameters);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Completed' });
    }
    
    return { 
      success: true,
      regulations,
      source: {
        name: federalRegisterCollector.name,
        authority: federalRegisterCollector.sourceAuthority,
        baseUrl: federalRegisterCollector.baseUrl,
        fetchTime: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error fetching regulations:', error);
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.FetchError,
        message: error.message || 'Failed to fetch regulations',
        data: error.data
      }
    };
  }
}

/**
 * Handle fetchRegulationByDocumentNumber tool requests
 */
async function handleFetchRegulationByDocumentNumber(parameters, extra) {
  try {
    validateParameters(parameters, ['documentNumber']);
    
    const progressReporter = createProgressReporter(extra, parameters.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 20, message: 'Initializing collector' });
    }
    
    await federalRegisterCollector.initialize();
    
    if (progressReporter) {
      progressReporter({ percent: 50, message: 'Fetching regulation' });
    }
    
    const regulation = await federalRegisterCollector.fetchRegulationByDocumentNumber(
      parameters.documentNumber
    );
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Completed' });
    }
    
    return { 
      success: true,
      regulation,
      source: {
        name: federalRegisterCollector.name,
        authority: federalRegisterCollector.sourceAuthority,
        baseUrl: federalRegisterCollector.baseUrl,
        fetchTime: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error fetching regulation:', error);
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.DocumentNotFound,
        message: error.message || 'Failed to fetch regulation',
        data: { documentNumber: parameters.documentNumber }
      }
    };
  }
}

/**
 * Handle initializeRegulationCollection tool requests
 */
async function handleInitializeRegulationCollection(parameters, extra) {
  const { sources = Object.keys(collectors), saveToDatabase = true } = parameters;
  const results = {};
  const errors = [];
  
  const progressReporter = createProgressReporter(extra, parameters.progressToken);
  const totalSources = sources.length;
  let completedSources = 0;
  
  try {
    // Process each requested source
    for (const sourceCode of sources) {
      if (progressReporter) {
        progressReporter({ 
          percent: Math.floor((completedSources / totalSources) * 100), 
          message: `Processing source: ${sourceCode}` 
        });
      }
      
      const collector = collectors[sourceCode];
      
      if (!collector) {
        errors.push({
          sourceCode,
          error: `Source collector not found: ${sourceCode}`
        });
        completedSources++;
        continue;
      }
      
      try {
        // Initialize the collector
        await collector.initialize();
        
        // Fetch regulations
        const regulations = await collector.fetchRegulations();
        
        // Save to database if requested
        if (saveToDatabase) {
          await db.saveRegulations(sourceCode, regulations);
          await db.updateLastRegulationCheck(sourceCode, new Date().toISOString());
        }
        
        // Record result
        results[sourceCode] = {
          success: true,
          count: regulations.length,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        errors.push({
          sourceCode,
          error: error.message
        });
        
        results[sourceCode] = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
      
      completedSources++;
    }
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Collection complete' });
    }
    
    return {
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Collection failed' });
    }
    
    return {
      success: false,
      error: {
        code: ErrorCode.InternalError,
        message: error.message,
        data: { results }
      }
    };
  }
}

/**
 * Handle listAvailableSources tool requests
 */
async function handleListAvailableSources(parameters, extra) {
  try {
    const sources = Object.entries(collectors).map(([sourceCode, collector]) => ({
      sourceCode,
      name: collector.name,
      authority: collector.sourceAuthority,
      baseUrl: collector.baseUrl,
      refreshInterval: collector.refreshInterval
    }));
    
    return {
      success: true,
      sources
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: ErrorCode.InternalError,
        message: error.message
      }
    };
  }
}

/**
 * Handle extractRegulationRequirements tool requests
 */
async function handleExtractRegulationRequirements(parameters, extra) {
  try {
    const progressReporter = createProgressReporter(extra, parameters.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 20, message: 'Retrieving regulation text' });
    }
    
    const regulationText = await getRegulationText(parameters, progressReporter);
    
    if (progressReporter) {
      progressReporter({ percent: 40, message: 'Preparing for LLM processing' });
    }
    
    // Enhanced progress reporting for LLM processing
    const reportLLMProgress = (stage) => {
      if (!progressReporter) return;
      
      const stages = {
        start: { percent: 50, message: 'Starting LLM processing' },
        processing: { percent: 70, message: 'LLM analyzing requirements' },
        complete: { percent: 90, message: 'Finalizing results' }
      };
      
      progressReporter(stages[stage] || { percent: 70, message: 'Processing' });
    };
    
    reportLLMProgress('start');
    const options = { 
      ...parameters.options,
      onProgress: (stage) => reportLLMProgress(stage)
    };
    
    reportLLMProgress('processing');
    const requirements = await extractRequirements(regulationText, options);
    reportLLMProgress('complete');
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Complete' });
    }
    
    return {
      success: true,
      requirements,
      source: parameters.documentNumber ? {
        documentNumber: parameters.documentNumber,
        processTime: new Date().toISOString()
      } : { processTime: new Date().toISOString() }
    };
  } catch (error) {
    console.error('Error extracting requirements:', error);
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || 'Failed to extract requirements',
        data: error.data
      }
    };
  }
}

/**
 * Handle summarizeRegulation tool requests
 */
async function handleSummarizeRegulation(parameters, extra) {
  try {
    const progressReporter = createProgressReporter(extra, parameters.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 20, message: 'Retrieving regulation text' });
    }
    
    const regulationText = await getRegulationText(parameters, progressReporter);
    
    if (progressReporter) {
      progressReporter({ percent: 50, message: 'Summarizing with LLM' });
    }
    
    const summary = await summarizeRegulation(regulationText, parameters.options);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Complete' });
    }
    
    return {
      success: true,
      summary,
      source: parameters.documentNumber ? {
        documentNumber: parameters.documentNumber,
        processTime: new Date().toISOString()
      } : { processTime: new Date().toISOString() }
    };
  } catch (error) {
    console.error('Error summarizing regulation:', error);
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || 'Failed to summarize regulation',
        data: error.data
      }
    };
  }
}

/**
 * Handle detectRegulationChanges tool requests
 */
async function handleDetectRegulationChanges(parameters, extra) {
  try {
    const progressReporter = createProgressReporter(extra, parameters.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 10, message: 'Preparing regulation texts' });
    }
    
    let oldText = parameters.oldText;
    let newText = parameters.newText;
    
    // If document numbers are provided instead of text, fetch the regulations
    if (!oldText && parameters.oldDocumentNumber) {
      if (progressReporter) {
        progressReporter({ percent: 20, message: 'Fetching old regulation version' });
      }
      
      await federalRegisterCollector.initialize();
      const oldRegulation = await federalRegisterCollector.fetchRegulationByDocumentNumber(
        parameters.oldDocumentNumber
      );
      oldText = oldRegulation.full_text || oldRegulation.abstract || 
                oldRegulation.description || JSON.stringify(oldRegulation);
    }
    
    if (!newText && parameters.newDocumentNumber) {
      if (progressReporter) {
        progressReporter({ percent: 40, message: 'Fetching new regulation version' });
      }
      
      await federalRegisterCollector.initialize();
      const newRegulation = await federalRegisterCollector.fetchRegulationByDocumentNumber(
        parameters.newDocumentNumber
      );
      newText = newRegulation.full_text || newRegulation.abstract || 
                newRegulation.description || JSON.stringify(newRegulation);
    }
    
    if (!oldText || !newText) {
      throw {
        code: ErrorCode.InvalidParams,
        message: 'Both old and new regulation text must be provided'
      };
    }
    
    if (progressReporter) {
      progressReporter({ percent: 60, message: 'Analyzing changes with LLM' });
    }
    
    const changes = await detectRegulationChanges(oldText, newText, parameters.options);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Complete' });
    }
    
    return {
      success: true,
      changes,
      source: {
        oldDocument: parameters.oldDocumentNumber,
        newDocument: parameters.newDocumentNumber,
        processTime: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error detecting regulation changes:', error);
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || 'Failed to detect regulation changes',
        data: error.data
      }
    };
  }
}

/**
 * Handle classifyRegulation tool requests
 */
async function handleClassifyRegulation(parameters, extra) {
  try {
    const progressReporter = createProgressReporter(extra, parameters.progressToken);
    
    if (progressReporter) {
      progressReporter({ percent: 20, message: 'Retrieving regulation text' });
    }
    
    const regulationText = await getRegulationText(parameters, progressReporter);
    
    if (progressReporter) {
      progressReporter({ percent: 50, message: 'Classifying with LLM' });
    }
    
    const classification = await classifyRegulation(regulationText, parameters.options);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Complete' });
    }
    
    return {
      success: true,
      classification,
      source: parameters.documentNumber ? {
        documentNumber: parameters.documentNumber,
        processTime: new Date().toISOString()
      } : { processTime: new Date().toISOString() }
    };
  } catch (error) {
    console.error('Error classifying regulation:', error);
    return {
      success: false,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || 'Failed to classify regulation',
        data: error.data
      }
    };
  }
}

/**
 * Handler for processing regulations with LLM
 * 
 * @param {Object} params - Parameters for the operation
 * @param {string} params.regulationText - The full text of the regulation
 * @param {string} params.documentNumber - The document number or identifier
 * @param {string} params.operation - The type of LLM processing to perform
 * @param {string} params.compareWithVersion - Document number to compare with
 * @param {Object} params.llmOptions - Options for the LLM API call
 * @param {Object} extra - Extra context from the MCP server
 * @returns {Promise<Object>} - The result of the LLM processing
 */
async function handleProcessRegulationWithLLM(params, extra) {
  const { regulationText, documentNumber, operation, compareWithVersion, llmOptions = {} } = params;
  const progressReporter = createProgressReporter(extra, params.progressToken);
  
  try {
    if (!operation) {
      throw {
        code: ErrorCode.InvalidParams,
        message: 'Missing required parameter: operation'
      };
    }
    
    // Get regulation text if not provided
    let processedText = regulationText;
    if (!processedText && documentNumber) {
      if (progressReporter) {
        progressReporter({ percent: 10, message: 'Retrieving regulation text' });
      }
      
      await federalRegisterCollector.initialize();
      const regulation = await federalRegisterCollector.fetchRegulationByDocumentNumber(documentNumber);
      processedText = regulation.full_text || regulation.abstract || 
                     regulation.description || JSON.stringify(regulation);
    }
    
    if (!processedText) {
      throw {
        code: ErrorCode.InvalidParams,
        message: 'Either regulationText or documentNumber must be provided'
      };
    }
    
    let result;
    
    if (progressReporter) {
      progressReporter({ percent: 30, message: `Starting ${operation} operation` });
    }
    
    switch (operation) {
      case 'extract_requirements':
        console.log(`Extracting requirements from regulation ${documentNumber || 'text'} using LLM...`);
        if (progressReporter) {
          progressReporter({ percent: 50, message: 'Extracting requirements with LLM' });
        }
        result = await extractRequirements(processedText, llmOptions);
        break;
        
      case 'summarize':
        console.log(`Generating summary for regulation ${documentNumber || 'text'} using LLM...`);
        if (progressReporter) {
          progressReporter({ percent: 50, message: 'Generating summary with LLM' });
        }
        result = await summarizeRegulation(processedText, llmOptions);
        break;
        
      case 'classify':
        console.log(`Classifying regulation ${documentNumber || 'text'} using LLM...`);
        if (progressReporter) {
          progressReporter({ percent: 50, message: 'Classifying with LLM' });
        }
        result = await classifyRegulation(processedText, llmOptions);
        break;
        
      case 'detect_changes':
        if (!compareWithVersion) {
          throw {
            code: ErrorCode.InvalidParams,
            message: 'Missing compareWithVersion parameter for detect_changes operation'
          };
        }
        
        // Retrieve the text of the previous version
        if (progressReporter) {
          progressReporter({ percent: 40, message: 'Retrieving previous version' });
        }
        
        console.log(`Retrieving previous version ${compareWithVersion} for comparison...`);
        const previousRegulation = await db.findOne({ documentNumber: compareWithVersion });
        
        if (!previousRegulation) {
          throw {
            code: ErrorCode.DocumentNotFound,
            message: `Previous version ${compareWithVersion} not found`
          };
        }
        
        if (progressReporter) {
          progressReporter({ percent: 60, message: 'Detecting changes with LLM' });
        }
        
        console.log(`Detecting changes between ${documentNumber} and ${compareWithVersion} using LLM...`);
        result = await detectRegulationChanges(previousRegulation.text, processedText, llmOptions);
        break;
        
      default:
        throw {
          code: ErrorCode.InvalidParams,
          message: `Unknown LLM operation: ${operation}`
        };
    }
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Processing complete' });
    }
    
    return {
      success: true,
      operation,
      documentNumber,
      result
    };
  } catch (error) {
    console.error(`Error in LLM processing (${operation}):`, error);
    
    if (progressReporter) {
      progressReporter({ percent: 100, message: 'Processing failed' });
    }
    
    return {
      success: false,
      operation,
      documentNumber,
      error: {
        code: error.code || ErrorCode.LLMProcessingError,
        message: error.message || `Error in LLM processing (${operation})`,
        data: error.data
      }
    };
  }
}

/**
 * Start the MCP server
 */
async function startServer() {
  try {
    // Determine transport based on environment
    let transport;
    
    if (process.env.MCP_TRANSPORT === 'http') {
      const port = parseInt(process.env.MCP_PORT || '3000', 10);
      transport = new SseServerTransport({ port });
      console.log(`Starting regulatory-sources MCP server with HTTP/SSE transport on port ${port}`);
    } else {
      transport = new StdioServerTransport();
      console.log('Starting regulatory-sources MCP server with stdio transport');
    }
    
    // Connect transport and start listening
    await server.connect(transport);
    console.log('MCP server connected and ready');
    
    // Properly handle shutdown
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

/**
 * Handle server shutdown
 */
async function handleShutdown() {
  console.log('Shutting down MCP server...');
  try {
    // Clean up any resources
    await server.shutdown();
    console.log('MCP server shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
}

// Start server if this module is run directly
if (require.main === module) {
  startServer();
}

// Export for testing and programmatic usage
export {
  server,
  startServer,
  handleShutdown,
  ErrorCode
}; 