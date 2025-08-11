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
        
        // NEW APPROACH: If this is a regulation server ID, don't even try to find it
        // Just directly create the appropriate mockup based on the ID prefix
        if (serverId.startsWith('regulation-')) {
          console.log(`Using direct mapping for regulation ID: ${serverId}`);
          
          // Determine which regulation type based on the ID
          // Important: The actual regulation IDs in regulations.json are:
          // "gdpr-2018", "hipaa-1996", "ccpa-2018" (without "regulation-" prefix)
          let regulationType = 'gdpr';
          let regulationName = 'General Data Protection Regulation';
          let regulationId = 'gdpr-2018';
          
          if (serverId.toLowerCase().includes('hipaa') || 
              serverId.toLowerCase().includes('resea') || 
              serverId.toLowerCase().includes('health')) {
            regulationType = 'hipaa';
            regulationName = 'Health Insurance Portability and Accountability Act';
            regulationId = 'hipaa-1996';
          } 
          else if (serverId.toLowerCase().includes('ccpa') || 
                   serverId.toLowerCase().includes('priv') || 
                   serverId.toLowerCase().includes('consumer')) {
            regulationType = 'ccpa';
            regulationName = 'California Consumer Privacy Act';
            regulationId = 'ccpa-2018';
          }
          else if (serverId.toLowerCase().includes('reg-66') || 
                   serverId.toLowerCase().includes('ferpa') || 
                   serverId.toLowerCase().includes('education')) {
            regulationType = 'reg-66';
            regulationName = 'FERPA Section 66 - Advanced LinearEngine Template';
            regulationId = 'reg-66';
          }
          // Default is gdpr which is already set above
          
          // Create server object - use the real regulation ID without "regulation-" prefix
          const regulationServer = {
            id: regulationId, // Use the real regulation ID
            name: regulationName,
            type: `${regulationType} Regulation Server`,
            category: 'Regulation',
            status: 'running',
            port: 3200,
            address: `http://localhost:3200`,
            uptime: '2h 15m',
            version: '1.0.0',
            memoryUsage: '75 MB',
            cpuUsage: '5%',
            endpoints: ['/status', '/validate', '/info', '/health'],
            config: {
              logLevel: 'info',
              maxConnections: 100,
              timeout: 30000
            }
          };
          
          setServer(regulationServer);
          const contentText = getMockContent(regulationId);
          setContent(contentText);
        }
        else {
          // For non-regulation servers, try to get the server from the API
          const serverResponse = await mcpApiClient.getServers();
          
          if (serverResponse && serverResponse.data) {
            // Try to find the server with the exact ID
            let serverData = serverResponse.data.find(s => s.id === serverId);
            
            if (serverData) {
              console.log("Found server data:", serverData);
              setServer(serverData);
              
              // Set content based on server type
              const contentText = getMockContent(serverData.id);
              setContent(contentText);
            } else {
              console.error(`Server with ID ${serverId} not found in servers list`);
              setError(`Server with ID ${serverId} not found in servers list`);
              
              // Fallback to mock data for development
              const mockServer = getMockServer();
              setServer(mockServer);
              
              const contentText = getMockContent(mockServer.id);
              setContent(contentText);
            }
          } else {
            console.error("Failed to fetch servers");
            setError("Failed to fetch server data");
            
            // Fallback to mock server
            const mockServer = getMockServer();
            setServer(mockServer);
            
            const contentText = getMockContent(mockServer.id);
            setContent(contentText);
          }
        }
      } catch (err) {
        console.error(`Error fetching server data for ${serverId}:`, err);
        setError(`Error loading server details: ${err.message}`);
        
        // Fallback to mock server
        const mockServer = getMockServer();
        setServer(mockServer);
        
        const contentText = getMockContent(mockServer.id);
        setContent(contentText);
      } finally {
        setLoading(false);
      }
    };
        
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
    
    // Generate mock content based on server type
    const getMockContent = (serverId) => {
      if (serverId.includes('llm-gateway') || serverId.includes('gateway')) {
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
      }
    }
  }
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
      }
    }
  }
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
      }
    }
  }
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);`;
      } else {
        // For regulation servers (gdpr, hipaa, ccpa)
        let regulationName = "Generic Regulation";
        let regulationId = "generic-regulation";
        
        if (serverId.includes('gdpr')) {
          regulationName = "General Data Protection Regulation";
          regulationId = "gdpr-2018";
        } else if (serverId.includes('hipaa')) {
          regulationName = "Health Insurance Portability and Accountability Act";
          regulationId = "hipaa-1996";
        } else if (serverId.includes('ccpa')) {
          regulationName = "California Consumer Privacy Act";
          regulationId = "ccpa-2018";
        }
        
        return `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create Regulation-specific MCP server for ${regulationName}
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
      }
    },
    resources: {
      regulationContent: {
        description: "Get full regulation content and metadata",
        type: "object"
      }
    },
    tools: {
      validate: {
        description: "Validate content against regulation rules",
        parameters: {
          content: { type: "string" },
          context: { type: "object" }
        }
      }
    }
  }
});

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);`;
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