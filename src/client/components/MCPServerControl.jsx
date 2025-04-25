import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { toast } from 'react-toastify';

// Styled components
const Container = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  margin-bottom: 2rem;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: ${props => props.theme.colors.primary};
  color: white;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  
  &:hover {
    opacity: 0.8;
  }
`;

const Body = styled.div`
  max-height: ${props => (props.isOpen ? '1500px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: ${props => props.theme.colors.backgroundDark};
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
`;

const Button = styled.button`
  background-color: ${props => {
    if (props.variant === 'start') return props.theme.colors.success;
    if (props.variant === 'stop') return props.theme.colors.error;
    if (props.variant === 'restart') return props.theme.colors.warning;
    return props.theme.colors.primary;
  }};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const FilterBar = styled.div`
  display: flex;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 0.9rem;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 1px ${props => props.theme.colors.primary};
  }
`;

const Select = styled.select`
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 0.9rem;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ServerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
`;

const ServerCard = styled.div`
  background-color: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  padding: 1rem;
  transition: all 0.2s;
  border: 1px solid ${props => props.theme.colors.border};
  cursor: pointer;
  
  &:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  ${props => props.isSelected && `
    border: 2px solid ${props.theme.colors.primary};
    box-shadow: 0 0 0 1px ${props.theme.colors.primary};
  `}
`;

const ServerName = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: ${props => props.theme.colors.text};
`;

const ServerType = styled.div`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  background-color: ${props => {
    switch (props.type) {
      case 'LLM Gateway':
        return '#e0f2fe';
      case 'Regulation Server':
        return '#ecfdf5';
      case 'Batch Server':
        return '#fef3c7';
      default:
        return '#f3f4f6';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'LLM Gateway':
        return '#0369a1';
      case 'Regulation Server':
        return '#047857';
      case 'Batch Server':
        return '#b45309';
      default:
        return '#4b5563';
    }
  }};
`;

const ServerStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const StatusIndicator = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.status) {
      case 'Running':
        return props.theme.colors.success;
      case 'Stopped':
        return props.theme.colors.error;
      case 'Starting':
      case 'Stopping':
        return props.theme.colors.warning;
      default:
        return props.theme.colors.secondary;
    }
  }};
`;

const StatusText = styled.span`
  color: ${props => {
    switch (props.status) {
      case 'Running':
        return props.theme.colors.success;
      case 'Stopped':
        return props.theme.colors.error;
      case 'Starting':
      case 'Stopping':
        return props.theme.colors.warning;
      default:
        return props.theme.colors.secondary;
    }
  }};
  font-size: 0.9rem;
`;

const ServerUptime = styled.div`
  font-size: 0.85rem;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 0.5rem;
`;

const ServerAddress = styled.div`
  font-size: 0.85rem;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ServerCardActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const CardButton = styled.button`
  flex: 1;
  padding: 0.4rem;
  font-size: 0.8rem;
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
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const ServerDetailsContainer = styled.div`
  padding: 1.5rem;
  background-color: ${props => props.theme.colors.backgroundDark};
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const DetailsTabs = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 1rem;
`;

const Tab = styled.button`
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid ${props => 
    props.isActive ? props.theme.colors.primary : 'transparent'};
  color: ${props => 
    props.isActive ? props.theme.colors.primary : props.theme.colors.textSecondary};
  font-weight: ${props => props.isActive ? '600' : '400'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const DetailContent = styled.div`
  background-color: white;
  border-radius: 6px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 0.75rem;
`;

const InfoLabel = styled.div`
  font-weight: 500;
  color: ${props => props.theme.colors.textSecondary};
`;

const InfoValue = styled.div`
  color: ${props => props.theme.colors.text};
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
`;

const MetricCard = styled.div`
  background-color: ${props => props.theme.colors.backgroundDark};
  border-radius: 6px;
  padding: 1rem;
  text-align: center;
`;

const MetricValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 0.5rem;
`;

const MetricLabel = styled.div`
  font-size: 0.85rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
`;

const ConfigItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-radius: 4px;
  background-color: ${props => props.theme.colors.backgroundDark};
  
  &:nth-child(even) {
    background-color: #f8fafc;
  }
`;

const ConfigName = styled.div`
  font-weight: 500;
`;

const ConfigValue = styled.div`
  font-family: ${props => props.theme.fonts.code};
  color: ${props => props.theme.colors.primary};
  background-color: rgba(79, 70, 229, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Mock function to fetch servers
const fetchServers = () => {
  // This would be an API call in a real app
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 1,
          name: 'MCP LLM Gateway',
          type: 'LLM Gateway',
          status: 'Running',
          uptime: '2h 34m',
          category: 'Gateway',
          address: 'http://localhost:3001',
          startTime: '2023-07-15T08:45:00',
          pid: 12345,
          memory: '128MB',
          cpu: '2.3%',
          requests: 347,
          config: {
            port: 3001,
            maxConcurrentRequests: 10,
            timeout: 30000,
            providers: ['OpenAI', 'Anthropic'],
          }
        },
        {
          id: 2,
          name: 'Regulation Registry',
          type: 'Regulation Server',
          status: 'Running',
          uptime: '2h 34m',
          category: 'Registry',
          address: 'http://localhost:3002',
          startTime: '2023-07-15T08:45:15',
          pid: 12346,
          memory: '86MB',
          cpu: '1.2%',
          requests: 125,
          config: {
            port: 3002,
            storagePath: './regulations',
            cacheSize: '100MB',
          }
        },
        {
          id: 3,
          name: 'Batch Processing Server',
          type: 'Batch Server',
          status: 'Running',
          uptime: '2h 33m',
          category: 'Processor',
          address: 'http://localhost:3003',
          startTime: '2023-07-15T08:46:00',
          pid: 12347,
          memory: '156MB',
          cpu: '3.5%',
          requests: 28,
          config: {
            port: 3003,
            maxBatchSize: 100,
            workerCount: 4,
            outputDir: './batch-results',
          }
        },
        {
          id: 4,
          name: 'Test Compliance Server',
          type: 'Regulation Server',
          status: 'Stopped',
          uptime: '0m',
          category: 'Testing',
          address: 'http://localhost:3004',
          startTime: null,
          pid: null,
          memory: '0MB',
          cpu: '0%',
          requests: 0,
          config: {
            port: 3004,
            testMode: true,
            mockResponses: true,
          }
        },
      ]);
    }, 1000);
  });
};

const MCPServerControl = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadServers();
    
    // Poll for updates every 30 seconds
    const intervalId = setInterval(loadServers, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  const loadServers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchServers();
      setServers(data);
      
      // Ensure selection is still valid
      if (selectedServer) {
        const updatedServer = data.find(s => s.id === selectedServer.id);
        setSelectedServer(updatedServer || null);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading servers:', error);
      toast.error('Failed to load server data');
      setIsLoading(false);
    }
  };
  
  const handleStartServer = async (serverId) => {
    // This would be an API call in a real app
    toast.info(`Starting server ${serverId}...`);
    
    // Mock server start
    setServers(prev => 
      prev.map(server => 
        server.id === serverId 
          ? { ...server, status: 'Starting' } 
          : server
      )
    );
    
    // Simulate start completion after 2 seconds
    setTimeout(() => {
      setServers(prev => 
        prev.map(server => 
          server.id === serverId 
            ? { 
                ...server, 
                status: 'Running',
                uptime: '0m',
                startTime: new Date().toISOString(),
                pid: Math.floor(Math.random() * 10000) + 10000,
                memory: '64MB',
                cpu: '1.0%',
              } 
            : server
        )
      );
      
      // Update selected server if it's the one we just started
      if (selectedServer && selectedServer.id === serverId) {
        const updatedServer = servers.find(s => s.id === serverId);
        setSelectedServer(updatedServer);
      }
      
      toast.success(`Server ${serverId} started successfully`);
    }, 2000);
  };
  
  const handleStopServer = async (serverId) => {
    // This would be an API call in a real app
    toast.info(`Stopping server ${serverId}...`);
    
    // Mock server stop
    setServers(prev => 
      prev.map(server => 
        server.id === serverId 
          ? { ...server, status: 'Stopping' } 
          : server
      )
    );
    
    // Simulate stop completion after 1.5 seconds
    setTimeout(() => {
      setServers(prev => 
        prev.map(server => 
          server.id === serverId 
            ? { 
                ...server, 
                status: 'Stopped',
                uptime: '0m',
                startTime: null,
                pid: null,
                memory: '0MB',
                cpu: '0%',
              } 
            : server
        )
      );
      
      // Update selected server if it's the one we just stopped
      if (selectedServer && selectedServer.id === serverId) {
        const updatedServer = servers.find(s => s.id === serverId);
        setSelectedServer(updatedServer);
      }
      
      toast.success(`Server ${serverId} stopped successfully`);
    }, 1500);
  };
  
  const handleRestartServer = async (serverId) => {
    // This would be an API call in a real app
    toast.info(`Restarting server ${serverId}...`);
    
    // First stop the server
    setServers(prev => 
      prev.map(server => 
        server.id === serverId 
          ? { ...server, status: 'Stopping' } 
          : server
      )
    );
    
    // Then start it again
    setTimeout(() => {
      setServers(prev => 
        prev.map(server => 
          server.id === serverId 
            ? { ...server, status: 'Starting' } 
            : server
        )
      );
      
      // Finally set it to running
      setTimeout(() => {
        setServers(prev => 
          prev.map(server => 
            server.id === serverId 
              ? { 
                  ...server, 
                  status: 'Running',
                  uptime: '0m',
                  startTime: new Date().toISOString(),
                  pid: Math.floor(Math.random() * 10000) + 10000,
                } 
              : server
          )
        );
        
        // Update selected server if it's the one we just restarted
        if (selectedServer && selectedServer.id === serverId) {
          const updatedServer = servers.find(s => s.id === serverId);
          setSelectedServer(updatedServer);
        }
        
        toast.success(`Server ${serverId} restarted successfully`);
      }, 1500);
    }, 1500);
  };
  
  const handleStartAll = async () => {
    toast.info('Starting all servers...');
    
    // Get IDs of stopped servers
    const stoppedServerIds = servers
      .filter(server => server.status === 'Stopped')
      .map(server => server.id);
    
    // Start each stopped server with a slight delay between starts
    stoppedServerIds.forEach((id, index) => {
      setTimeout(() => {
        handleStartServer(id);
      }, index * 500);
    });
  };
  
  const handleStopAll = async () => {
    toast.info('Stopping all servers...');
    
    // Get IDs of running servers
    const runningServerIds = servers
      .filter(server => server.status === 'Running')
      .map(server => server.id);
    
    // Stop each running server with a slight delay between stops
    runningServerIds.forEach((id, index) => {
      setTimeout(() => {
        handleStopServer(id);
      }, index * 500);
    });
  };
  
  const handleSelectServer = (server) => {
    setSelectedServer(server.id === selectedServer?.id ? null : server);
    setActiveTab('info');
  };
  
  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };
  
  const filteredServers = servers.filter(server => {
    const matchesFilter = server.name.toLowerCase().includes(filter.toLowerCase()) ||
                         server.type.toLowerCase().includes(filter.toLowerCase()) ||
                         server.address.toLowerCase().includes(filter.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || 
                           server.category.toLowerCase() === categoryFilter.toLowerCase();
    
    return matchesFilter && matchesCategory;
  });
  
  const categories = [...new Set(servers.map(server => server.category))];
  
  return (
    <Container>
      <Header>
        <Title>MCP Server Control</Title>
        <ToggleButton onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? 'Collapse' : 'Expand'}
        </ToggleButton>
      </Header>
      
      <Body isOpen={isOpen}>
        <ActionBar>
          <ActionButtons>
            <Button 
              variant="start" 
              onClick={handleStartAll} 
              disabled={servers.every(s => s.status !== 'Stopped')}
            >
              Start All
            </Button>
            <Button 
              variant="stop" 
              onClick={handleStopAll}
              disabled={servers.every(s => s.status !== 'Running')}
            >
              Stop All
            </Button>
            <Button onClick={loadServers} disabled={isLoading}>
              Refresh
            </Button>
          </ActionButtons>
          
          <FilterBar>
            <Input 
              type="text" 
              placeholder="Filter servers..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category.toLowerCase()}>
                  {category}
                </option>
              ))}
            </Select>
          </FilterBar>
        </ActionBar>
        
        {isLoading && servers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            Loading servers...
          </div>
        ) : filteredServers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            No servers match your filter criteria.
          </div>
        ) : (
          <ServerGrid>
            {filteredServers.map(server => (
              <ServerCard 
                key={server.id} 
                isSelected={selectedServer?.id === server.id}
                onClick={() => handleSelectServer(server)}
              >
                <ServerName>{server.name}</ServerName>
                <ServerType type={server.type}>{server.type}</ServerType>
                <ServerStatus>
                  <StatusIndicator status={server.status} />
                  <StatusText status={server.status}>{server.status}</StatusText>
                </ServerStatus>
                <ServerUptime>Uptime: {server.uptime}</ServerUptime>
                <ServerAddress>Address: {server.address}</ServerAddress>
                
                <ServerCardActions>
                  {server.status === 'Stopped' ? (
                    <CardButton 
                      variant="start" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartServer(server.id);
                      }}
                    >
                      Start
                    </CardButton>
                  ) : server.status === 'Running' ? (
                    <>
                      <CardButton 
                        variant="stop" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopServer(server.id);
                        }}
                      >
                        Stop
                      </CardButton>
                      <CardButton 
                        variant="restart" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestartServer(server.id);
                        }}
                      >
                        Restart
                      </CardButton>
                    </>
                  ) : (
                    <CardButton disabled>
                      {server.status}...
                    </CardButton>
                  )}
                </ServerCardActions>
              </ServerCard>
            ))}
          </ServerGrid>
        )}
        
        {selectedServer && (
          <ServerDetailsContainer>
            <DetailsTabs>
              <Tab 
                isActive={activeTab === 'info'} 
                onClick={() => handleTabClick('info')}
              >
                Server Information
              </Tab>
              <Tab 
                isActive={activeTab === 'metrics'} 
                onClick={() => handleTabClick('metrics')}
              >
                Metrics
              </Tab>
              <Tab 
                isActive={activeTab === 'config'} 
                onClick={() => handleTabClick('config')}
              >
                Configuration
              </Tab>
            </DetailsTabs>
            
            <DetailContent>
              {activeTab === 'info' && (
                <InfoGrid>
                  <InfoLabel>Name</InfoLabel>
                  <InfoValue>{selectedServer.name}</InfoValue>
                  
                  <InfoLabel>Type</InfoLabel>
                  <InfoValue>{selectedServer.type}</InfoValue>
                  
                  <InfoLabel>Category</InfoLabel>
                  <InfoValue>{selectedServer.category}</InfoValue>
                  
                  <InfoLabel>Status</InfoLabel>
                  <InfoValue>
                    <ServerStatus>
                      <StatusIndicator status={selectedServer.status} />
                      <StatusText status={selectedServer.status}>
                        {selectedServer.status}
                      </StatusText>
                    </ServerStatus>
                  </InfoValue>
                  
                  <InfoLabel>Address</InfoLabel>
                  <InfoValue>{selectedServer.address}</InfoValue>
                  
                  <InfoLabel>Uptime</InfoLabel>
                  <InfoValue>{selectedServer.uptime}</InfoValue>
                  
                  <InfoLabel>Start Time</InfoLabel>
                  <InfoValue>
                    {selectedServer.startTime 
                      ? new Date(selectedServer.startTime).toLocaleString() 
                      : 'Not running'}
                  </InfoValue>
                  
                  <InfoLabel>Process ID</InfoLabel>
                  <InfoValue>
                    {selectedServer.pid || 'Not running'}
                  </InfoValue>
                </InfoGrid>
              )}
              
              {activeTab === 'metrics' && (
                <>
                  <MetricsGrid>
                    <MetricCard>
                      <MetricValue>{selectedServer.memory}</MetricValue>
                      <MetricLabel>Memory Usage</MetricLabel>
                    </MetricCard>
                    <MetricCard>
                      <MetricValue>{selectedServer.cpu}</MetricValue>
                      <MetricLabel>CPU Usage</MetricLabel>
                    </MetricCard>
                    <MetricCard>
                      <MetricValue>{selectedServer.requests}</MetricValue>
                      <MetricLabel>Total Requests</MetricLabel>
                    </MetricCard>
                  </MetricsGrid>
                  
                  <div style={{ padding: '1rem', textAlign: 'center', marginTop: '1rem' }}>
                    Detailed metrics visualization would be implemented here
                  </div>
                </>
              )}
              
              {activeTab === 'config' && (
                <ConfigGrid>
                  {selectedServer.config && Object.entries(selectedServer.config).map(([key, value]) => (
                    <ConfigItem key={key}>
                      <ConfigName>{key}</ConfigName>
                      <ConfigValue>
                        {typeof value === 'object' 
                          ? JSON.stringify(value) 
                          : String(value)}
                      </ConfigValue>
                    </ConfigItem>
                  ))}
                </ConfigGrid>
              )}
            </DetailContent>
          </ServerDetailsContainer>
        )}
      </Body>
    </Container>
  );
};

export default MCPServerControl; 