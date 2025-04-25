import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import axios from 'axios';

// MCP client SDK implementation
class MCPClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.nextId = 1;
    this.connected = false;
  }

  async initialize() {
    try {
      const response = await axios.post(this.serverUrl, {
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'MCP Validation UI',
            version: '1.0.0'
          },
          capabilities: {}
        }
      });

      if (response.data.error) {
        throw new Error(`MCP initialization error: ${response.data.error.message}`);
      }

      // Send initialized notification
      await axios.post(this.serverUrl, {
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
      });

      this.connected = true;
      return response.data.result;
    } catch (error) {
      console.error('MCP initialization failed:', error);
      throw error;
    }
  }

  async request(method, params = {}) {
    if (!this.connected && method !== 'initialize') {
      await this.initialize();
    }

    try {
      const response = await axios.post(this.serverUrl, {
        jsonrpc: '2.0',
        id: this.nextId++,
        method,
        params
      });

      if (response.data.error) {
        throw {
          code: response.data.error.code,
          message: response.data.error.message,
          data: response.data.error.data
        };
      }

      return response.data.result;
    } catch (error) {
      console.error(`MCP request error (${method}):`, error);
      throw error;
    }
  }

  async close() {
    if (this.connected) {
      try {
        await axios.post(this.serverUrl, {
          jsonrpc: '2.0',
          method: 'shutdown',
          id: this.nextId++
        });
        
        await axios.post(this.serverUrl, {
          jsonrpc: '2.0',
          method: 'exit',
          params: {}
        });
        
        this.connected = false;
      } catch (error) {
        console.error('Error closing MCP connection:', error);
      }
    }
  }
}

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 28px;
  margin-bottom: 8px;
  color: ${props => props.theme.colors.text};
`;

const Subtitle = styled.h2`
  font-size: 18px;
  margin-bottom: 24px;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: normal;
`;

const Button = styled.button`
  background-color: ${props => props.primary ? props.theme.colors.primary : props.theme.colors.secondary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.primary ? props.theme.colors.primaryDark : props.theme.colors.secondary};
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  margin-bottom: 16px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const Card = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  margin-bottom: 24px;
`;

const Label = styled.div`
  font-weight: 600;
  margin-bottom: 8px;
  color: ${props => props.theme.colors.textSecondary};
`;

const Value = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const List = styled.ul`
  margin: 0;
  padding-left: 20px;
`;

const ListItem = styled.li`
  margin-bottom: 8px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 40px;
  color: ${props => props.theme.colors.textSecondary};
`;

const ErrorMessage = styled.div`
  background-color: ${props => props.theme.colors.danger};
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
`;

// Add a new styled component for the MCP server status alert
const McpServerAlert = styled.div`
  background-color: ${props => props.theme.colors.warning};
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const AlertMessage = styled.div`
  flex: 1;
`;

const AlertButton = styled(Button)`
  margin-left: 16px;
`;

// Update the mockRegulations data with the management URL
const mockRegulations = [
  {
    regulationId: 'GDPR-2018',
    name: 'General Data Protection Regulation',
    description: 'EU data protection and privacy regulation',
    version: '1.0',
    lastCollected: null,
    details: {
      fullName: 'General Data Protection Regulation (GDPR)',
      effectiveDate: '2018-05-25',
      jurisdiction: 'European Union',
      category: 'Data Privacy',
      summary: 'The General Data Protection Regulation is a regulation in EU law on data protection and privacy in the European Union and the European Economic Area. It also addresses the transfer of personal data outside the EU and EEA areas.',
      keyRequirements: [
        'Lawful basis for processing',
        'Consent requirements',
        'Right to access',
        'Right to be forgotten',
        'Data breach notification',
        'Privacy by design'
      ]
    }
  },
  {
    regulationId: 'HIPAA-2022',
    name: 'Health Insurance Portability and Accountability Act',
    description: 'US healthcare privacy regulation',
    version: '2.1',
    lastCollected: '2023-01-15T10:30:00Z',
    details: {
      fullName: 'Health Insurance Portability and Accountability Act (HIPAA)',
      effectiveDate: '1996-08-21',
      jurisdiction: 'United States',
      category: 'Healthcare Privacy',
      summary: 'HIPAA establishes national standards to protect individuals\' medical records and other personal health information and applies to health plans, health care clearinghouses, and health care providers.',
      keyRequirements: [
        'Privacy Rule',
        'Security Rule',
        'Breach Notification Rule',
        'Patient rights to health information',
        'Business Associate Agreements',
        'Administrative safeguards'
      ]
    }
  },
  {
    regulationId: 'CSRA-1978',
    name: 'Civil Service Reform Act of 1978',
    description: 'Federal civil service system reform that established OPM, MSPB, and FLRA',
    version: '1.0',
    lastCollected: null,
    mcpManagementUrl: 'http://localhost:3005',
    mcpServerType: 'csra-mcp',
    details: {
      fullName: 'Civil Service Reform Act of 1978 (CSRA)',
      effectiveDate: '1978-10-13',
      jurisdiction: 'United States',
      category: 'Government Personnel',
      summary: 'The Civil Service Reform Act of 1978 is a United States federal law that replaced the Civil Service Commission with the Office of Personnel Management, the Merit Systems Protection Board, and the Federal Labor Relations Authority.',
      implementedBy: [
        'Office of Personnel Management (OPM)',
        'Merit Systems Protection Board (MSPB)',
        'Federal Labor Relations Authority (FLRA)'
      ]
    }
  }
];

const RegulationDetails = () => {
  const { regulationId } = useParams();
  const navigate = useNavigate();
  const [regulation, setRegulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mcpData, setMcpData] = useState(null);
  const [loadingMcpData, setLoadingMcpData] = useState(false);
  const [mcpClient, setMcpClient] = useState(null);
  const [mcpConnectionStatus, setMcpConnectionStatus] = useState('disconnected');
  const [mcpServerUrl, setMcpServerUrl] = useState(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  
  useEffect(() => {
    // In a real app, fetch from API
    const fetchRegulation = async () => {
      try {
        setLoading(true);
        
        // Simulate API call with delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const foundRegulation = mockRegulations.find(reg => reg.regulationId === regulationId);
        
        if (!foundRegulation) {
          setError(`Regulation with ID ${regulationId} not found`);
        } else {
          setRegulation(foundRegulation);
          console.log('Found regulation:', foundRegulation);
          
          // If it has an MCP management URL, check server status
          if (foundRegulation.mcpManagementUrl) {
            try {
              console.log('Checking MCP management status at:', `${foundRegulation.mcpManagementUrl}/mcp-server-status`);
              const statusResponse = await axios.get(`${foundRegulation.mcpManagementUrl}/mcp-server-status`);
              console.log('MCP status response:', statusResponse.data);
              
              if (statusResponse.data.running) {
                setMcpServerUrl(statusResponse.data.url);
                setMcpConnectionStatus('available');
                console.log('MCP server is available at:', statusResponse.data.url);
              } else {
                setMcpConnectionStatus('not_running');
                console.log('MCP server is not running');
              }
            } catch (error) {
              console.error('MCP management service not available:', error);
              setMcpConnectionStatus('management_unavailable');
            }
          }
        }
      } catch (err) {
        setError('Failed to load regulation details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRegulation();
    
    // Cleanup - close MCP connection when component unmounts
    return () => {
      if (mcpClient) {
        mcpClient.close().catch(err => console.error('Error closing MCP connection:', err));
      }
    };
  }, [regulationId]);
  
  const startMcpServer = async () => {
    if (!regulation || !regulation.mcpManagementUrl) {
      console.error('Cannot start MCP server - regulation or management URL not available');
      toast.error('MCP management URL not available');
      return;
    }
    
    console.log('Starting MCP server with management URL:', regulation.mcpManagementUrl);
    
    try {
      setIsStartingServer(true);
      
      // Request to start the server
      console.log('Sending POST request to:', `${regulation.mcpManagementUrl}/start-mcp-server`);
      const startResponse = await axios.post(`${regulation.mcpManagementUrl}/start-mcp-server`);
      console.log('Start server response:', startResponse.data);
      
      if (startResponse.data.success) {
        setMcpServerUrl(startResponse.data.url);
        setMcpConnectionStatus('available');
        toast.success(`MCP server started on port ${startResponse.data.port}`);
        console.log('MCP server started successfully on port:', startResponse.data.port);
      } else {
        throw new Error('Failed to start MCP server');
      }
    } catch (error) {
      console.error('Error starting MCP server:', error);
      toast.error(`Failed to start MCP server: ${error.message}`);
      setMcpConnectionStatus('error');
    } finally {
      setIsStartingServer(false);
    }
  };
  
  const fetchMcpData = async () => {
    if (!mcpServerUrl) {
      toast.error('MCP server URL not available');
      return;
    }
    
    // Create new client with dynamic server URL
    const client = new MCPClient(mcpServerUrl);
    setMcpClient(client);
    
    try {
      setLoadingMcpData(true);
      setMcpConnectionStatus('connecting');
      
      // Initialize the connection properly following MCP protocol
      await client.initialize();
      setMcpConnectionStatus('connected');
      
      // Get comprehensive information using proper request pattern
      const [infoResult, provisionsResult, agenciesResult] = await Promise.all([
        client.request('getActInfo'),
        client.request('getKeyProvisions'),
        client.request('getAgenciesCreated')
      ]);
      
      const mcpDataCompiled = {
        info: infoResult,
        provisions: provisionsResult.provisions,
        agencies: agenciesResult.agencies
      };
      
      setMcpData(mcpDataCompiled);
      toast.success('Successfully fetched data from MCP server');
      
    } catch (error) {
      console.error('Error fetching MCP data:', error);
      setMcpConnectionStatus('error');
      
      // Handle specific error codes
      if (error.code) {
        switch (error.code) {
          case -32700:
            toast.error('Parse error: Invalid JSON received');
            break;
          case -32600:
            toast.error('Invalid request: The request was malformed');
            break;
          case -32601:
            toast.error('Method not found: The requested method is not supported');
            break;
          case -32602:
            toast.error('Invalid parameters for request');
            break;
          case -32603:
            toast.error('Internal server error');
            break;
          default:
            toast.error(`Error fetching MCP data: ${error.message || 'Unknown error'}`);
        }
      } else {
        toast.error(`Network error: ${error.message || 'Failed to connect to MCP server'}`);
      }
    } finally {
      setLoadingMcpData(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  const goBack = () => {
    navigate(-1);
  };
  
  if (loading) {
    return (
      <Container>
        <BackButton onClick={goBack}>← Back</BackButton>
        <LoadingIndicator>Loading regulation details...</LoadingIndicator>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container>
        <BackButton onClick={goBack}>← Back</BackButton>
        <ErrorMessage>{error}</ErrorMessage>
      </Container>
    );
  }
  
  if (!regulation) {
    return (
      <Container>
        <BackButton onClick={goBack}>← Back</BackButton>
        <ErrorMessage>Regulation not found</ErrorMessage>
      </Container>
    );
  }
  
  const renderMcpButton = () => {
    console.log('renderMcpButton called, mcpConnectionStatus:', mcpConnectionStatus);
    
    if (!regulation.mcpManagementUrl) {
      console.log('No mcpManagementUrl found in regulation');
      return null;
    }
    
    if (mcpConnectionStatus === 'not_running' || mcpConnectionStatus === 'management_unavailable' || mcpConnectionStatus === 'disconnected') {
      console.log('MCP status indicates server needs to be started, showing Start button');
      return (
        <Button 
          primary 
          onClick={startMcpServer}
          disabled={isStartingServer}
        >
          {isStartingServer ? 'Starting MCP Server...' : 'Start MCP Server'}
        </Button>
      );
    } else if (mcpConnectionStatus === 'available') {
      console.log('MCP status is available, showing Fetch button');
      return (
        <Button 
          primary 
          onClick={fetchMcpData}
          disabled={loadingMcpData}
        >
          {loadingMcpData ? 'Fetching...' : 'Fetch MCP Data'}
        </Button>
      );
    } else if (mcpConnectionStatus === 'connecting' || mcpConnectionStatus === 'connected') {
      console.log('MCP status is connecting or connected, showing Connected button');
      return (
        <Button 
          disabled={true}
        >
          {loadingMcpData ? 'Fetching...' : 'Connected to MCP Server'}
        </Button>
      );
    } else if (mcpConnectionStatus === 'error') {
      console.log('MCP status is error, showing Restart button');
      return (
        <Button 
          primary 
          onClick={startMcpServer}
          disabled={isStartingServer}
        >
          Restart MCP Server
        </Button>
      );
    }
    
    console.log('No condition matched, mcpConnectionStatus:', mcpConnectionStatus);
    return null;
  };
  
  return (
    <Container>
      <BackButton onClick={goBack}>← Back</BackButton>
      
      <Header>
        <div>
          <Title>{regulation.name}</Title>
          <Subtitle>ID: {regulation.regulationId} • Version: {regulation.version}</Subtitle>
        </div>
        
        {regulation.mcpManagementUrl && (
          <div>
            {renderMcpButton()}
            <div style={{ fontSize: '12px', marginTop: '4px', textAlign: 'right' }}>
              MCP Status: {mcpConnectionStatus}
            </div>
          </div>
        )}
      </Header>
      
      {(mcpConnectionStatus === 'not_running' || mcpConnectionStatus === 'management_unavailable' || mcpConnectionStatus === 'disconnected') && (
        <McpServerAlert>
          <AlertMessage>
            <strong>MCP Server is offline.</strong> You need to start the MCP server to access additional data about this regulation.
          </AlertMessage>
          <AlertButton 
            primary 
            onClick={startMcpServer}
            disabled={isStartingServer}
          >
            {isStartingServer ? 'Starting...' : 'Start MCP Server'}
          </AlertButton>
        </McpServerAlert>
      )}
      
      <Card>
        <Label>Description</Label>
        <Value>{regulation.description}</Value>
        
        <Label>Last Data Collection</Label>
        <Value>{regulation.lastCollected ? formatDate(regulation.lastCollected) : 'Never'}</Value>
      </Card>
      
      <Card>
        <Label>Full Name</Label>
        <Value>{regulation.details.fullName}</Value>
        
        <Label>Effective Date</Label>
        <Value>{formatDate(regulation.details.effectiveDate)}</Value>
        
        <Label>Jurisdiction</Label>
        <Value>{regulation.details.jurisdiction}</Value>
        
        <Label>Category</Label>
        <Value>{regulation.details.category}</Value>
        
        <Label>Summary</Label>
        <Value>{regulation.details.summary}</Value>
        
        {regulation.details.keyRequirements && (
          <>
            <Label>Key Requirements</Label>
            <Value>
              <List>
                {regulation.details.keyRequirements.map((req, index) => (
                  <ListItem key={index}>{req}</ListItem>
                ))}
              </List>
            </Value>
          </>
        )}
        
        {regulation.details.implementedBy && (
          <>
            <Label>Implemented By</Label>
            <Value>
              <List>
                {regulation.details.implementedBy.map((agency, index) => (
                  <ListItem key={index}>{agency}</ListItem>
                ))}
              </List>
            </Value>
          </>
        )}
      </Card>
      
      {mcpData && (
        <>
          <Title>MCP Server Data</Title>
          
          <Card>
            <Label>Public Law</Label>
            <Value>{mcpData.info.public_law}</Value>
            
            <Label>Enacted</Label>
            <Value>{mcpData.info.enacted}</Value>
            
            <Label>Official Description</Label>
            <Value>{mcpData.info.description}</Value>
          </Card>
          
          <Card>
            <Label>Key Provisions</Label>
            <Value>
              <List>
                {mcpData.provisions.map((provision, index) => (
                  <ListItem key={index}>
                    <strong>{provision.title}</strong>: {provision.description}
                  </ListItem>
                ))}
              </List>
            </Value>
          </Card>
          
          <Card>
            <Label>Agencies Created</Label>
            <Value>
              <List>
                {mcpData.agencies.map((agency, index) => (
                  <ListItem key={index}>
                    <strong>{agency.name}</strong>: {agency.role}
                  </ListItem>
                ))}
              </List>
            </Value>
          </Card>
        </>
      )}
    </Container>
  );
};

export default RegulationDetails; 