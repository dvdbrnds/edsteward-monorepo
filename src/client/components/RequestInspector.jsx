import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import mcpApiClient from '../api/MCPApiClient';

const Container = styled.div`
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 20px 0;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  background-color: #f5f5f5;
  padding: 10px 15px;
  border-bottom: 1px solid #ddd;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  &:hover {
    color: #000;
  }
`;

const Body = styled.div`
  padding: ${props => props.isOpen ? '15px' : '0'};
  max-height: ${props => props.isOpen ? '500px' : '0'};
  overflow-y: auto;
  transition: all 0.3s ease;
`;

const RequestList = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const RequestItem = styled.div`
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #ccc;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  &.selected {
    border-color: #4CAF50;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
`;

const RequestHeader = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 10px 15px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
`;

const RequestMethod = styled.span`
  font-weight: 600;
  color: #444;
`;

const RequestTime = styled.span`
  color: #777;
  font-size: 0.9em;
`;

const RequestStatus = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 600;
  background-color: ${props => {
    if (props.status >= 200 && props.status < 300) return '#e6f7e6';
    if (props.status >= 400) return '#ffebee';
    return '#fff8e1';
  }};
  color: ${props => {
    if (props.status >= 200 && props.status < 300) return '#2e7d32';
    if (props.status >= 400) return '#c62828';
    return '#f57f17';
  }};
`;

const RequestDetails = styled.div`
  padding: ${props => props.isOpen ? '15px' : '0'};
  max-height: ${props => props.isOpen ? '500px' : '0'};
  overflow: hidden;
  transition: all 0.3s ease;
`;

const TabHeader = styled.div`
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 15px;
`;

const Tab = styled.div`
  padding: 8px 15px;
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? '#4CAF50' : 'transparent'};
  color: ${props => props.active ? '#4CAF50' : '#555'};
  font-weight: ${props => props.active ? '600' : 'normal'};
  
  &:hover {
    color: ${props => props.active ? '#4CAF50' : '#000'};
  }
`;

const CodeBlock = styled.pre`
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 13px;
  margin: 0;
`;

const MetadataItem = styled.div`
  display: flex;
  margin-bottom: 8px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const MetadataLabel = styled.div`
  font-weight: 600;
  width: 120px;
  color: #555;
`;

const MetadataValue = styled.div`
  flex: 1;
`;

const ActionButton = styled.button`
  background-color: ${props => props.primary ? '#4CAF50' : '#f5f5f5'};
  color: ${props => props.primary ? 'white' : '#333'};
  border: 1px solid ${props => props.primary ? '#4CAF50' : '#ddd'};
  padding: 5px 10px;
  border-radius: 4px;
  margin-right: 10px;
  cursor: pointer;
  font-size: 0.9em;
  
  &:hover {
    background-color: ${props => props.primary ? '#3d8b40' : '#e5e5e5'};
  }
  
  &:last-child {
    margin-right: 0;
  }
`;

const Actions = styled.div`
  margin-top: 15px;
  display: flex;
  justify-content: flex-end;
`;

const RequestInspector = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('request');
  const [isPolling, setIsPolling] = useState(true);
  const lastRequestIdRef = useRef(null);

  // Simulate the capture of API requests by polling
  useEffect(() => {
    let isMounted = true;
    let intervalId;

    const captureRequests = async () => {
      try {
        // Perform a real request to demonstrate capturing
        if (Math.random() > 0.7) {  // Occasionally make a real API call
          const endpoint = Math.random() > 0.5 ? 'getServerStatus' : 'processComplianceQuery';
          
          if (endpoint === 'getServerStatus') {
            await mcpApiClient.getServerStatus();
          } else {
            await mcpApiClient.processComplianceQuery('Is this document GDPR compliant?');
          }
        }

        // In a real implementation, you would intercept the actual axios requests
        // Here we're simulating for demonstration purposes
        if (isMounted) {
          const newRequest = generateMockRequest();
          
          if (lastRequestIdRef.current !== newRequest.id) {
            lastRequestIdRef.current = newRequest.id;
            setRequests(prev => [newRequest, ...prev].slice(0, 100)); // Limit to 100 entries
          }
        }
      } catch (error) {
        console.error('Error capturing requests:', error);
      }
    };

    if (isPolling) {
      // Initial capture
      captureRequests();
      
      // Set up interval for periodic captures
      intervalId = setInterval(captureRequests, 5000);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling]);

  const generateMockRequest = () => {
    const endpoints = [
      '/health',
      '/compliance/query',
      '/api/regulations',
      '/api/regulations/123',
      '/api/servers',
      '/api/batch/jobs'
    ];
    
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const statusCodes = [200, 201, 400, 404, 500];
    const weights = [0.7, 0.1, 0.1, 0.05, 0.05]; // Weights for status codes (70% 200, 5% 500, etc.)
    
    const method = methods[Math.floor(Math.random() * methods.length)];
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    // Weighted random status code
    let statusCode;
    const rand = Math.random();
    let cumulativeWeight = 0;
    for (let i = 0; i < statusCodes.length; i++) {
      cumulativeWeight += weights[i];
      if (rand < cumulativeWeight) {
        statusCode = statusCodes[i];
        break;
      }
    }
    
    // Generate request and response bodies based on endpoint
    let requestBody = {};
    let responseBody = {};
    
    if (endpoint === '/compliance/query') {
      requestBody = { 
        query: 'Is this document compliant with GDPR regulations?',
        regulationId: 'gdpr-123' 
      };
      responseBody = { 
        result: Math.random() > 0.3 ? 'compliant' : 'non_compliant',
        confidence: Math.random().toFixed(2),
        details: {
          analysis: 'The document contains appropriate privacy notices and consent mechanisms.',
          findings: [
            { type: 'info', text: 'Privacy policy present' },
            { type: 'warning', text: 'Data retention policy could be more specific' }
          ]
        }
      };
    } else if (endpoint === '/api/regulations') {
      if (method === 'GET') {
        responseBody = [
          { id: 'gdpr-123', name: 'GDPR', version: '1.0.0', status: 'active' },
          { id: 'hipaa-456', name: 'HIPAA', version: '1.2.1', status: 'active' }
        ];
      } else if (method === 'POST') {
        requestBody = { name: 'New Regulation', description: 'Description of the new regulation' };
        responseBody = { id: 'new-789', name: 'New Regulation', status: 'pending' };
      }
    } else if (endpoint === '/health') {
      responseBody = { status: 'healthy', version: '1.2.3', uptime: '1d 3h 45m' };
    }
    
    // Calculate timing
    const timing = Math.floor(Math.random() * 500) + 20; // 20-520ms
    
    return {
      id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      status: statusCode,
      timing,
      request: {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        body: requestBody
      },
      response: {
        headers: {
          'Content-Type': 'application/json',
          'Server': 'MCP-Engine/1.0'
        },
        body: responseBody
      }
    };
  };

  const handleReplayRequest = (request) => {
    toast.info(`Replaying ${request.method} request to ${request.endpoint}`);
    
    // In a real implementation, you would actually resend the request
    // This is a simulation
    setTimeout(() => {
      const newRequest = {
        ...request,
        id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString()
      };
      
      setRequests(prev => [newRequest, ...prev].slice(0, 100));
      toast.success('Request replayed successfully');
    }, 1000);
  };

  const handleRequestSelect = (request) => {
    setSelectedRequest(request.id);
    setActiveTab('request');
  };

  const formatJson = (json) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (error) {
      return String(json);
    }
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      return timestamp;
    }
  };

  const handleCopyRequest = () => {
    const requestJson = formatJson(selectedRequest.request.body);
    navigator.clipboard.writeText(requestJson)
      .then(() => toast.success('Request copied to clipboard'))
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  const handleCopyResponse = () => {
    const responseJson = formatJson(selectedRequest.response.body);
    navigator.clipboard.writeText(responseJson)
      .then(() => toast.success('Response copied to clipboard'))
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  return (
    <Container>
      <Header>
        <Title>API Request Inspector</Title>
        <ToggleButton onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '▲ Collapse' : '▼ Expand'}
        </ToggleButton>
      </Header>
      <Body isOpen={isOpen}>
        <RequestList>
          {requests.map(request => (
            <RequestItem 
              key={request.id} 
              className={selectedRequest === request.id ? 'selected' : ''}
              onClick={() => handleRequestSelect(request)}
            >
              <RequestHeader>
                <div>
                  <RequestMethod>{request.method}</RequestMethod>
                  {' '}{request.endpoint}
                </div>
                <div>
                  <RequestStatus status={request.status}>{request.status}</RequestStatus>
                  {' '}
                  <RequestTime>{formatTimestamp(request.timestamp)}</RequestTime>
                </div>
              </RequestHeader>
              
              {selectedRequest === request.id && (
                <RequestDetails isOpen={true}>
                  <TabHeader>
                    <Tab 
                      active={activeTab === 'request'} 
                      onClick={() => setActiveTab('request')}
                    >
                      Request
                    </Tab>
                    <Tab 
                      active={activeTab === 'response'} 
                      onClick={() => setActiveTab('response')}
                    >
                      Response
                    </Tab>
                    <Tab 
                      active={activeTab === 'metadata'} 
                      onClick={() => setActiveTab('metadata')}
                    >
                      Metadata
                    </Tab>
                  </TabHeader>
                  
                  {activeTab === 'request' && (
                    <>
                      <h4>Headers</h4>
                      <CodeBlock>{formatJson(request.request.headers)}</CodeBlock>
                      
                      {request.request.body && (
                        <>
                          <h4>Body</h4>
                          <CodeBlock>{formatJson(request.request.body)}</CodeBlock>
                        </>
                      )}
                      
                      <Actions>
                        <ActionButton onClick={handleCopyRequest}>Copy</ActionButton>
                        <ActionButton primary onClick={() => handleReplayRequest(request)}>Replay</ActionButton>
                      </Actions>
                    </>
                  )}
                  
                  {activeTab === 'response' && (
                    <>
                      <h4>Headers</h4>
                      <CodeBlock>{formatJson(request.response.headers)}</CodeBlock>
                      
                      <h4>Body</h4>
                      <CodeBlock>{formatJson(request.response.body)}</CodeBlock>
                      
                      <Actions>
                        <ActionButton onClick={handleCopyResponse}>Copy</ActionButton>
                      </Actions>
                    </>
                  )}
                  
                  {activeTab === 'metadata' && (
                    <>
                      <MetadataItem>
                        <MetadataLabel>Method:</MetadataLabel>
                        <MetadataValue>{request.method}</MetadataValue>
                      </MetadataItem>
                      <MetadataItem>
                        <MetadataLabel>URL:</MetadataLabel>
                        <MetadataValue>{request.endpoint}</MetadataValue>
                      </MetadataItem>
                      <MetadataItem>
                        <MetadataLabel>Status:</MetadataLabel>
                        <MetadataValue>{request.status}</MetadataValue>
                      </MetadataItem>
                      <MetadataItem>
                        <MetadataLabel>Time:</MetadataLabel>
                        <MetadataValue>{request.timestamp}</MetadataValue>
                      </MetadataItem>
                      <MetadataItem>
                        <MetadataLabel>Duration:</MetadataLabel>
                        <MetadataValue>{request.timing}ms</MetadataValue>
                      </MetadataItem>
                    </>
                  )}
                </RequestDetails>
              )}
            </RequestItem>
          ))}
        </RequestList>
      </Body>
    </Container>
  );
};

export default RequestInspector; 