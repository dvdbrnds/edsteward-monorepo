import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import RequestInspector from '../components/RequestInspector';
import MCPServerControl from '../components/MCPServerControl';
import BatchTestingPanel from '../components/BatchTestingPanel';
import StatusIndicator from '../components/StatusIndicator';
import mcpApiClient from '../api/MCPApiClient';
import axios from 'axios';

// Mock constants to replace the imported ones
const ValidationStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL: 'PARTIAL',
  PENDING: 'PENDING'
};

const DashboardContainer = styled.div`
  padding: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  margin: 0;
`;

const NewValidationButton = styled(Link)`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  padding: 10px 16px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  grid-gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 600;
  color: ${props => props.color || props.theme.colors.text};
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 8px;
`;

const RecentValidationsSection = styled.div`
  margin-top: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  margin-bottom: 16px;
`;

const ValidationList = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
`;

const ValidationItem = styled(Link)`
  display: flex;
  padding: 16px;
  text-decoration: none;
  color: ${props => props.theme.colors.text};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  transition: background-color 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const ValidationIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  background-color: ${props => {
    switch (props.status) {
      case ValidationStatus.PASS:
        return props.theme.colors.success;
      case ValidationStatus.FAIL:
        return props.theme.colors.error;
      case ValidationStatus.PARTIAL:
        return props.theme.colors.warning;
      case ValidationStatus.PENDING:
        return props.theme.colors.info;
      default:
        return props.theme.colors.neutral;
    }
  }};
  color: white;
  font-weight: 600;
`;

const ValidationDetails = styled.div`
  flex: 1;
`;

const ValidationTitle = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
`;

const ValidationMeta = styled.div`
  display: flex;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const MetaItem = styled.div`
  margin-right: 16px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 32px;
  color: ${props => props.theme.colors.textSecondary};
`;

const DevSection = styled.div`
  margin-top: 32px;
`;

const ServerCardSection = styled.div`
  margin-top: 32px;
`;

const ServerCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const ServerCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }
`;

const ServerName = styled.h3`
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
`;

const ServerInfo = styled.div`
  margin-bottom: 8px;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  display: flex;
  align-items: center;
`;

const ServerType = styled.span`
  display: inline-block;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  margin-top: 8px;
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

const ServerActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const ActionButton = styled.button`
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
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

// Regulation List Styles
const RegulationListSection = styled.div`
  margin-top: 32px;
`;

const ScrollableTableContainer = styled.div`
  max-height: 500px;
  overflow-y: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
`;

const StickyHeader = styled.thead`
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: ${props => props.theme.colors.backgroundDark};
  
  th {
    position: sticky;
    top: 0;
  }
`;

const TableHead = styled.thead`
  background-color: ${props => props.theme.colors.backgroundDark};
`;

const TableHeader = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-weight: 500;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  position: relative;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: ${props => props.theme.colors.hover};
    cursor: ${props => props.onClick ? 'pointer' : 'default'};
  }
`;

const TableCell = styled.td`
  padding: 12px 16px;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
`;

const StatusCell = styled.td`
  padding: 12px 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
`;

const RegulationTypeTag = styled.span`
  display: inline-block;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  background-color: #ecfdf5;
  color: #047857;
`;

const CoreServersSection = styled.div`
  margin-bottom: 24px;
`;

const CoreServersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
  
  @media (max-width: 992px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

const CoreServerCard = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition: all 0.2s;
  border-left: 5px solid ${props => {
    if (props.type === 'Gateway') return '#0ea5e9';
    if (props.type === 'Batch') return '#f59e0b';
    if (props.type === 'Registry') return '#8b5cf6';
    return props.theme.colors.primary;
  }};
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  }
`;

const CoreServerName = styled.h3`
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
`;

const CoreServerInfo = styled.div`
  margin-bottom: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
`;

const CoreServerStatus = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 500;
`;

// Completely revise the SortIcon and SortableTableHeader components
const SortableTableHeader = styled(TableHeader)`
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s;
  
  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const MCPServerList = () => {
  const [servers, setServers] = useState([]);
  const [coreServers, setCoreServers] = useState([]);
  const [regulationServers, setRegulationServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState({
    key: 'name',
    direction: 'asc'
  });
  const navigate = useNavigate();

  // Helper function for sort direction indicators
  const getDirectionArrow = (key, sortConfig) => {
    if (sortConfig.key !== key) return <span style={{ opacity: 0.3 }}>↕</span>;
    return sortConfig.direction === 'asc' 
      ? <span style={{ color: '#0ea5e9' }}>↑</span> 
      : <span style={{ color: '#0ea5e9' }}>↓</span>;
  };

  useEffect(() => {
    const fetchServers = async () => {
      setLoading(true);
      try {
        // Fetch real regulations from backend
        const response = await axios.get('http://localhost:3010/api/regulations');
        const apiRegulations = response.data;
        const regulations = apiRegulations.map(r => ({
          ...r,
          id: r.regulationId,
          type: 'Regulation Server',
          category: 'Regulation',
        }));
        setRegulationServers(regulations);
        setServers(regulations); // If you have core servers, combine here
        setTotalCount(regulations.length);
      } catch (err) {
        setError('Failed to load servers');
        console.error('Error loading servers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServers();
  }, []);

  // Add sorting functionality
  const sortedRegulationServers = React.useMemo(() => {
    let sortableServers = [...regulationServers];
    if (sortConfig.key) {
      sortableServers.sort((a, b) => {
        // Handle special cases for certain fields
        if (sortConfig.key === 'status') {
          // Define a specific order for status values
          const statusOrder = {
            'running': 1,
            'stopped': 2,
            'error': 3,
            'pending': 4
          };
          
          // Get numeric values based on defined order (defaulting to 999 for unknown statuses)
          const statusA = statusOrder[a.status] || 999;
          const statusB = statusOrder[b.status] || 999;
          
          // Compare based on the defined order
          return sortConfig.direction === 'asc' 
            ? statusA - statusB 
            : statusB - statusA;
        }
        
        // Handle uptime special case
        if (sortConfig.key === 'uptime') {
          // Sort by extracted hours and minutes
          const extractTime = (timeStr) => {
            if (!timeStr || timeStr === '-') return 0;
            const hourMatch = timeStr.match(/(\d+)h/);
            const minuteMatch = timeStr.match(/(\d+)m/);
            const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
            return hours * 60 + minutes;
          };
          
          const timeA = extractTime(a.uptime);
          const timeB = extractTime(b.uptime);
          
          return sortConfig.direction === 'asc' 
            ? timeA - timeB 
            : timeB - timeA;
        }
        
        // Handle number fields
        if (sortConfig.key === 'port') {
          return sortConfig.direction === 'asc' 
            ? a.port - b.port 
            : b.port - a.port;
        }
        
        // Default string comparison
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableServers;
  }, [regulationServers, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleStartServer = async (serverId) => {
    try {
      await mcpApiClient.startServer(serverId);
      // Update server status in the UI
      setCoreServers(coreServers.map(server => 
        server.id === serverId ? { ...server, status: 'running' } : server
      ));
      setRegulationServers(regulationServers.map(server => 
        server.id === serverId ? { ...server, status: 'running' } : server
      ));
      setServers(servers.map(server => 
        server.id === serverId ? { ...server, status: 'running' } : server
      ));
    } catch (error) {
      console.error(`Failed to start server ${serverId}:`, error);
    }
  };

  const handleStopServer = async (serverId) => {
    try {
      await mcpApiClient.stopServer(serverId);
      // Update server status in the UI
      setCoreServers(coreServers.map(server => 
        server.id === serverId ? { ...server, status: 'stopped' } : server
      ));
      setRegulationServers(regulationServers.map(server => 
        server.id === serverId ? { ...server, status: 'stopped' } : server
      ));
      setServers(servers.map(server => 
        server.id === serverId ? { ...server, status: 'stopped' } : server
      ));
    } catch (error) {
      console.error(`Failed to stop server ${serverId}:`, error);
    }
  };

  // Add a function to handle row clicks
  const handleRowClick = (serverId) => {
    console.log('Navigating to server detail with ID:', serverId);
    navigate(`/servers/${serverId}`);
  };

  if (loading) {
    return <div>Loading servers...</div>;
  }

  return (
    <>
      <CoreServersSection>
        <SectionTitle>Core MCP Servers</SectionTitle>
        <CoreServersGrid>
          {coreServers.map(server => (
            <CoreServerCard 
              key={server.id} 
              type={server.type}
              onClick={() => navigate(`/servers/${server.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <CoreServerName>{server.name}</CoreServerName>
              <CoreServerStatus>
                <StatusIndicator status={server.status} />
                <span style={{ marginLeft: '8px' }}>{server.status}</span>
              </CoreServerStatus>
              <CoreServerInfo>Type: {server.type}</CoreServerInfo>
              <CoreServerInfo>Port: {server.port}</CoreServerInfo>
              <CoreServerInfo>Uptime: {server.uptime}</CoreServerInfo>
              <ServerActions onClick={(e) => e.stopPropagation()}>
                {server.status === 'stopped' ? (
                  <ActionButton
                    variant="start"
                    onClick={() => handleStartServer(server.id)}
                  >
                    Start
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="stop"
                    onClick={() => handleStopServer(server.id)}
                  >
                    Stop
                  </ActionButton>
                )}
                <ActionButton
                  variant="restart"
                  onClick={() => {
                    handleStopServer(server.id);
                    setTimeout(() => handleStartServer(server.id), 1000);
                  }}
                >
                  Restart
                </ActionButton>
              </ServerActions>
            </CoreServerCard>
          ))}
        </CoreServersGrid>
      </CoreServersSection>
      
      <RegulationListSection>
        <SectionTitle>Regulation Servers ({regulationServers.length} servers)</SectionTitle>
        <ScrollableTableContainer>
          <StyledTable>
            <StickyHeader>
              <TableRow>
                <SortableTableHeader onClick={() => requestSort('status')}>
                  Status<span style={{ marginLeft: '8px', display: 'inline-block' }}>{getDirectionArrow('status', sortConfig)}</span>
                </SortableTableHeader>
                <SortableTableHeader onClick={() => requestSort('name')}>
                  Name<span style={{ marginLeft: '8px', display: 'inline-block' }}>{getDirectionArrow('name', sortConfig)}</span>
                </SortableTableHeader>
                <SortableTableHeader onClick={() => requestSort('type')}>
                  Type<span style={{ marginLeft: '8px', display: 'inline-block' }}>{getDirectionArrow('type', sortConfig)}</span>
                </SortableTableHeader>
                <SortableTableHeader onClick={() => requestSort('port')}>
                  Port<span style={{ marginLeft: '8px', display: 'inline-block' }}>{getDirectionArrow('port', sortConfig)}</span>
                </SortableTableHeader>
                <SortableTableHeader onClick={() => requestSort('uptime')}>
                  Uptime<span style={{ marginLeft: '8px', display: 'inline-block' }}>{getDirectionArrow('uptime', sortConfig)}</span>
                </SortableTableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </StickyHeader>
            <tbody>
              {sortedRegulationServers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan="6" style={{ textAlign: 'center' }}>
                    {error || "No servers found"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedRegulationServers.map(server => {
                  console.log('Rendering server row:', server);
                  return (
                    <TableRow 
                      key={server.id}
                      onClick={() => handleRowClick(server.id)}
                    >
                      <StatusCell>
                        <StatusIndicator status={server.status} />
                        <span style={{ marginLeft: '8px' }}>{server.status}</span>
                      </StatusCell>
                      <TableCell>{server.name}</TableCell>
                      <TableCell>
                        <RegulationTypeTag style={{
                          backgroundColor: getServerTypeColor(server.type || server.category),
                          color: getServerTypeTextColor(server.type || server.category)
                        }}>
                          {server.type || server.category || 'Server'}
                        </RegulationTypeTag>
                      </TableCell>
                      <TableCell>{server.port || '-'}</TableCell>
                      <TableCell>{server.uptime || '-'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {server.status === 'stopped' ? (
                          <ActionButton
                            variant="start"
                            onClick={() => handleStartServer(server.id)}
                          >
                            Start
                          </ActionButton>
                        ) : (
                          <ActionButton
                            variant="stop"
                            onClick={() => handleStopServer(server.id)}
                          >
                            Stop
                          </ActionButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </tbody>
          </StyledTable>
        </ScrollableTableContainer>
      </RegulationListSection>
    </>
  );
};

// Helper functions for server type styling
const getServerTypeColor = (type) => {
  if (!type) return '#f3f4f6';
  
  const lowerType = type.toLowerCase();
  if (lowerType.includes('regulation')) return '#ecfdf5';
  if (lowerType.includes('gateway') || lowerType === 'llm') return '#e0f2fe';
  if (lowerType.includes('batch')) return '#fef3c7';
  if (lowerType.includes('registry')) return '#ede9fe';
  return '#f3f4f6';
};

const getServerTypeTextColor = (type) => {
  if (!type) return '#4b5563';
  
  const lowerType = type.toLowerCase();
  if (lowerType.includes('regulation')) return '#047857';
  if (lowerType.includes('gateway') || lowerType === 'llm') return '#0369a1';
  if (lowerType.includes('batch')) return '#b45309';
  if (lowerType.includes('registry')) return '#5b21b6';
  return '#4b5563';
};

const ServerCards = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await mcpApiClient.getServers();
        setServers(response.data || []);
      } catch (error) {
        console.error('Failed to load servers:', error);
        // Use mock data if API fails
        setServers([
          {
            id: 'server1',
            name: 'LLM Gateway Server',
            type: 'LLM Gateway',
            status: 'running',
            port: 3001,
            uptime: '2h 15m',
            address: 'http://localhost:3001'
          },
          {
            id: 'server2',
            name: 'Civil Service Act',
            type: 'Regulation Server',
            status: 'running',
            port: 3002,
            uptime: '1h 45m',
            address: 'http://localhost:3002'
          },
          {
            id: 'server3',
            name: 'GDPR Compliance',
            type: 'Regulation Server',
            status: 'stopped',
            port: 3003,
            uptime: '-',
            address: 'http://localhost:3003'
          },
          {
            id: 'server4',
            name: 'Batch Processor',
            type: 'Batch Server',
            status: 'running',
            port: 3004,
            uptime: '3h 22m',
            address: 'http://localhost:3004'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const handleStartServer = async (serverId) => {
    try {
      await mcpApiClient.startServer(serverId);
      // Update server status in the UI
      setServers(servers.map(server => 
        server.id === serverId ? { ...server, status: 'running' } : server
      ));
    } catch (error) {
      console.error(`Failed to start server ${serverId}:`, error);
    }
  };

  const handleStopServer = async (serverId) => {
    try {
      await mcpApiClient.stopServer(serverId);
      // Update server status in the UI
      setServers(servers.map(server => 
        server.id === serverId ? { ...server, status: 'stopped' } : server
      ));
    } catch (error) {
      console.error(`Failed to stop server ${serverId}:`, error);
    }
  };

  const handleRestartServer = async (serverId) => {
    try {
      await mcpApiClient.restartServer(serverId);
      // Update server status in the UI
      setServers(servers.map(server => 
        server.id === serverId ? { ...server, status: 'running' } : server
      ));
    } catch (error) {
      console.error(`Failed to restart server ${serverId}:`, error);
    }
  };

  if (loading) {
    return <div>Loading servers...</div>;
  }

  return (
    <ServerCardSection>
      <SectionTitle>MCP Servers</SectionTitle>
      <ServerCardsGrid>
        {servers.map(server => (
          <ServerCard key={server.id}>
            <ServerName>{server.name}</ServerName>
            <ServerInfo>
              <StatusIndicator status={server.status} /> 
              <span style={{ marginLeft: '8px' }}>{server.status}</span>
            </ServerInfo>
            <ServerInfo>Port: {server.port}</ServerInfo>
            <ServerInfo>Uptime: {server.uptime}</ServerInfo>
            <ServerType type={server.type}>{server.type}</ServerType>
            <ServerActions>
              {server.status === 'stopped' ? (
                <ActionButton 
                  variant="start" 
                  onClick={() => handleStartServer(server.id)}
                >
                  Start
                </ActionButton>
              ) : (
                <>
                  <ActionButton 
                    variant="stop" 
                    onClick={() => handleStopServer(server.id)}
                  >
                    Stop
                  </ActionButton>
                  <ActionButton 
                    variant="restart" 
                    onClick={() => handleRestartServer(server.id)}
                  >
                    Restart
                  </ActionButton>
                </>
              )}
            </ServerActions>
          </ServerCard>
        ))}
      </ServerCardsGrid>
    </ServerCardSection>
  );
};

const Dashboard = () => {
  // Mock validations data instead of using context
  const mockValidations = [
    {
      id: 'recent1',
      regulationId: 'FERPA-2023-01',
      status: 'PASS',
      confidence: 0.96,
      timestamp: new Date('2023-08-10T14:30:00').toISOString(),
      levels: ['level1', 'level2', 'level3', 'level4'],
      findings: []
    },
    {
      id: 'recent2',
      regulationId: 'HIPAA-2023-02',
      status: 'FAIL',
      confidence: 0.72,
      timestamp: new Date('2023-08-15T09:15:00').toISOString(),
      levels: ['level1', 'level2', 'level3'],
      findings: [
        {
          id: 'FINDING-001',
          path: 'data.policyInfo.encryption',
          severity: 'ERROR',
          message: 'Missing required encryption specification'
        }
      ]
    }
  ];

  // Mock stats based on the validations
  const stats = {
    total: 2,
    passed: 1,
    failed: 1,
    partial: 0
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusInitial = (status) => {
    return status.charAt(0);
  };

  return (
    <DashboardContainer>
      <Header>
        <Title>Developer Dashboard</Title>
        <NewValidationButton to="/new-validation">New Validation</NewValidationButton>
      </Header>

      <StatsContainer>
        <StatCard>
          <StatValue>{stats.total}</StatValue>
          <StatLabel>Total Validations</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue color="#4CAF50">{stats.passed}</StatValue>
          <StatLabel>Passing</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue color="#F44336">{stats.failed}</StatValue>
          <StatLabel>Failing</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue color="#FF9800">{stats.partial}</StatValue>
          <StatLabel>Partial</StatLabel>
        </StatCard>
      </StatsContainer>

      <MCPServerList />

      <DevSection>
        <MCPServerControl />
      </DevSection>

      <DevSection>
        <BatchTestingPanel />
      </DevSection>

      <DevSection>
        <RequestInspector />
      </DevSection>

      <RecentValidationsSection>
        <SectionTitle>Recent Validations</SectionTitle>
        <ValidationList>
          {mockValidations.length === 0 ? (
            <EmptyMessage>No validations found</EmptyMessage>
          ) : (
            mockValidations.map(validation => (
              <ValidationItem key={validation.id} to={`/validations/${validation.id}`}>
                <ValidationIcon status={validation.status}>
                  {getStatusInitial(validation.status)}
                </ValidationIcon>
                <ValidationDetails>
                  <ValidationTitle>
                    {validation.regulationId || 'Unnamed Validation'}
                  </ValidationTitle>
                  <ValidationMeta>
                    <MetaItem>ID: {validation.id}</MetaItem>
                    <MetaItem>Status: {validation.status}</MetaItem>
                    <MetaItem>
                      Confidence: {Math.round(validation.confidence * 100)}%
                    </MetaItem>
                    <MetaItem>Date: {formatDate(validation.timestamp)}</MetaItem>
                  </ValidationMeta>
                </ValidationDetails>
              </ValidationItem>
            ))
          )}
        </ValidationList>
      </RecentValidationsSection>
    </DashboardContainer>
  );
};

export default Dashboard; 