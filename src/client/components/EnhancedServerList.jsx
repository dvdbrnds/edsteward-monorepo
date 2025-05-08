import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Tag, Empty, Spin, Button, Tooltip, Pagination } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, SettingOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import ServerListFilter from './ServerListFilter';

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

/**
 * Enhanced Server List Component
 * Displays MCP servers with filtering capabilities
 */
const EnhancedServerList = ({ onServerSelect }) => {
  // State for servers
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredServers, setFilteredServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    regulationType: undefined,
    validationLevel: undefined,
    status: undefined,
    sortBy: 'name',
    sortDirection: 'asc'
  });
  
  // Mock data for demonstration
  useEffect(() => {
    // This would be replaced with an actual API call
    setTimeout(() => {
      const mockServers = [
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
      
      setServers(mockServers);
      setFilteredServers(mockServers);
      setLoading(false);
    }, 1000);
  }, []);
  
  // Apply filters to server list
  const applyFilters = () => {
    let result = [...servers];
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(server => 
        server.name.toLowerCase().includes(searchLower) || 
        server.description.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply regulation type filter
    if (filters.regulationType) {
      result = result.filter(server => server.type === filters.regulationType);
    }
    
    // Apply validation level filter
    if (filters.validationLevel) {
      result = result.filter(server => server.validationLevel === filters.validationLevel);
    }
    
    // Apply status filter
    if (filters.status) {
      result = result.filter(server => server.status === filters.status);
    }
    
    // Apply sorting
    if (filters.sortBy) {
      result.sort((a, b) => {
        let comparison = 0;
        
        switch (filters.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'validationLevel':
            comparison = a.validationLevel - b.validationLevel;
            break;
          case 'lastUpdated':
            comparison = new Date(a.lastUpdated) - new Date(b.lastUpdated);
            break;
          default:
            comparison = 0;
        }
        
        return filters.sortDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    setFilteredServers(result);
    setCurrentPage(1); // Reset to first page when filters change
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
  };
  
  const handleServerAction = (action, serverId) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    switch (action) {
      case 'start':
        console.log(`Starting server: ${serverId}`);
        break;
      case 'stop':
        console.log(`Stopping server: ${serverId}`);
        break;
      case 'restart':
        console.log(`Restarting server: ${serverId}`);
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
  };
  
  // Get current page data
  const paginatedServers = filteredServers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // Server status badge colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
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
        <EmptyStateContainer>
          <Spin size="large" />
          <p style={{ marginTop: '1rem' }}>Loading servers...</p>
        </EmptyStateContainer>
      );
    }
    
    if (filteredServers.length === 0) {
      return (
        <EmptyStateContainer>
          <Empty description="No servers found" />
          <Button type="primary" style={{ marginTop: '1rem' }}>
            Create New Server
          </Button>
        </EmptyStateContainer>
      );
    }
    
    // Get current page data
    const firstIndex = (currentPage - 1) * pageSize;
    const lastIndex = firstIndex + pageSize;
    const currentServers = filteredServers.slice(firstIndex, lastIndex);
    
    return (
      <ServerGrid>
        {currentServers.map(server => (
          <ServerCard 
            key={server.id} 
            hoverable
            selected={selectedServer === server.id}
            onClick={() => handleServerSelect(server)}
          >
            <ServerName>{server.name}</ServerName>
            <ServerDescription>{server.description}</ServerDescription>
            
            <TagsContainer>
              <StatusTag color={getStatusColor(server.status)}>
                {server.status.toUpperCase()}
              </StatusTag>
              {getValidationLevelTag(server.validationLevel)}
              <Tag color="orange">{server.type.toUpperCase()}</Tag>
            </TagsContainer>
            
            <ServerInfo>
              <strong>Port:</strong> {server.port}
            </ServerInfo>
            
            <ServerInfo>
              <strong>Uptime:</strong> {server.uptime}
            </ServerInfo>
            
            <ServerActions>
              {server.status === 'running' ? (
                <Tooltip title="Stop Server">
                  <Button 
                    icon={<PauseCircleOutlined />} 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServerAction('stop', server.id);
                    }}
                    danger
                  />
                </Tooltip>
              ) : (
                <Tooltip title="Start Server">
                  <Button 
                    type="primary" 
                    icon={<PlayCircleOutlined />} 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServerAction('start', server.id);
                    }}
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
                />
              </Tooltip>
              
              <Tooltip title="Configure">
                <Button 
                  icon={<SettingOutlined />} 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServerAction('settings', server.id);
                  }}
                />
              </Tooltip>
              
              <Tooltip title="View Details">
                <Button 
                  icon={<EyeOutlined />} 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServerAction('view', server.id);
                  }}
                />
              </Tooltip>
              
              <Tooltip title="Delete Server">
                <Button 
                  icon={<DeleteOutlined />} 
                  size="small"
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServerAction('delete', server.id);
                  }}
                />
              </Tooltip>
            </ServerActions>
          </ServerCard>
        ))}
      </ServerGrid>
    );
  };
  
  // Render pagination
  const renderPagination = () => {
    if (filteredServers.length <= pageSize) {
      return null;
    }
    
    return (
      <PaginationContainer>
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={filteredServers.length}
          onChange={setCurrentPage}
          showSizeChanger
          onShowSizeChange={(current, size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={['4', '8', '12', '16']}
        />
      </PaginationContainer>
    );
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