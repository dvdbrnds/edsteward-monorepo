import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Button, Spin, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ModernServerList from './ModernServerList';
import mcpApiClient from '../api/MCPApiClient.jsx';

// Modern styled components following reg-66 template
const DashboardContainer = styled.div`
  background: #fafbfc;
  min-height: 100vh;
  padding: 24px;
`;

const DashboardHeader = styled.div`
  background: linear-gradient(135deg, #1a365d, #2d5282);
  color: white;
  padding: 32px 40px;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const DashboardTitle = styled.h1`
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.025em;
`;

const DashboardSubtitle = styled.p`
  margin: 8px 0 0;
  font-size: 1.1rem;
  opacity: 0.9;
  line-height: 1.5;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const ActionButton = styled(Button)`
  height: 40px;
  border-radius: 6px;
  font-weight: 500;
  
  &.primary {
    background: #ffffff;
    color: #1a365d;
    border: none;
    
    &:hover {
      background: #f8f9fb;
      color: #1a365d;
    }
  }
  
  &.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border-color: rgba(255, 255, 255, 0.3);
    }
  }
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: #ffffff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
`;

const StatValue = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.color || '#1a1a1a'};
  margin-bottom: 8px;
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const StatChange = styled.div`
  font-size: 0.75rem;
  color: ${props => props.positive ? '#198754' : '#dc3545'};
  margin-top: 4px;
  font-weight: 500;
`;

const MainContent = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
`;

const ContentSection = styled.div`
  background: #ffffff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const SectionHeader = styled.div`
  background: #f8f9fb;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
`;

const SectionActions = styled.div`
  display: flex;
  gap: 8px;
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const QuickActionCard = styled.div`
  background: #ffffff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.1);
    transform: translateY(-1px);
  }
`;

const QuickActionIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: ${props => props.color || '#f0f9ff'};
  color: ${props => props.iconColor || '#1976d2'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 1.5rem;
`;

const QuickActionTitle = styled.div`
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
`;

const QuickActionDescription = styled.div`
  font-size: 0.875rem;
  color: #6c757d;
  line-height: 1.4;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
`;

const EmptyStateContainer = styled.div`
  padding: 3rem;
  text-align: center;
`;

/**
 * Modern Dashboard Component
 * Main dashboard following the reg-66 template design patterns
 */
const ModernDashboard = () => {
  const navigate = useNavigate();
  
  // State management
  const [stats, setStats] = useState({
    totalServers: 0,
    runningServers: 0,
    stoppedServers: 0,
    errorServers: 0
  });
  const [regulationStats, setRegulationStats] = useState({
    total: 0,
    federal: 0,
    state: 0,
    thirdParty: 0,
    breakdown: {
      categories: {},
      states: {},
      topics: {}
    }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load server statistics
      const response = await mcpApiClient.getServers();
      if (response && response.data) {
        const servers = response.data;
        
        // Calculate statistics
        const newStats = {
          totalServers: servers.length,
          runningServers: servers.filter(s => s.status?.toLowerCase() === 'running').length,
          stoppedServers: servers.filter(s => s.status?.toLowerCase() === 'stopped').length,
          errorServers: servers.filter(s => s.status?.toLowerCase() === 'error').length
        };
        
        setStats(newStats);
      }

      // Load regulation statistics
      try {
        const regulationResponse = await mcpApiClient.getRegulationStats();
        if (regulationResponse && regulationResponse.data) {
          setRegulationStats(regulationResponse.data);
        }
      } catch (regulationError) {
        console.error('Error loading regulation statistics:', regulationError);
        // Keep default regulation stats if API fails
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };
  
  const handleCreateServer = () => {
    navigate('/create-server');
  };
  
  const handleSettings = () => {
    navigate('/settings');
  };
  
  const quickActions = [
    {
      title: 'Create New Server',
      description: 'Set up a new MCP validation server',
      icon: <PlusOutlined />,
      color: '#e3f2fd',
      iconColor: '#1976d2',
      onClick: handleCreateServer
    },
    {
      title: 'Server Management',
      description: 'View and manage existing servers',
      icon: <SettingOutlined />,
      color: '#f3e5f5',
      iconColor: '#7b1fa2',
      onClick: () => navigate('/servers')
    },
    {
      title: 'System Health',
      description: 'Monitor system performance',
      icon: <ReloadOutlined />,
      color: '#e8f5e8',
      iconColor: '#2e7d32',
      onClick: () => navigate('/health')
    }
  ];
  
  if (loading) {
    return (
      <DashboardContainer>
        <LoadingContainer>
          <Spin size="large" />
        </LoadingContainer>
      </DashboardContainer>
    );
  }
  
  return (
    <DashboardContainer>
      <DashboardHeader>
        <HeaderContent>
          <HeaderInfo>
            <DashboardTitle>MCP Engine Dashboard</DashboardTitle>
            <DashboardSubtitle>
              Monitor and manage your Model Context Protocol validation servers
            </DashboardSubtitle>
          </HeaderInfo>
          <HeaderActions>
            <ActionButton 
              className="secondary"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              Refresh
            </ActionButton>
            <ActionButton 
              className="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateServer}
            >
              New Server
            </ActionButton>
          </HeaderActions>
        </HeaderContent>
      </DashboardHeader>
      
      <StatsContainer>
        <StatCard>
          <StatValue color="#1976d2">{stats.totalServers}</StatValue>
          <StatLabel>Total Servers</StatLabel>
          <StatChange positive={true}>All systems operational</StatChange>
        </StatCard>
        
        <StatCard>
          <StatValue color="#198754">{stats.runningServers}</StatValue>
          <StatLabel>Running Servers</StatLabel>
          <StatChange positive={stats.runningServers > 0}>
            {stats.runningServers > 0 ? 'Active and healthy' : 'No active servers'}
          </StatChange>
        </StatCard>
        
        <StatCard>
          <StatValue color="#6c757d">{stats.stoppedServers}</StatValue>
          <StatLabel>Stopped Servers</StatLabel>
          <StatChange positive={false}>
            {stats.stoppedServers > 0 ? 'Requires attention' : 'All servers running'}
          </StatChange>
        </StatCard>
        
        <StatCard>
          <StatValue color="#dc3545">{stats.errorServers}</StatValue>
          <StatLabel>Error Servers</StatLabel>
          <StatChange positive={stats.errorServers === 0}>
            {stats.errorServers === 0 ? 'No errors detected' : 'Immediate attention needed'}
          </StatChange>
        </StatCard>
      </StatsContainer>

      {/* Regulation Statistics Section */}
      <div style={{ margin: '24px 0' }}>
        <h3 style={{ 
          color: '#1f2937', 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📋 Regulation Coverage
        </h3>
        <StatsContainer>
          <StatCard>
            <StatValue color="#7c3aed">{regulationStats.total}</StatValue>
            <StatLabel>Total Regulations</StatLabel>
            <StatChange positive={true}>
              Complete compliance coverage
            </StatChange>
          </StatCard>
          
          <StatCard>
            <StatValue color="#2563eb">{regulationStats.federal}</StatValue>
            <StatLabel>Federal Regulations</StatLabel>
            <StatChange positive={true}>
              CFR + Federal Register
            </StatChange>
          </StatCard>
          
          <StatCard>
            <StatValue color="#059669">{regulationStats.state}</StatValue>
            <StatLabel>State Regulations</StatLabel>
            <StatChange positive={regulationStats.state > 0}>
              {regulationStats.breakdown?.states?.Pennsylvania ? `Pennsylvania: ${regulationStats.breakdown.states.Pennsylvania}` : 'Pennsylvania coverage'}
            </StatChange>
          </StatCard>
          
          <StatCard>
            <StatValue color="#d97706">{regulationStats.thirdParty}</StatValue>
            <StatLabel>Third-Party Agencies</StatLabel>
            <StatChange positive={false}>
              {regulationStats.thirdParty > 0 ? 'Active integrations' : 'Coming soon'}
            </StatChange>
          </StatCard>
        </StatsContainer>
      </div>
      
      <QuickActions>
        {quickActions.map((action, index) => (
          <QuickActionCard key={index} onClick={action.onClick}>
            <QuickActionIcon color={action.color} iconColor={action.iconColor}>
              {action.icon}
            </QuickActionIcon>
            <QuickActionTitle>{action.title}</QuickActionTitle>
            <QuickActionDescription>{action.description}</QuickActionDescription>
          </QuickActionCard>
        ))}
      </QuickActions>
      
      <MainContent>
        <ContentSection>
          <SectionHeader>
            <SectionTitle>Server Registry</SectionTitle>
            <SectionActions>
              <Button 
                size="small" 
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={refreshing}
              >
                Refresh
              </Button>
            </SectionActions>
          </SectionHeader>
          
          <ModernServerList />
        </ContentSection>
      </MainContent>
    </DashboardContainer>
  );
};

export default ModernDashboard;
