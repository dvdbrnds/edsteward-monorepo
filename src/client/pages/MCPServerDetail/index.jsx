import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import StatusIndicator from '../../components/StatusIndicator';
import mcpApiClient from '../../api/MCPApiClient';

const DetailContainer = styled.div`
  padding: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const BackButton = styled.button`
  background-color: transparent;
  color: ${props => props.theme.colors.primary};
  border: 1px solid ${props => props.theme.colors.primary};
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.primary};
    color: white;
  }
  
  &::before {
    content: '←';
    margin-right: 8px;
  }
`;

const Title = styled.h1`
  font-size: 24px;
  margin: 0;
`;

const ServerInfoCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
`;

const ServerStatus = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 16px;
`;

const StatusText = styled.span`
  margin-left: 8px;
  font-weight: 500;
`;

const ServerInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
`;

const InfoItem = styled.div`
  margin-bottom: 16px;
`;

const InfoLabel = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 4px;
`;

const InfoValue = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const ActionButton = styled.button`
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 4px;
  border: none;
  background-color: ${props => {
    if (props.variant === 'start') return props.theme.colors.success;
    if (props.variant === 'stop') return props.theme.colors.error;
    if (props.variant === 'restart') return props.theme.colors.warning;
    return props.theme.colors.primary;
  }};
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ContentSection = styled.div`
  margin-top: 24px;
`;

const ContentHeader = styled.h2`
  font-size: 18px;
  margin-bottom: 16px;
`;

const ContentCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
`;

const ContentPreview = styled.div`
  background-color: ${props => props.theme.colors.background};
  border-radius: 4px;
  padding: 16px;
  font-family: ${props => props.theme.fonts.monospace};
  font-size: 14px;
  white-space: pre-wrap;
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 40px;
  color: ${props => props.theme.colors.textSecondary};
`;

const ErrorMessage = styled.div`
  background-color: ${props => props.theme.colors.error}10;
  border: 1px solid ${props => props.theme.colors.error}30;
  color: ${props => props.theme.colors.error};
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 24px;
`;

const InspectorSection = styled.div`
  margin-top: 24px;
  margin-bottom: 24px;
`;

const InspectorCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
`;

const InspectorHeader = styled.h2`
  font-size: 18px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
`;

const InspectorIcon = styled.span`
  margin-right: 8px;
  font-size: 20px;
  color: ${props => props.theme.colors.info};
`;

const InspectorDescription = styled.p`
  margin-bottom: 20px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.5;
`;

const CommandPreview = styled.div`
  background-color: ${props => props.theme.colors.background};
  border-radius: 4px;
  padding: 12px 16px;
  font-family: ${props => props.theme.fonts.monospace};
  font-size: 14px;
  margin-bottom: 20px;
  overflow-x: auto;
  border: 1px solid ${props => props.theme.colors.border};
`;

const InspectorButton = styled.button`
  background-color: ${props => props.theme.colors.info};
  color: white;
  padding: 10px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const InspectorButtonIcon = styled.span`
  margin-right: 8px;
`;

const CommandOutput = styled.div`
  background-color: #000;
  color: #00FF00;
  border-radius: 4px;
  padding: 16px;
  font-family: ${props => props.theme.fonts.monospace};
  font-size: 14px;
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
`;

const MCPServerDetail = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectorOutput, setInspectorOutput] = useState('');
  const [lastProcessId, setLastProcessId] = useState(null);
  const [outputPollingInterval, setOutputPollingInterval] = useState(null);

  useEffect(() => {
    // In a real implementation, this would fetch the server data 
    // and its content from the API
    const fetchServerData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // In a real implementation, replace with actual API calls
        // This is mockup data based on our previous implementation
        const getMockServer = () => {
          // Extract basic info from the ID
          const isCore = !serverId.includes('regulation-');
          const type = isCore 
            ? (serverId.includes('gateway') ? 'Gateway' : 
               serverId.includes('batch') ? 'Batch' : 'Registry')
            : 'Regulation Server';
          
          const name = serverId.includes('gateway') ? 'LLM Gateway' :
                      serverId.includes('batch') ? 'Batch Processing Server' :
                      serverId.includes('registry') ? 'Regulation Registry' :
                      `Regulation Server: ${serverId.split('-').slice(1).join('-')}`;
          
          const port = isCore 
            ? (serverId.includes('gateway') ? 3000 : 
               serverId.includes('batch') ? 3001 : 3010)
            : 3200 + Math.floor(Math.random() * 200);
            
          return {
            id: serverId,
            name: name,
            type: type,
            category: isCore ? 'Core' : 'Regulation',
            status: Math.random() > 0.2 ? 'running' : 'stopped',
            port: port,
            address: `http://localhost:${port}`,
            uptime: Math.random() > 0.2 ? `${Math.floor(1 + Math.random() * 5)}h ${Math.floor(Math.random() * 60)}m` : '-',
            version: '1.0.0',
            startTime: new Date(Date.now() - Math.random() * 10000000).toISOString(),
            memoryUsage: `${Math.floor(50 + Math.random() * 150)} MB`,
            cpuUsage: `${Math.floor(1 + Math.random() * 20)}%`,
            endpoints: ['/status', '/validate', '/info', '/health'],
            config: {
              logLevel: 'info',
              maxConnections: 100,
              timeout: 30000
            }
          };
        };
        
        // Generate mock content
        const getMockContent = (serverId) => {
          if (serverId.includes('llm-gateway')) {
            return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create LLM Gateway server
const server = new Server({
  name: "llm-gateway",
  version: "1.0.0"
}, {
  capabilities: {
    prompts: {
      modelSelection: {
        description: "Select an LLM model for completion",
        template: "Please use the {{model}} model for the following task: {{task}}",
        parameters: {
          model: { type: "string", enum: ["gpt-4", "claude-2", "llama-2"] },
          task: { type: "string" }
        }
      },
      completionFormat: {
        description: "Format for completion requests",
        template: "Generate a {{format}} response for: {{input}}",
        parameters: {
          format: { type: "string", enum: ["json", "text", "markdown"] },
          input: { type: "string" }
        }
      }
    },
    resources: {
      modelCapabilities: {
        description: "Get capabilities of available models",
        type: "object"
      },
      usageMetrics: {
        description: "Get usage metrics for models",
        type: "object"
      }
    },
    tools: {
      completions: {
        description: "Generate text completions",
        parameters: {
          prompt: { type: "string" },
          model: { type: "string", enum: ["gpt-4", "claude-2", "llama-2"] },
          temperature: { type: "number", minimum: 0, maximum: 1 }
        }
      },
      embeddings: {
        description: "Generate text embeddings",
        parameters: {
          text: { type: "string" },
          model: { type: "string", enum: ["gpt-4", "claude-2", "llama-2"] }
        }
      }
    }
  }
});

// Handle prompt requests
server.setPromptHandler("modelSelection", async (params) => {
  const { model, task } = params;
  return {
    prompt: \`Using \${model} model for task: \${task}\`,
    model: model
  };
});

server.setPromptHandler("completionFormat", async (params) => {
  const { format, input } = params;
  return {
    prompt: \`Generate \${format} format: \${input}\`,
    format: format
  };
});

// Handle resource requests
server.setResourceHandler("modelCapabilities", async () => {
  return {
    models: {
      "gpt-4": { maxTokens: 8192, features: ["completion", "embedding"] },
      "claude-2": { maxTokens: 100000, features: ["completion", "embedding", "analysis"] },
      "llama-2": { maxTokens: 4096, features: ["completion"] }
    }
  };
});

server.setResourceHandler("usageMetrics", async () => {
  return {
    totalRequests: 1250,
    requestsByModel: {
      "gpt-4": 500,
      "claude-2": 600,
      "llama-2": 150
    },
    averageLatency: "120ms"
  };
});

// Handle tool requests
server.setRequestHandler("completions", async (params) => {
  const { prompt, model, temperature } = params;
  // Implementation would call actual LLM API
  return {
    completion: "Sample completion for: " + prompt,
    model: model,
    temperature: temperature
  };
});

server.setRequestHandler("embeddings", async (params) => {
  const { text, model } = params;
  // Implementation would call actual embedding API
  return {
    embedding: [0.1, 0.2, 0.3], // Sample embedding vector
    model: model,
    dimensions: 3
  };
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);`;
          } else if (serverId.includes('batch')) {
            return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create Batch Processing server
const server = new Server({
  name: "batch-processing",
  version: "1.0.0"
}, {
  capabilities: {
    prompts: {
      jobTemplate: {
        description: "Template for creating batch jobs",
        template: "Create a {{jobType}} job to process {{dataType}} data with priority {{priority}}",
        parameters: {
          jobType: { type: "string", enum: ["analysis", "transformation", "validation"] },
          dataType: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] }
        }
      },
      batchSize: {
        description: "Configure batch size for processing",
        template: "Process data in batches of {{size}} items with {{parallel}} parallel workers",
        parameters: {
          size: { type: "number", minimum: 1 },
          parallel: { type: "number", minimum: 1, maximum: 10 }
        }
      }
    },
    resources: {
      queueStatus: {
        description: "Get current status of job queues",
        type: "object"
      },
      jobHistory: {
        description: "Get history of completed jobs",
        type: "object"
      },
      workerStatus: {
        description: "Get status of worker processes",
        type: "object"
      }
    },
    tools: {
      submitJob: {
        description: "Submit a batch processing job",
        parameters: {
          type: { type: "string", enum: ["analysis", "transformation", "validation"] },
          data: { type: "object" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          options: { type: "object" }
        }
      },
      getJobStatus: {
        description: "Get status of a job",
        parameters: {
          jobId: { type: "string" }
        }
      },
      cancelJob: {
        description: "Cancel a running or queued job",
        parameters: {
          jobId: { type: "string" }
        }
      }
    }
  }
});

// Handle prompt requests
server.setPromptHandler("jobTemplate", async (params) => {
  const { jobType, dataType, priority } = params;
  return {
    prompt: \`Creating \${priority} priority \${jobType} job for \${dataType} data\`,
    defaults: {
      type: jobType,
      priority: priority
    }
  };
});

server.setPromptHandler("batchSize", async (params) => {
  const { size, parallel } = params;
  return {
    prompt: \`Processing in batches of \${size} with \${parallel} workers\`,
    config: { batchSize: size, parallelWorkers: parallel }
  };
});

// Handle resource requests
server.setResourceHandler("queueStatus", async () => {
  return {
    queues: {
      high: { waiting: 2, processing: 1 },
      medium: { waiting: 5, processing: 2 },
      low: { waiting: 10, processing: 1 }
    },
    totalJobs: 21,
    averageWaitTime: "45s"
  };
});

server.setResourceHandler("jobHistory", async () => {
  return {
    completedJobs: 156,
    failedJobs: 3,
    averageProcessingTime: "2m 30s",
    recentJobs: [
      { id: "job-123", type: "analysis", status: "completed", duration: "1m 20s" }
    ]
  };
});

server.setResourceHandler("workerStatus", async () => {
  return {
    activeWorkers: 4,
    maxWorkers: 10,
    workerLoad: [
      { id: "worker-1", jobs: 2, cpu: "45%", memory: "128MB" }
    ]
  };
});

// Handle tool requests
server.setRequestHandler("submitJob", async (params) => {
  const { type, data, priority, options } = params;
  const jobId = Date.now().toString();
  // Implementation would queue job for processing
  return {
    jobId: jobId,
    status: "queued",
    priority: priority,
    estimatedTime: "30s",
    queuePosition: 2
  };
});

server.setRequestHandler("getJobStatus", async (params) => {
  const { jobId } = params;
  // Implementation would check actual job status
  return {
    jobId: jobId,
    status: "processing",
    progress: "50%",
    startTime: new Date().toISOString(),
    estimatedCompletion: "1m"
  };
});

server.setRequestHandler("cancelJob", async (params) => {
  const { jobId } = params;
  // Implementation would cancel the job
  return {
    jobId: jobId,
    status: "cancelled",
    reason: "User requested cancellation"
  };
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);`;
          } else if (serverId.includes('registry')) {
            return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create Regulation Registry server
const server = new Server({
  name: "regulation-registry",
  version: "1.0.0"
}, {
  capabilities: {
    prompts: {
      regulationSearch: {
        description: "Search for regulations by criteria",
        template: "Find regulations in {{category}} category that are {{status}} and related to {{keyword}}",
        parameters: {
          category: { type: "string", enum: ["Academic", "Finance", "HR", "Privacy", "Safety", "Research"] },
          status: { type: "string", enum: ["active", "draft", "archived"] },
          keyword: { type: "string" }
        }
      },
      complianceCheck: {
        description: "Check compliance requirements",
        template: "Check {{organization}} compliance with {{regulationId}} focusing on {{aspect}}",
        parameters: {
          organization: { type: "string" },
          regulationId: { type: "string" },
          aspect: { type: "string", enum: ["documentation", "processes", "training", "reporting"] }
        }
      }
    },
    resources: {
      listRegulations: {
        description: "List all available regulations",
        type: "array"
      },
      getRegulation: {
        description: "Get details of a specific regulation",
        type: "object",
        parameters: {
          id: { type: "string" }
        }
      },
      categories: {
        description: "Get available regulation categories",
        type: "array"
      },
      statistics: {
        description: "Get registry statistics",
        type: "object"
      }
    },
    tools: {
      updateRegulation: {
        description: "Update regulation content or metadata",
        parameters: {
          id: { type: "string" },
          content: { type: "object" },
          metadata: { type: "object" }
        }
      },
      validateRegulation: {
        description: "Validate regulation format and references",
        parameters: {
          id: { type: "string" }
        }
      },
      exportRegulation: {
        description: "Export regulation in specified format",
        parameters: {
          id: { type: "string" },
          format: { type: "string", enum: ["pdf", "html", "json"] }
        }
      }
    }
  }
});

// Handle prompt requests
server.setPromptHandler("regulationSearch", async (params) => {
  const { category, status, keyword } = params;
  return {
    prompt: \`Searching for \${status} regulations in \${category} category containing "\${keyword}"\`,
    searchParams: { category, status, keyword }
  };
});

server.setPromptHandler("complianceCheck", async (params) => {
  const { organization, regulationId, aspect } = params;
  return {
    prompt: \`Checking \${organization}'s compliance with \${regulationId} focusing on \${aspect}\`,
    checkParams: { organization, regulationId, aspect }
  };
});

// Handle resource requests
server.setResourceHandler("listRegulations", async () => {
  return {
    regulations: [
      { id: "FERPA", name: "Family Educational Rights and Privacy Act", category: "Privacy" },
      { id: "HIPAA", name: "Health Insurance Portability and Accountability Act", category: "Privacy" }
    ],
    total: 237,
    page: 1,
    pageSize: 50
  };
});

server.setResourceHandler("getRegulation", async (params) => {
  const { id } = params;
  return {
    id: id,
    name: "Sample Regulation",
    version: "2024.1",
    status: "active",
    lastUpdated: new Date().toISOString(),
    content: "Regulation content...",
    metadata: {
      category: "Privacy",
      jurisdiction: "Federal",
      effectiveDate: "2024-01-01"
    }
  };
});

server.setResourceHandler("categories", async () => {
  return {
    categories: ["Academic", "Finance", "HR", "Privacy", "Safety", "Research"],
    metadata: {
      totalRegulations: 237,
      lastUpdated: new Date().toISOString()
    }
  };
});

server.setResourceHandler("statistics", async () => {
  return {
    totalRegulations: 237,
    byCategory: {
      Academic: 45,
      Finance: 52,
      HR: 38,
      Privacy: 41,
      Safety: 35,
      Research: 26
    },
    byStatus: {
      active: 200,
      draft: 25,
      archived: 12
    },
    lastUpdate: new Date().toISOString()
  };
});

// Handle tool requests
server.setRequestHandler("updateRegulation", async (params) => {
  const { id, content, metadata } = params;
  // Implementation would update regulation in database
  return {
    id: id,
    status: "updated",
    timestamp: new Date().toISOString(),
    version: "2024.2"
  };
});

server.setRequestHandler("validateRegulation", async (params) => {
  const { id } = params;
  // Implementation would validate regulation format
  return {
    id: id,
    isValid: true,
    checks: [
      { type: "format", status: "passed" },
      { type: "references", status: "passed" }
    ]
  };
});

server.setRequestHandler("exportRegulation", async (params) => {
  const { id, format } = params;
  // Implementation would generate export
  return {
    id: id,
    format: format,
    url: \`/exports/\${id}.\${format}\`,
    expiresIn: "1h"
  };
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);`;
          } else {
            // For regulation servers, show the MCP server implementation
            const regulationId = serverId.split('-')[1]; // Extract regulation ID from server ID
            return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create Regulation-specific MCP server
const server = new Server({
  name: "${regulationId}-regulation-server",
  version: "1.0.0"
}, {
  capabilities: {
    prompts: {
      validationScope: {
        description: "Define validation scope for regulation check",
        template: "Validate {{contentType}} against {{section}} requirements with {{level}} strictness",
        parameters: {
          contentType: { type: "string", enum: ["document", "process", "system", "training"] },
          section: { type: "string" },
          level: { type: "string", enum: ["strict", "normal", "lenient"] }
        }
      },
      complianceReport: {
        description: "Generate compliance report template",
        template: "Create {{reportType}} report for {{period}} with focus on {{aspects}}",
        parameters: {
          reportType: { type: "string", enum: ["full", "summary", "violations", "progress"] },
          period: { type: "string" },
          aspects: { type: "array", items: { type: "string" } }
        }
      }
    },
    resources: {
      regulationContent: {
        description: "Get full regulation content and metadata",
        type: "object"
      },
      requirements: {
        description: "Get detailed requirements breakdown",
        type: "object"
      },
      validationRules: {
        description: "Get validation rules and criteria",
        type: "object"
      },
      complianceMetrics: {
        description: "Get compliance tracking metrics",
        type: "object"
      }
    },
    tools: {
      validate: {
        description: "Validate content against regulation rules",
        parameters: {
          content: { type: "string" },
          context: { type: "object" },
          options: {
            type: "object",
            properties: {
              strictness: { type: "string", enum: ["strict", "normal", "lenient"] },
              sections: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      generateReport: {
        description: "Generate compliance report",
        parameters: {
          timeframe: { type: "string" },
          format: { type: "string", enum: ["pdf", "html", "json"] },
          type: { type: "string", enum: ["full", "summary", "violations", "progress"] }
        }
      },
      assessRisk: {
        description: "Assess compliance risk level",
        parameters: {
          context: { type: "object" },
          scenario: { type: "string" }
        }
      }
    }
  }
});

// Handle prompt requests
server.setPromptHandler("validationScope", async (params) => {
  const { contentType, section, level } = params;
  return {
    prompt: \`Validating \${contentType} against \${section} with \${level} strictness\`,
    validationParams: {
      type: contentType,
      section: section,
      strictness: level
    }
  };
});

server.setPromptHandler("complianceReport", async (params) => {
  const { reportType, period, aspects } = params;
  return {
    prompt: \`Generating \${reportType} report for \${period}\`,
    reportParams: {
      type: reportType,
      period: period,
      aspects: aspects
    }
  };
});

// Handle resource requests
server.setResourceHandler("regulationContent", async () => {
  return {
    id: "${regulationId}",
    type: "Federal Regulation",
    status: "Active",
    metadata: {
      title: "${regulationId} Compliance Requirements",
      effectiveDate: "2024-01-01",
      lastAmended: "2024-03-15",
      enforcementAgency: "Department of Education"
    },
    content: {
      purpose: "This regulation establishes standards for ensuring compliance...",
      scope: "Applies to all educational institutions...",
      definitions: {
        key_terms: [
          { term: "Educational Institution", definition: "Any organization providing educational services" }
        ]
      }
    }
  };
});

server.setResourceHandler("requirements", async () => {
  return {
    sections: [
      {
        id: "data-protection",
        title: "Data Protection Requirements",
        requirements: [
          { id: "dp-1", text: "Implement secure data storage systems" },
          { id: "dp-2", text: "Establish data access controls" }
        ]
      },
      {
        id: "compliance-monitoring",
        title: "Compliance Monitoring",
        requirements: [
          { id: "cm-1", text: "Conduct monthly compliance reviews" },
          { id: "cm-2", text: "Maintain audit trails" }
        ]
      }
    ]
  };
});

server.setResourceHandler("validationRules", async () => {
  return {
    rules: [
      {
        section: "data-protection",
        criteria: [
          { id: "dp-1-1", check: "encryption", level: "required" },
          { id: "dp-1-2", check: "access-control", level: "required" }
        ]
      },
      {
        section: "compliance-monitoring",
        criteria: [
          { id: "cm-1-1", check: "review-frequency", level: "recommended" },
          { id: "cm-1-2", check: "documentation", level: "required" }
        ]
      }
    ]
  };
});

server.setResourceHandler("complianceMetrics", async () => {
  return {
    overall: {
      score: 85,
      trend: "+5%",
      lastAssessment: new Date().toISOString()
    },
    bySection: {
      "data-protection": { score: 90, findings: 2 },
      "compliance-monitoring": { score: 80, findings: 3 }
    },
    recentFindings: [
      {
        id: "finding-1",
        rule: "dp-1-1",
        severity: "medium",
        description: "Encryption standard needs upgrade"
      }
    ]
  };
});

// Handle tool requests
server.setRequestHandler("validate", async (params) => {
  const { content, context, options } = params;
  // Implementation would perform actual validation
  return {
    valid: true,
    strictness: options.strictness,
    findings: [],
    recommendations: [
      {
        section: "data-protection",
        suggestion: "Consider upgrading encryption standard",
        priority: "medium"
      }
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      validatedSections: options.sections
    }
  };
});

server.setRequestHandler("generateReport", async (params) => {
  const { timeframe, format, type } = params;
  // Implementation would generate actual report
  return {
    report: {
      type: type,
      format: format,
      timeframe: timeframe,
      content: "Report content would go here...",
      sections: ["summary", "findings", "recommendations"]
    },
    metadata: {
      generated: new Date().toISOString(),
      expires: new Date(Date.now() + 86400000).toISOString()
    }
  };
});

server.setRequestHandler("assessRisk", async (params) => {
  const { context, scenario } = params;
  // Implementation would perform risk assessment
  return {
    riskLevel: "medium",
    factors: [
      { category: "data-protection", level: "low", reason: "Strong encryption in place" },
      { category: "compliance-monitoring", level: "medium", reason: "Review frequency below target" }
    ],
    recommendations: [
      { priority: "high", action: "Increase compliance review frequency" }
    ]
  };
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);`;
          }
        };
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const mockServer = getMockServer();
        const mockContent = getMockContent(serverId);
        
        setServer(mockServer);
        setContent(mockContent);
      } catch (err) {
        console.error('Error fetching server data:', err);
        setError('Failed to load server data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchServerData();
  }, [serverId]);

  const handleStartServer = async () => {
    try {
      await mcpApiClient.startServer(serverId);
      setServer({
        ...server,
        status: 'running',
        uptime: '0m'
      });
    } catch (error) {
      console.error(`Failed to start server ${serverId}:`, error);
      setError(`Failed to start server: ${error.message}`);
    }
  };

  const handleStopServer = async () => {
    try {
      await mcpApiClient.stopServer(serverId);
      setServer({
        ...server,
        status: 'stopped',
        uptime: '-'
      });
    } catch (error) {
      console.error(`Failed to stop server ${serverId}:`, error);
      setError(`Failed to stop server: ${error.message}`);
    }
  };

  const handleRestartServer = async () => {
    try {
      setServer({
        ...server,
        status: 'restarting'
      });
      
      await mcpApiClient.stopServer(serverId);
      // Simulate delay for restart
      await new Promise(resolve => setTimeout(resolve, 1000));
      await mcpApiClient.startServer(serverId);
      
      setServer({
        ...server,
        status: 'running',
        uptime: '0m'
      });
    } catch (error) {
      console.error(`Failed to restart server ${serverId}:`, error);
      setError(`Failed to restart server: ${error.message}`);
      // Restore previous status if restart fails
      setServer({
        ...server,
        status: server.status
      });
    }
  };

  // Function to poll for inspector output
  const pollInspectorOutput = async (srvId) => {
    try {
      const outputResponse = await mcpApiClient.getInspectorOutput(srvId);
      if (outputResponse && outputResponse.output) {
        setInspectorOutput(outputResponse.output);
      }
    } catch (error) {
      console.error('Error polling inspector output:', error);
    }
  };

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (outputPollingInterval) {
        clearInterval(outputPollingInterval);
      }
    };
  }, [outputPollingInterval]);

  const handleInspect = async () => {
    try {
      setIsInspecting(true);
      setInspectorOutput('');
      
      // Clear any existing polling interval
      if (outputPollingInterval) {
        clearInterval(outputPollingInterval);
        setOutputPollingInterval(null);
      }
      
      try {
        const response = await mcpApiClient.launchInspector({
          serverId: server.id,
          port: server.port,
          serverType: server.type,
          command: `npx @modelcontextprotocol/inspector http://localhost:${server.port}`
        });
        
        // Start polling for real-time output
        if (response && response.success) {
          setLastProcessId(response.processId);
          
          // Do initial poll immediately
          await pollInspectorOutput(server.id);
          
          // Then set up interval for continued polling
          const interval = setInterval(() => {
            pollInspectorOutput(server.id);
          }, 1000); // Poll every 1 second
          
          setOutputPollingInterval(interval);
        }
        
        // Open a new window/tab with the inspector URL if provided by the API
        if (response && response.inspectorUrl) {
          window.open(response.inspectorUrl, '_blank');
        }
      } catch (apiError) {
        // Handle API errors
        console.error('API error when launching inspector:', apiError);
        setInspectorOutput(`Error: ${apiError.message || 'Failed to launch inspector'}\n`);
        setError(`Failed to launch MCP Inspector: ${apiError.message}`);
      }
    } catch (error) {
      console.error('Failed to start MCP Inspector:', error);
      setError('Failed to start MCP Inspector. Please try again.');
    } finally {
      setIsInspecting(false);
    }
  };

  if (loading) {
    return <LoadingIndicator>Loading server information...</LoadingIndicator>;
  }

  if (!server) {
    return (
      <DetailContainer>
        <Header>
          <BackButton onClick={() => navigate(-1)}>Back to Dashboard</BackButton>
        </Header>
        <ErrorMessage>Server not found or could not be loaded.</ErrorMessage>
      </DetailContainer>
    );
  }

  return (
    <DetailContainer>
      <Header>
        <BackButton onClick={() => navigate(-1)}>Back to Dashboard</BackButton>
        <Title>{server.name}</Title>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <ServerInfoCard>
        <ServerStatus>
          <StatusIndicator status={server.status} />
          <StatusText>{server.status}</StatusText>
        </ServerStatus>

        <ServerInfoGrid>
          <InfoItem>
            <InfoLabel>Type</InfoLabel>
            <InfoValue>{server.type}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>Category</InfoLabel>
            <InfoValue>{server.category}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>Port</InfoLabel>
            <InfoValue>{server.port}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>Address</InfoLabel>
            <InfoValue>{server.address}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>Uptime</InfoLabel>
            <InfoValue>{server.uptime}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>Version</InfoLabel>
            <InfoValue>{server.version}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>Memory Usage</InfoLabel>
            <InfoValue>{server.memoryUsage}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>CPU Usage</InfoLabel>
            <InfoValue>{server.cpuUsage}</InfoValue>
          </InfoItem>
        </ServerInfoGrid>

        <ActionButtons>
          {server.status === 'stopped' ? (
            <ActionButton
              variant="start"
              onClick={handleStartServer}
            >
              Start Server
            </ActionButton>
          ) : (
            <>
              <ActionButton
                variant="stop"
                onClick={handleStopServer}
              >
                Stop Server
              </ActionButton>
              <ActionButton
                variant="restart"
                onClick={handleRestartServer}
              >
                Restart Server
              </ActionButton>
            </>
          )}
        </ActionButtons>
      </ServerInfoCard>

      <InspectorSection>
        <InspectorCard>
          <InspectorHeader>
            <InspectorIcon>🔍</InspectorIcon>
            MCP Inspector
          </InspectorHeader>
          <InspectorDescription>
            Inspect this MCP server using the MCP Inspector tool. This will open an interactive interface to explore
            the server's resources, prompts, and tools. The inspector provides detailed debugging information
            and allows you to test the server's functionality.
          </InspectorDescription>
          
          <CommandPreview>
            {`npx @modelcontextprotocol/inspector http://localhost:${server?.port || '3000'}`}
          </CommandPreview>
          
          <InspectorButton 
            onClick={handleInspect} 
            disabled={isInspecting}
          >
            <InspectorButtonIcon>🔍</InspectorButtonIcon>
            {isInspecting ? 'Launching Inspector...' : 'Launch MCP Inspector'}
          </InspectorButton>
          
          {/* Removed server status check warning */}
          
          {inspectorOutput && (
            <CommandOutput>
              {inspectorOutput}
            </CommandOutput>
          )}
        </InspectorCard>
      </InspectorSection>

      <ContentSection>
        <ContentHeader>Server Content</ContentHeader>
        <ContentCard>
          <ContentPreview>
            {content}
          </ContentPreview>
        </ContentCard>
      </ContentSection>
    </DetailContainer>
  );
};

export default MCPServerDetail; 