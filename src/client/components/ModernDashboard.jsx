import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Button, Spin, Empty, Tabs } from 'antd';
import { PlusOutlined, ReloadOutlined, SettingOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import SimpleRegulationSearch from './SimpleRegulationSearch';
import mcpApiClient from '../api/MCPApiClient.jsx';

const { TabPane } = Tabs;

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
  
  // State management - System Health Stats
  const [stats, setStats] = useState({
    databaseStatus: 'checking',
    certifiedGold: 0,
    certifiedDraft: 0,
    totalRegulations: 0,
    totalTasks: 0,
    totalDeadlines: 0
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
      
      // Load system health from the health endpoint
      try {
        const healthResponse = await fetch('http://localhost:3010/health');
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          
          // Calculate system health statistics - use REAL certified console count
          const newStats = {
            databaseStatus: healthData.database?.status || 'unknown',
            certifiedGold: healthData.certifiedConsoles?.gold || 0,
            certifiedDraft: healthData.certifiedConsoles?.draft || 0,
            totalRegulations: healthData.regulations?.total || 0,
            totalTasks: healthData.tasks || 0,
            totalDeadlines: healthData.deadlines || 0
          };
          
          setStats(newStats);
        }
      } catch (healthError) {
        console.error('Error loading system health:', healthError);
        setStats(prev => ({ ...prev, databaseStatus: 'error' }));
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
      
      {/* Compact Stats Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          background: stats.databaseStatus === 'healthy' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${stats.databaseStatus === 'healthy' ? '#86efac' : '#fca5a5'}`,
          borderRadius: '8px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '20px' }}>{stats.databaseStatus === 'healthy' ? '✓' : '✗'}</span>
          <div>
            <div style={{ fontWeight: '600', color: stats.databaseStatus === 'healthy' ? '#166534' : '#991b1b', fontSize: '14px' }}>Database</div>
            <div style={{ fontSize: '11px', color: stats.databaseStatus === 'healthy' ? '#15803d' : '#b91c1c' }}>
              {stats.databaseStatus === 'healthy' ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        
        <div style={{ 
          background: '#f3e8ff',
          border: '1px solid #d8b4fe',
          borderRadius: '8px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '24px', fontWeight: '700', color: '#7c3aed' }}>{stats.certifiedGold}</span>
          <div>
            <div style={{ fontWeight: '600', color: '#6b21a8', fontSize: '14px' }}>Gold Consoles</div>
            <div style={{ fontSize: '11px', color: '#7e22ce' }}>Workflow certified</div>
          </div>
        </div>
        
        <div style={{ 
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '8px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>{stats.totalRegulations}</span>
          <div>
            <div style={{ fontWeight: '600', color: '#1e40af', fontSize: '14px' }}>Regulations</div>
            <div style={{ fontSize: '11px', color: '#1d4ed8' }}>{regulationStats.federal} federal · {regulationStats.state} state</div>
          </div>
        </div>
        
        <div style={{ 
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '24px', fontWeight: '700', color: '#d97706' }}>{stats.totalTasks.toLocaleString()}</span>
          <div>
            <div style={{ fontWeight: '600', color: '#92400e', fontSize: '14px' }}>Tasks</div>
            <div style={{ fontSize: '11px', color: '#b45309' }}>{stats.totalDeadlines} deadlines</div>
          </div>
        </div>
      </div>
      
      
      <SimpleRegulationSearch 
        placeholder="Search regulations..."
        onRegulationSelect={(regulation) => {
          console.log('Selected regulation:', regulation);
        }}
      />
    </DashboardContainer>
  );
};

export default ModernDashboard;
