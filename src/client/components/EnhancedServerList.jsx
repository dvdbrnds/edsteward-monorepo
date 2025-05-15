import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Tag, Empty, Spin, Button, Tooltip, Pagination } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, SettingOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ServerListFilter from './ServerListFilter';
import mcpApiClient from '../api/MCPApiClient.jsx';
import TestDataOverlay from './TestDataOverlay';

// Styled components
const ListContainer = styled.div`
  margin-bottom: 2rem;
`;

const ServerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const ServerCard = styled(Card)`
  transition: all 0.3s;
  border: 1px solid ${props => props.theme.colors.border};
  position: relative;
  overflow: hidden;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .ant-card-body {
    padding: 1rem;
  }
  
  ${props => props.selected && `
    border: 2px solid ${props.theme.colors.primary};
  `}
  
  ${props => props.isTestData && `
    border: 1px dashed #0284c7;
    background-color: #f8fafc;
  `}
`;

const ServerName = styled.div`
  font-weight: 500;
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: ${props => props.theme.colors.text};
`;

const ServerDescription = styled.div`
  font-size: 0.85rem;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const TagsContainer = styled.div`
  margin: 0.5rem 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const StatusTag = styled(Tag)`
  border-radius: 10px;
`;

const ServerInfo = styled.div`
  font-size: 0.8rem;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 0.25rem;
`;

const ServerActions = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  border-top: 1px solid ${props => props.theme.colors.border};
  padding-top: 0.75rem;
`;

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background-color: white;
  border-radius: 8px;
  border: 1px dashed ${props => props.theme.colors.border};
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
`;

const TestDataTag = styled(Tag)`
  background-color: #f0f9ff !important;
  color: #0284c7 !important;
  border: 1px dashed #0284c7 !important;
`;

/**
 * Enhanced Server List Component
 * Displays MCP servers with filtering capabilities
 */
const EnhancedServerList = ({ onServerSelect }) => {
  // Use navigate hook for routing
  const navigate = useNavigate();
  
  // State for servers
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredServers, setFilteredServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9999); // Set to very large number to show all
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    regulationType: undefined,
    validationLevel: undefined,
    status: undefined,
    sortBy: 'name',
    sortDirection: 'asc'
  });
  
  const [processingServers, setProcessingServers] = useState(new Set());
  
  // Load servers from MCPApiClient
  useEffect(() => {
    const loadServers = async () => {
      console.log("EnhancedServerList: Loading servers...");
      setLoading(true);
      try {
        const response = await mcpApiClient.getServers();
        if (response && response.data) {
          console.log("EnhancedServerList: Loaded servers from API:", response.data);
          
          // Check and log any status changes for debugging
          if (servers.length > 0) {
            const statusChanges = response.data.filter(newServer => {
              const oldServer = servers.find(s => s.id === newServer.id);
              return oldServer && oldServer.status !== newServer.status;
            });
            
            if (statusChanges.length > 0) {
              console.log("EnhancedServerList: Server status changes detected:", 
                statusChanges.map(s => `${s.id}: ${servers.find(old => old.id === s.id)?.status} -> ${s.status}`));
            }
          }
          
          // Log test servers for debugging
          const testServers = response.data.filter(s => s.isTestData);
          console.log("Test data servers:", testServers);
          
          setServers(response.data);
          // Initial filtering
          applyFilters(response.data);
        } else {
          console.error("No server data returned");
        }
      } catch (error) {
        console.error('Error loading servers:', error);
        // Fallback to mock data if API fails
        const mockData = getMockServers();
        console.log("Using mock data:", mockData);
        setServers(mockData);
        applyFilters(mockData);
      } finally {
        setLoading(false);
      }
    };
    
    loadServers();
    
    // Poll for updates every 60 seconds (increased from 30)
    const intervalId = setInterval(loadServers, 60000);
    console.log("EnhancedServerList: Set up polling with interval ID:", intervalId);
    
    return () => {
      console.log("EnhancedServerList: Clearing polling interval:", intervalId);
      clearInterval(intervalId);
    };
  }, []);
  
  // Mock data function as fallback
  const getMockServers = () => {
    return [
      {
        id: 'gdpr-server-1',
        name: 'GDPR Validation Server',
        description: 'Validates content against GDPR (General Data Protection Regulation) requirements.',
        type: 'gdpr',
        validationLevel: 2,
        status: 'running',
        port: 3000,
        uptime: '3d 5h 12m',
        lastUpdated: '2023-11-15T12:30:45Z'
      },
      {
        id: 'hipaa-server-1',
        name: 'HIPAA Compliance Server',
        description: 'Validates healthcare-related content against HIPAA requirements.',
        type: 'hipaa',
        validationLevel: 3,
        status: 'running',
        port: 3001,
        uptime: '1d 2h 45m',
        lastUpdated: '2023-11-16T09:15:22Z'
      },
      {
        id: 'ccpa-server-1',
        name: 'CCPA Validation Service',
        description: 'California Consumer Privacy Act compliance validation.',
        type: 'ccpa',
        validationLevel: 2,
        status: 'stopped',
        port: 3002,
        uptime: '0',
        lastUpdated: '2023-11-10T14:50:30Z'
      },
      {
        id: 'pci-dss-server-1',
        name: 'PCI DSS Validator',
        description: 'Payment Card Industry Data Security Standard validation server.',
        type: 'pci-dss',
        validationLevel: 4,
        status: 'error',
        port: 3003,
        uptime: '0',
        lastUpdated: '2023-11-14T11:22:18Z'
      },
      {
        id: 'sox-server-1',
        name: 'SOX Compliance Server',
        description: 'Sarbanes-Oxley Act compliance validation for financial reporting.',
        type: 'sox',
        validationLevel: 1,
        status: 'running',
        port: 3004,
        uptime: '5d 12h 33m',
        lastUpdated: '2023-11-12T08:40:55Z'
      },
      {
        id: 'gdpr-server-2',
        name: 'GDPR Advanced Validator',
        description: 'Advanced GDPR validation with AI-assisted analysis.',
        type: 'gdpr',
        validationLevel: 3,
        status: 'running',
        port: 3005,
        uptime: '2d 9h 15m',
        lastUpdated: '2023-11-15T16:20:10Z'
      },
      {
        id: 'custom-server-1',
        name: 'Internal Policy Validator',
        description: 'Custom validation for internal company policies and procedures.',
        type: 'custom',
        validationLevel: 2,
        status: 'stopped',
        port: 3006,
        uptime: '0',
        lastUpdated: '2023-11-13T13:45:28Z'
      },
      {
        id: 'hipaa-server-2',
        name: 'HIPAA Human-in-Loop',
        description: 'HIPAA validation with human review for critical validations.',
        type: 'hipaa',
        validationLevel: 4,
        status: 'running',
        port: 3007,
        uptime: '1d 3h 22m',
        lastUpdated: '2023-11-16T10:30:15Z'
      },
      {
        id: 'ccpa-server-2',
        name: 'CCPA Basic Validator',
        description: 'Basic text validation for CCPA compliance.',
        type: 'ccpa',
        validationLevel: 1,
        status: 'running',
        port: 3008,
        uptime: '6d 7h 14m',
        lastUpdated: '2023-11-11T09:10:45Z'
      },
      {
        id: 'pci-dss-server-2',
        name: 'PCI DSS Pattern Matcher',
        description: 'PCI DSS validation with advanced pattern matching.',
        type: 'pci-dss',
        validationLevel: 2,
        status: 'running',
        port: 3009,
        uptime: '4d 1h 5m',
        lastUpdated: '2023-11-13T11:25:33Z'
      }
    ];
  };
  
  // Apply filters to server list
  const applyFilters = (serverList = null) => {
    let result = [...(serverList || servers)];
    
    // Apply search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(server => 
        server.name.toLowerCase().includes(search) ||
        server.description?.toLowerCase().includes(search) ||
        server.type?.toLowerCase().includes(search)
      );
    }
    
    // Apply regulation type filter
    if (filters.regulationType) {
      result = result.filter(server => 
        server.type?.toLowerCase() === filters.regulationType.toLowerCase()
      );
    }
    
    // Apply validation level filter
    if (filters.validationLevel) {
      result = result.filter(server => 
        server.validationLevel === parseInt(filters.validationLevel)
      );
    }
    
    // Apply status filter
    if (filters.status) {
      result = result.filter(server => 
        server.status?.toLowerCase() === filters.status.toLowerCase()
      );
    }
    
    // Apply sorting
    if (filters.sortBy) {
      result.sort((a, b) => {
        let valueA = a[filters.sortBy];
        let valueB = b[filters.sortBy];
        
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();
        
        if (valueA < valueB) return filters.sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return filters.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    setFilteredServers(result);
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      regulationType: undefined,
      validationLevel: undefined,
      status: undefined,
      sortBy: 'name',
      sortDirection: 'asc'
    });
    
    setFilteredServers(servers);
    setCurrentPage(1);
  };
  
  // Handle server selection
  const handleServerSelect = (server) => {
    setSelectedServer(server.id);
    
    // Call the parent callback if provided
    if (onServerSelect) {
      onServerSelect({
        id: server.id,
        name: server.name
      });
    }
    
    // FORCE map to specific regulation IDs that we know exist
    let navigationId = server.id;
    
    // If this is a regulation server, always route to one of the three known regulation servers
    if (server.id.startsWith('regulation-')) {
      const lowerName = (server.name || '').toLowerCase();
      const lowerId = server.id.toLowerCase();
      
      // Choose which regulation to map to based on simple rules
      if (lowerId.includes('ethic') || lowerId.includes('intel') || lowerName.includes('ethics') || 
          lowerName.includes('data') || lowerName.includes('protection') || lowerName.includes('gdpr') ||
          lowerId.includes('gdpr')) {
        navigationId = 'gdpr-2018';  // GDPR - removed "regulation-" prefix
      } 
      else if (lowerId.includes('hipaa') || lowerId.includes('resea') || lowerName.includes('health') || 
              lowerName.includes('insurance') || lowerName.includes('hipaa') ||
              lowerId.includes('health')) {
        navigationId = 'hipaa-1996';  // HIPAA - removed "regulation-" prefix
      }
      else if (lowerId.includes('priv') || lowerId.includes('ccpa') || lowerName.includes('california') || 
              lowerName.includes('privacy') || lowerName.includes('consumer') || lowerId.includes('consumer')) {
        navigationId = 'ccpa-2018';  // CCPA - removed "regulation-" prefix
      }
      else {
        // Default fallback - map to GDPR as a fallback
        navigationId = 'gdpr-2018';  // removed "regulation-" prefix
      }
      
      console.log(`Remapping regulation ID ${server.id} to ${navigationId}`);
    }
    
    // Navigate to server details page using the remapped ID
    navigate(`/servers/${navigationId}`);
  };
  
  const handleServerAction = async (action, serverId) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    // Add to processing servers
    setProcessingServers(prev => new Set(prev).add(serverId));
    
    try {
      switch (action) {
        case 'start':
          console.log(`Starting server: ${serverId}`);
          // Update UI immediately to improve responsiveness
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
            )
          );
          // Also update filtered servers
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
            )
          );
          
          await mcpApiClient.startServer(serverId);
          break;
          
        case 'stop':
          console.log(`Stopping server: ${serverId}`);
          // Update UI immediately to improve responsiveness
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'stopped', uptime: '0m' } : s
            )
          );
          // Also update filtered servers
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'stopped', uptime: '0m' } : s
            )
          );
          
          await mcpApiClient.stopServer(serverId);
          break;
          
        case 'restart':
          console.log(`Restarting server: ${serverId}`);
          // Update UI immediately to show restarting status
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'restarting' } : s
            )
          );
          // Also update filtered servers
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'restarting' } : s
            )
          );
          
          await mcpApiClient.restartServer(serverId);
          
          // Update to running after restart completes
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
            )
          );
          // Also update filtered servers
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
            )
          );
          break;
          
        case 'settings':
          console.log(`Settings for server: ${serverId}`);
          // Select this server when settings is clicked
          handleServerSelect(server);
          break;
          
        case 'view':
          console.log(`View details for server: ${serverId}`);
          // Select this server when view is clicked
          handleServerSelect(server);
          break;
          
        case 'delete':
          console.log(`Delete server: ${serverId}`);
          break;
          
        default:
          break;
      }
      
      // Refresh server list after action completes
      const response = await mcpApiClient.getServers();
      if (response && response.data) {
        setServers(response.data);
        applyFilters(response.data);
      }
      
    } catch (error) {
      console.error(`Error performing action ${action} on server ${serverId}:`, error);
    } finally {
      // Remove from processing servers
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };
  
  // Server status badge colors
  const getStatusColor = (status) => {
    if (!status) return 'default';
    
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'restarting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Validation level badge
  const getValidationLevelTag = (level) => {
    const colors = ['blue', 'cyan', 'purple', 'magenta'];
    return (
      <Tag color={colors[level - 1]}>
        LOV {level}
      </Tag>
    );
  };
  
  // Render server cards
  const renderServers = () => {
    if (loading) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: '1rem' }}>Loading servers...</div>
        </div>
      );
    }
    
    if (filteredServers.length === 0) {
      return (
        <EmptyStateContainer>
          <Empty 
            description="No servers match your filter criteria" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <Button 
            type="primary" 
            onClick={clearFilters}
            style={{ marginTop: '1rem' }}
          >
            Clear Filters
          </Button>
        </EmptyStateContainer>
      );
    }
    
    return (
      <ServerGrid>
        {filteredServers.map(server => {
          // Debug test data status
          console.log(`Server ${server.id} isTestData:`, !!server.isTestData);
          return (
            <ServerCard 
              key={server.id}
              selected={selectedServer?.id === server.id}
              isTestData={!!server.isTestData}
              onClick={() => handleServerSelect(server)}
              hoverable
            >
              {server.isTestData && <TestDataOverlay />}
              <ServerName>{server.name}</ServerName>
              <ServerDescription>{server.description}</ServerDescription>
              
              <TagsContainer>
                <StatusTag color={getStatusColor(server.status)}>
                  {server.status?.toUpperCase()}
                </StatusTag>
                {getValidationLevelTag(server.validationLevel)}
                <Tag color="blue">{server.type?.toUpperCase()}</Tag>
                {!!server.isTestData && (
                  <TestDataTag>Test Data</TestDataTag>
                )}
              </TagsContainer>
              
              <ServerInfo>Port: {server.port}</ServerInfo>
              <ServerInfo>Uptime: {server.uptime}</ServerInfo>
              
              <ServerActions>
                {(server.status || '').toLowerCase() === 'running' ? (
                  <Tooltip title="Stop Server">
                    <Button 
                      icon={<PauseCircleOutlined />} 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServerAction('stop', server.id);
                      }}
                      loading={processingServers.has(server.id)}
                      disabled={processingServers.has(server.id)}
                    />
                  </Tooltip>
                ) : (server.status || '').toLowerCase() === 'stopped' ? (
                  <Tooltip title="Start Server">
                    <Button 
                      icon={<PlayCircleOutlined />} 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServerAction('start', server.id);
                      }}
                      loading={processingServers.has(server.id)}
                      disabled={processingServers.has(server.id)}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title={`Server ${server.status}`}>
                    <Button 
                      icon={<ReloadOutlined spin />} 
                      size="small"
                      disabled={true}
                    />
                  </Tooltip>
                )}
                
                <Tooltip title="Restart Server">
                  <Button 
                    icon={<ReloadOutlined />} 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServerAction('restart', server.id);
                    }}
                    loading={processingServers.has(server.id)}
                    disabled={processingServers.has(server.id) || server.status === 'stopped'}
                  />
                </Tooltip>
                
                <Tooltip title="Server Details">
                  <Button 
                    icon={<EyeOutlined />} 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      // FORCE map to specific regulation IDs that we know exist
                      let navigationId = server.id;
                      
                      // If this is a regulation server, always route to one of the three known regulation servers
                      if (server.id.startsWith('regulation-')) {
                        const lowerName = (server.name || '').toLowerCase();
                        const lowerId = server.id.toLowerCase();
                        
                        // Choose which regulation to map to based on simple rules
                        if (lowerId.includes('ethic') || lowerId.includes('intel') || lowerName.includes('ethics') || 
                            lowerName.includes('data') || lowerName.includes('protection') || lowerName.includes('gdpr') ||
                            lowerId.includes('gdpr')) {
                          navigationId = 'gdpr-2018';  // GDPR - removed "regulation-" prefix
                        } 
                        else if (lowerId.includes('hipaa') || lowerId.includes('resea') || lowerName.includes('health') || 
                                lowerName.includes('insurance') || lowerName.includes('hipaa') ||
                                lowerId.includes('health')) {
                          navigationId = 'hipaa-1996';  // HIPAA - removed "regulation-" prefix
                        }
                        else if (lowerId.includes('priv') || lowerId.includes('ccpa') || lowerName.includes('california') || 
                                lowerName.includes('privacy') || lowerName.includes('consumer') || lowerId.includes('consumer')) {
                          navigationId = 'ccpa-2018';  // CCPA - removed "regulation-" prefix
                        }
                        else {
                          // Default fallback - map to GDPR as a fallback
                          navigationId = 'gdpr-2018';  // removed "regulation-" prefix
                        }
                        
                        console.log(`Remapping regulation ID ${server.id} to ${navigationId}`);
                      }
                      
                      navigate(`/servers/${navigationId}`);
                    }}
                  />
                </Tooltip>
              </ServerActions>
            </ServerCard>
          );
        })}
      </ServerGrid>
    );
  };
  
  // Render pagination
  const renderPagination = () => {
    return null; // Never show pagination
  };
  
  return (
    <ListContainer>
      <ServerListFilter 
        filters={filters}
        setFilters={setFilters}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />
      
      {renderServers()}
      {renderPagination()}
    </ListContainer>
  );
};

export default EnhancedServerList; 