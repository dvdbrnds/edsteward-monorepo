import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Button, Tooltip, Spin, Empty } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, SettingOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ServerListFilter from './ServerListFilter';
import mcpApiClient from '../api/MCPApiClient.jsx';

// Modern styled components following reg-66 template
const ListContainer = styled.div`
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 2rem;
  overflow: hidden;
`;

const ListHeader = styled.div`
  background: linear-gradient(135deg, #1a365d, #2d5282);
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e1e5e9;
`;

const ListTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.025em;
`;

const ListSubtitle = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  opacity: 0.8;
`;

const ServerListContent = styled.div`
  padding: 0;
`;

const ServerListItem = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr 1fr auto;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e1e5e9;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background-color: #f8f9fb;
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  ${props => props.isTestData && `
    background-color: #f0f9ff;
    border-left: 4px solid #0284c7;
  `}
`;

const ServerInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ServerName = styled.div`
  font-weight: 600;
  font-size: 1rem;
  color: #1a1a1a;
  margin-bottom: 2px;
`;

const ServerDescription = styled.div`
  font-size: 0.875rem;
  color: #6c757d;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ServerType = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
`;

const TypeBadge = styled.span`
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
`;

const ValidationLevel = styled.span`
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 500;
`;

const ServerStatus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch (props.status?.toLowerCase()) {
      case 'running': return '#198754';
      case 'stopped': return '#6c757d';
      case 'restarting': return '#fd7e14';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  }};
  
  ${props => props.status?.toLowerCase() === 'running' && `
    animation: pulse 2s infinite;
  `}
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const StatusText = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => {
    switch (props.status?.toLowerCase()) {
      case 'running': return '#198754';
      case 'stopped': return '#6c757d';
      case 'restarting': return '#fd7e14';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  }};
  text-transform: capitalize;
`;

const ServerMeta = styled.div`
  font-size: 0.75rem;
  color: #6c757d;
`;

const ServerDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
  color: #6c757d;
`;

const ServerActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ActionButton = styled(Button)`
  border: none;
  box-shadow: none;
  
  &:hover {
    background-color: #f8f9fb;
  }
`;

const TestDataBadge = styled.span`
  background: #f0f9ff;
  color: #0284c7;
  border: 1px dashed #0284c7;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 500;
  margin-left: 8px;
`;

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background-color: white;
`;

const LoadingContainer = styled.div`
  padding: 2rem;
  text-align: center;
`;

const ListHeaderRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr 1fr auto;
  padding: 12px 24px;
  background: #f8f9fb;
  border-bottom: 1px solid #e1e5e9;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

/**
 * Modern Server List Component
 * Displays MCP servers in a clean list format following the reg-66 template design
 */
const ModernServerList = ({ onServerSelect }) => {
  const navigate = useNavigate();
  
  // State management
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredServers, setFilteredServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [processingServers, setProcessingServers] = useState(new Set());
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    regulationType: undefined,
    validationLevel: undefined,
    status: undefined,
    sortBy: 'lastUpdated',
    sortDirection: 'desc'
  });
  
  // Load servers from API
  useEffect(() => {
    const loadServers = async () => {
      console.log("ModernServerList: Loading regulations...");
      setLoading(true);
      try {
        // Fetch all 295 regulations instead of just MCP servers
        const response = await fetch('http://localhost:3010/api/regulations/all');
        const data = await response.json();
        
        if (data && data.data) {
          console.log("ModernServerList: Loaded regulations from API:", data.data.length);
          
          // Transform regulation data to server format for compatibility
          const transformedServers = data.data.map((reg, index) => ({
            id: `${reg.slug}-${index}`, // Make IDs unique by adding index
            name: reg.name,
            type: reg.topic || 'Regulation',
            status: 'running',
            description: `${reg.topic} regulation`,
            lastUpdated: reg.lastUpdated || new Date().toISOString(),
            uptime: '24/7',
            validationLevel: 'A',
            isTestData: false,
            version: '1.0',
            consoleUrl: reg.consoleUrl,
            slug: reg.slug, // Keep original slug for console URLs
            originalIndex: index // Keep track of original position
          }));
          
          setServers(transformedServers);
          applyFilters(transformedServers);
        } else {
          console.error("No server data returned");
          setServers([]);
          applyFilters([]);
        }
      } catch (error) {
        console.error('Error loading servers:', error);
        setServers([]);
        applyFilters([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadServers();
    
    // Poll for updates every 60 seconds
    const intervalId = setInterval(loadServers, 60000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Apply filters to server list
  const applyFilters = async (serverList = null) => {
    console.log("ModernServerList: Applying filters with search term:", filters.search);
    
    let result = [...(serverList || servers)];
    
    // If there's a search term, use the backend search API
    if (filters.search && filters.search.trim()) {
      try {
        console.log("ModernServerList: Using backend search API for:", filters.search);
        const response = await fetch(`http://localhost:3010/api/regulations/search?q=${encodeURIComponent(filters.search)}&limit=100`);
        const searchData = await response.json();
        
        if (searchData.success && searchData.data) {
          console.log("ModernServerList: Search API returned", searchData.data.length, "results");
          
          // Transform search results to server format
          result = searchData.data.map((reg, index) => ({
            id: `${reg.slug}-${index}`,
            name: reg.name,
            type: reg.topic || 'Regulation',
            status: 'running',
            description: reg.description || `${reg.topic} regulation`,
            lastUpdated: reg.lastUpdated || new Date().toISOString(),
            uptime: '24/7',
            validationLevel: 'A',
            isTestData: false,
            version: '1.0',
            consoleUrl: reg.consoleUrl,
            slug: reg.slug,
            originalIndex: index
          }));
        } else {
          console.log("ModernServerList: Search API returned no results");
          result = [];
        }
      } catch (error) {
        console.error("ModernServerList: Search API error:", error);
        // Fall back to local filtering if API fails
        const search = filters.search.toLowerCase();
        result = result.filter(server => 
          server.name.toLowerCase().includes(search) ||
          server.description?.toLowerCase().includes(search) ||
          server.type?.toLowerCase().includes(search)
        );
      }
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
        
        // Handle date/timestamp sorting for lastUpdated
        if (filters.sortBy === 'lastUpdated') {
          // Convert to timestamps for comparison
          valueA = new Date(valueA || a.createdAt || 0).getTime();
          valueB = new Date(valueB || b.createdAt || 0).getTime();
        } else if (typeof valueA === 'string') {
          valueA = valueA.toLowerCase();
        }
        
        if (typeof valueB === 'string' && filters.sortBy !== 'lastUpdated') {
          valueB = valueB.toLowerCase();
        }
        
        if (valueA < valueB) return filters.sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return filters.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    console.log("ModernServerList: Final filtered results:", result.length);
    setFilteredServers(result);
  };
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      regulationType: undefined,
      validationLevel: undefined,
      status: undefined,
      sortBy: 'lastUpdated',
      sortDirection: 'desc'
    });
    
    applyFilters(servers);
  };
  
  // Handle server selection
  const handleServerSelect = (server) => {
    setSelectedServer(server.id);
    
    if (onServerSelect) {
      onServerSelect({
        id: server.id,
        name: server.name
      });
    }
    
    // All regulations now use dynamic advanced consoles from the registry API
    // Use the original slug for console URL, not the unique ID
    const consoleUrl = server.consoleUrl || `/console/${server.slug}`;
    window.open(`http://localhost:3010${consoleUrl}`, '_blank');
  };
  
  // Handle server actions
  const handleServerAction = async (action, serverId, event) => {
    event.stopPropagation();
    
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    setProcessingServers(prev => new Set(prev).add(serverId));
    
    try {
      switch (action) {
        case 'start':
          console.log(`Starting server: ${serverId}`);
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
            )
          );
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
            )
          );
          await mcpApiClient.startServer(serverId);
          break;
          
        case 'stop':
          console.log(`Stopping server: ${serverId}`);
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'stopped', uptime: '0m' } : s
            )
          );
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'stopped', uptime: '0m' } : s
            )
          );
          await mcpApiClient.stopServer(serverId);
          break;
          
        case 'restart':
          console.log(`Restarting server: ${serverId}`);
          setServers(currentServers => 
            currentServers.map(s => 
              s.id === serverId ? { ...s, status: 'restarting' } : s
            )
          );
          setFilteredServers(current => 
            current.map(s => 
              s.id === serverId ? { ...s, status: 'restarting' } : s
            )
          );
          await mcpApiClient.restartServer(serverId);
          
          // Update to running after restart
          setTimeout(() => {
            setServers(currentServers => 
              currentServers.map(s => 
                s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
              )
            );
            setFilteredServers(current => 
              current.map(s => 
                s.id === serverId ? { ...s, status: 'running', uptime: '0m' } : s
              )
            );
          }, 2000);
          break;
          
        case 'view':
          handleServerSelect(server);
          break;
          
        default:
          break;
      }
      
      // Refresh server list after action
      const response = await mcpApiClient.getServers();
      if (response && response.data) {
        setServers(response.data);
        applyFilters(response.data);
      }
      
    } catch (error) {
      console.error(`Error performing action ${action} on server ${serverId}:`, error);
      toast.error(`Failed to ${action} server: ${error.message}`);
    } finally {
      setProcessingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };
  
  // Render server list
  const renderServers = () => {
    if (loading) {
      return (
        <LoadingContainer>
          <Spin size="large" />
          <div style={{ marginTop: '1rem' }}>Loading servers...</div>
        </LoadingContainer>
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
      <ServerListContent>
        <ListHeaderRow>
          <div>Server Information</div>
          <div>Type</div>
          <div>Status</div>
          <div>Details</div>
          <div>Actions</div>
        </ListHeaderRow>
        
        {filteredServers.map(server => (
          <ServerListItem 
            key={server.id}
            isTestData={!!server.isTestData}
            onClick={() => handleServerSelect(server)}
          >
            <ServerInfo>
              <ServerName>
                {server.name}
                {server.isTestData && <TestDataBadge>Test Data</TestDataBadge>}
              </ServerName>
              <ServerDescription>{server.description}</ServerDescription>
            </ServerInfo>
            
            <ServerType>
              <TypeBadge>{server.type?.toUpperCase() || 'UNKNOWN'}</TypeBadge>
              <ValidationLevel>LOV {server.validationLevel || 1}</ValidationLevel>
            </ServerType>
            
            <ServerStatus>
              <StatusIndicator>
                <StatusDot status={server.status} />
                <StatusText status={server.status}>
                  {server.status || 'Unknown'}
                </StatusText>
              </StatusIndicator>
              <ServerMeta>Uptime: {server.uptime || '0m'}</ServerMeta>
            </ServerStatus>
            
            <ServerDetails>
              <div>Port: {server.port || 'N/A'}</div>
              <div>PID: {server.pid || 'N/A'}</div>
            </ServerDetails>
            
            <ServerActions>
              {(server.status || '').toLowerCase() === 'running' ? (
                <Tooltip title="Stop Server">
                  <ActionButton 
                    icon={<PauseCircleOutlined />} 
                    size="small"
                    onClick={(e) => handleServerAction('stop', server.id, e)}
                    loading={processingServers.has(server.id)}
                    disabled={processingServers.has(server.id)}
                  />
                </Tooltip>
              ) : (server.status || '').toLowerCase() === 'stopped' ? (
                <Tooltip title="Start Server">
                  <ActionButton 
                    icon={<PlayCircleOutlined />} 
                    size="small"
                    onClick={(e) => handleServerAction('start', server.id, e)}
                    loading={processingServers.has(server.id)}
                    disabled={processingServers.has(server.id)}
                  />
                </Tooltip>
              ) : (
                <Tooltip title={`Server ${server.status}`}>
                  <ActionButton 
                    icon={<ReloadOutlined spin />} 
                    size="small"
                    disabled={true}
                  />
                </Tooltip>
              )}
              
              <Tooltip title="Restart Server">
                <ActionButton 
                  icon={<ReloadOutlined />} 
                  size="small"
                  onClick={(e) => handleServerAction('restart', server.id, e)}
                  loading={processingServers.has(server.id)}
                  disabled={processingServers.has(server.id) || server.status === 'stopped'}
                />
              </Tooltip>
              
              <Tooltip title="Server Details">
                <ActionButton 
                  icon={<EyeOutlined />} 
                  size="small"
                  onClick={(e) => handleServerAction('view', server.id, e)}
                />
              </Tooltip>
            </ServerActions>
          </ServerListItem>
        ))}
      </ServerListContent>
    );
  };
  
  return (
    <div>
      <ServerListFilter 
        filters={filters}
        setFilters={setFilters}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />
      
      <ListContainer>
        <ListHeader>
          <div>
            <ListTitle>MCP Server Registry</ListTitle>
            <ListSubtitle>
              Manage and monitor your Model Context Protocol validation servers
            </ListSubtitle>
          </div>
        </ListHeader>
        
        {renderServers()}
      </ListContainer>
    </div>
  );
};

export default ModernServerList;
