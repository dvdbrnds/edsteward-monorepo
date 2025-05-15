'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { toast } from 'react-hot-toast';
import { FaSyncAlt, FaPlay, FaStop } from 'react-icons/fa';
import mcpApiClient from '../api/MCPApiClient.jsx';
import StatusIndicator from './StatusIndicator';
import TestDataOverlay from './TestDataOverlay';

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
  position: relative;
  overflow: hidden;
  
  &:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  ${props => props.isSelected && `
    border: 2px solid ${props.theme.colors.primary};
    box-shadow: 0 0 0 1px ${props.theme.colors.primary};
  `}
  
  ${props => props.isTestData && `
    border: 1px dashed #0284c7;
    background-color: #f8fafc;
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

// Add a tag for regulation-specific servers
const RegulationTag = styled.div`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  background-color: #fff1f2;
  color: #e11d48;
`;

// Add a tag for test data servers
const TestDataTag = styled.div`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  background-color: #f0f9ff;
  color: #0284c7;
  border: 1px dashed #0284c7;
`;

const ServerStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
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

const MCPServerControl = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [processingServers, setProcessingServers] = useState(new Set());
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  useEffect(() => {
    loadServers();
    
    // Poll for updates every 60 seconds (increased from 30)
    const intervalId = setInterval(loadServers, 60000);
    console.log("MCPServerControl: Set up polling with interval ID:", intervalId);
    
    return () => {
      console.log("MCPServerControl: Clearing polling interval:", intervalId);
      clearInterval(intervalId);
    };
  }, []);
  
  const loadServers = async () => {
    console.log("MCPServerControl: Loading servers...");
    setIsLoading(true);
    try {
      const response = await mcpApiClient.getServers();
      if (response && response.data) {
        console.log("MCPServerControl: Loaded servers:", response.data);
        
        // Log server status changes to debug UI updates
        if (servers.length > 0) {
          const statusChanges = response.data.filter(newServer => {
            const oldServer = servers.find(s => s.id === newServer.id);
            return oldServer && oldServer.status !== newServer.status;
          });
          
          if (statusChanges.length > 0) {
            console.log("MCPServerControl: Server status changes detected:", 
              statusChanges.map(s => `${s.id}: ${servers.find(old => old.id === s.id)?.status} -> ${s.status}`));
          }
        }
        
        // Log test servers for debugging
        const testServers = response.data.filter(s => s.isTestData);
        console.log("Test data servers:", testServers);
        
        setServers(response.data);
        
        // Ensure selection is still valid
        if (selectedServer) {
          const updatedServer = response.data.find(s => s.id === selectedServer.id);
          setSelectedServer(updatedServer || null);
        }
      } else {
        console.error("No server data returned");
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading servers:', error);
      toast.error('Failed to load server data');
      setIsLoading(false);
    }
  };
  
  const handleStartServer = async (serverId) => {
    try {
      toast.info(`Starting server ${serverId}...`);
      
      // Add this server to processing state
      setProcessingServers(prev => new Set(prev).add(serverId));
      
      // Update UI immediately
      setServers(currentServers => 
        currentServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'running', uptime: '0m' }
            : server
        )
      );
      
      await mcpApiClient.startServer(serverId);
      await loadServers(); // Refresh the server list
      toast.success(`Server ${serverId} started successfully`);
      
      // Remove from processing state
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    } catch (error) {
      console.error(`Error starting server ${serverId}:`, error);
      toast.error(`Failed to start server: ${error.message}`);
      
      // Remove from processing state on error too
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };
  
  const handleStopServer = async (serverId) => {
    try {
      toast.info(`Stopping server ${serverId}...`);
      
      // Add this server to processing state
      setProcessingServers(prev => new Set(prev).add(serverId));
      
      // Find the server in the current state and log its status
      const serverBefore = servers.find(s => s.id === serverId);
      console.log(`Before stopping: Server ${serverId} status = ${serverBefore?.status}`);
      
      // Update UI immediately
      setServers(currentServers => 
        currentServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'stopped', uptime: '0m' }
            : server
        )
      );
      
      // Call the API to stop the server
      console.log(`MCPServerControl: Calling stopServer API for ${serverId}...`);
      const result = await mcpApiClient.stopServer(serverId);
      console.log(`MCPServerControl: stopServer API result:`, result);
      
      // Wait a moment to ensure state propagates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force an immediate refresh to update UI
      console.log(`MCPServerControl: Refreshing server list after stopping ${serverId}...`);
      await loadServers(); 
      
      // Log the updated status
      const updatedServers = await mcpApiClient.getServers();
      const serverAfter = updatedServers.data.find(s => s.id === serverId);
      console.log(`After stopping: Server ${serverId} status = ${serverAfter?.status}`);
      
      // Verify the server is actually stopped
      if (serverAfter && serverAfter.status !== 'stopped') {
        console.warn(`Server ${serverId} is still not showing as stopped after stopServer call. Forcing status update...`);
        
        // Force another direct update - this would normally be a separate API call
        await mcpApiClient.stopServer(serverId);
        
        // Refresh one more time
        await loadServers();
      }
      
      toast.success(`Server ${serverId} stopped successfully`);
      
      // Remove from processing state
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error);
      toast.error(`Failed to stop server: ${error.message}`);
      
      // Remove from processing state on error too
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };
  
  const handleRestartServer = async (serverId) => {
    try {
      toast.info(`Restarting server ${serverId}...`);
      
      // Add this server to processing state
      setProcessingServers(prev => new Set(prev).add(serverId));
      
      // Update UI immediately - first to restarting status
      setServers(currentServers => 
        currentServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'restarting' }
            : server
        )
      );
      
      await mcpApiClient.restartServer(serverId);
      
      // Then set to running
      setServers(currentServers => 
        currentServers.map(server => 
          server.id === serverId 
            ? { ...server, status: 'running', uptime: '0m' }
            : server
        )
      );
      
      await loadServers(); // Refresh the server list
      toast.success(`Server ${serverId} restarted successfully`);
      
      // Remove from processing state
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    } catch (error) {
      console.error(`Error restarting server ${serverId}:`, error);
      toast.error(`Failed to restart server: ${error.message}`);
      
      // Remove from processing state on error too
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };
  
  const handleStartAll = async () => {
    toast.info('Starting all servers...');
    setIsProcessingAll(true);

    // Get IDs of stopped servers
    const stoppedServerIds = servers
      .filter(server => server.status?.toLowerCase() === 'stopped')
      .map(server => server.id);
    
    // Mark all these servers as processing
    setProcessingServers(prev => {
      const newSet = new Set(prev);
      stoppedServerIds.forEach(id => newSet.add(id));
      return newSet;
    });
    
    // Update UI immediately
    setServers(currentServers => 
      currentServers.map(server => 
        stoppedServerIds.includes(server.id)
          ? { ...server, status: 'running', uptime: '0m' }
          : server
      )
    );
    
    // Start each stopped server
    for (const id of stoppedServerIds) {
      try {
        await mcpApiClient.startServer(id);
      } catch (error) {
        console.error(`Failed to start server ${id}:`, error);
      }
    }
    
    // Refresh server list
    await loadServers();
    toast.success('Started all servers');
    
    // Clear processing state
    setProcessingServers(prev => {
      const newSet = new Set(prev);
      stoppedServerIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    
    setIsProcessingAll(false);
  };
  
  const handleStopAll = async () => {
    toast.info('Stopping all servers...');
    setIsProcessingAll(true);

    // Get IDs of running servers
    const runningServerIds = servers
      .filter(server => server.status?.toLowerCase() === 'running')
      .map(server => server.id);
    
    // Mark all these servers as processing
    setProcessingServers(prev => {
      const newSet = new Set(prev);
      runningServerIds.forEach(id => newSet.add(id));
      return newSet;
    });
    
    // Update UI immediately
    setServers(currentServers => 
      currentServers.map(server => 
        runningServerIds.includes(server.id)
          ? { ...server, status: 'stopped', uptime: '0m' }
          : server
      )
    );
    
    // Stop each running server
    for (const id of runningServerIds) {
      try {
        await mcpApiClient.stopServer(id);
      } catch (error) {
        console.error(`Failed to stop server ${id}:`, error);
      }
    }
    
    // Refresh server list
    await loadServers();
    toast.success('Stopped all servers');
    
    // Clear processing state
    setProcessingServers(prev => {
      const newSet = new Set(prev);
      runningServerIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    
    setIsProcessingAll(false);
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
                         (server.address && server.address.toLowerCase().includes(filter.toLowerCase())) ||
                         (server.url && server.url.toLowerCase().includes(filter.toLowerCase())) ||
                         (server.regulationId && server.regulationId.toLowerCase().includes(filter.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || 
                           server.category.toLowerCase() === categoryFilter.toLowerCase();
    
    return matchesFilter && matchesCategory;
  });
  
  const categories = [...new Set(servers.map(server => server.category || 'Unknown'))];
  
  // Ensure the Regulation category is included even if no regulation servers are loaded yet
  if (!categories.includes('Regulation')) {
    categories.push('Regulation');
  }
  
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
              disabled={servers.every(s => s.status?.toLowerCase() !== 'stopped') || isProcessingAll}
            >
              {isProcessingAll ? 'Starting...' : 'Start All'}
            </Button>
            <Button 
              variant="stop" 
              onClick={handleStopAll}
              disabled={servers.every(s => s.status?.toLowerCase() !== 'running') || isProcessingAll}
            >
              {isProcessingAll ? 'Stopping...' : 'Stop All'}
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
            {filteredServers.map(server => {
              console.log("Server data:", server.id, "isTestData:", server.isTestData);
              return (
              <ServerCard 
                key={server.id} 
                isSelected={selectedServer?.id === server.id}
                isTestData={server.isTestData}
                onClick={() => handleSelectServer(server)}
              >
                {server.isTestData && <TestDataOverlay />}
                <ServerName>{server.name}</ServerName>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <ServerType type={server.type}>{server.type}</ServerType>
                  {server.regulationId && <RegulationTag>Regulation</RegulationTag>}
                  {console.log("Rendering test tag?", server.id, !!server.isTestData)}
                  {!!server.isTestData && <TestDataTag>Test Data</TestDataTag>}
                </div>
                <ServerStatus>
                  <StatusIndicator status={server.status} />
                  <span>{server.status?.toUpperCase()}</span>
                </ServerStatus>
                <ServerUptime>Uptime: {server.uptime}</ServerUptime>
                <ServerAddress>Address: {server.address || server.url}</ServerAddress>
                
                <ServerCardActions>
                  {(server.status === 'Stopped' || server.status === 'stopped') ? (
                    <CardButton 
                      variant="start" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartServer(server.id);
                      }}
                      disabled={processingServers.has(server.id)}
                    >
                      {processingServers.has(server.id) ? 'Starting...' : 'Start'}
                    </CardButton>
                  ) : (server.status === 'Running' || server.status === 'running') ? (
                    <>
                      <CardButton 
                        variant="stop" 
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log(`Stopping server ${server.id} with current status: ${server.status}`);
                          handleStopServer(server.id);
                        }}
                        disabled={processingServers.has(server.id)}
                      >
                        {processingServers.has(server.id) ? 'Stopping...' : 'Stop'}
                      </CardButton>
                      <CardButton 
                        variant="restart" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestartServer(server.id);
                        }}
                        disabled={processingServers.has(server.id)}
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
              );
            })}
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
                  
                  {selectedServer.regulationId && (
                    <>
                      <InfoLabel>Regulation ID</InfoLabel>
                      <InfoValue>{selectedServer.regulationId}</InfoValue>
                    </>
                  )}
                  
                  <InfoLabel>Status</InfoLabel>
                  <InfoValue>
                    <ServerStatus>
                      <StatusIndicator status={selectedServer.status} bold={true} />
                    </ServerStatus>
                  </InfoValue>
                  
                  <InfoLabel>Address</InfoLabel>
                  <InfoValue>{selectedServer.address || selectedServer.url}</InfoValue>
                  
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