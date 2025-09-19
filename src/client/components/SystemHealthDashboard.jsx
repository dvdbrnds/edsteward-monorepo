import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Spin, Button, Progress, Tag, Space, Row, Col, Statistic } from 'antd';
import { 
  ReloadOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import mcpApiClient from '../api/MCPApiClient';

// Styled Components
const HealthContainer = styled.div`
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
`;

const HealthHeader = styled.div`
  background: white;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const HealthTitle = styled.h1`
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 28px;
  font-weight: 600;
`;

const HealthSubtitle = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 16px;
`;

const ServiceCard = styled(Card)`
  margin-bottom: 16px;
  
  .ant-card-head {
    background: ${props => {
      switch (props.status) {
        case 'running': return '#f0f9ff';
        case 'stopped': return '#fef3c7';
        case 'error': return '#fef2f2';
        default: return '#f9fafb';
      }
    }};
    border-bottom: 1px solid ${props => {
      switch (props.status) {
        case 'running': return '#3b82f6';
        case 'stopped': return '#f59e0b';
        case 'error': return '#ef4444';
        default: return '#e5e7eb';
      }
    }};
  }
`;

const StatusBadge = styled(Tag)`
  margin-left: 8px;
`;

const MetricCard = styled(Card)`
  text-align: center;
  
  .ant-statistic-content {
    font-size: 24px;
    font-weight: 600;
  }
`;

const SystemHealthDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState({
    services: [],
    systemMetrics: {},
    overallHealth: 'unknown'
  });

  // Load health data
  const loadHealthData = async () => {
    try {
      setLoading(true);
      
      // Get server status
      const serversResponse = await mcpApiClient.getServers();
      const services = serversResponse?.data || [];
      
      // Calculate system metrics
      const totalServices = services.length;
      const runningServices = services.filter(s => s.status === 'running').length;
      const stoppedServices = services.filter(s => s.status === 'stopped').length;
      const errorServices = services.filter(s => s.status === 'error').length;
      
      // Determine overall health
      let overallHealth = 'healthy';
      if (errorServices > 0) {
        overallHealth = 'critical';
      } else if (stoppedServices > 0) {
        overallHealth = 'warning';
      } else if (runningServices === totalServices && totalServices > 0) {
        overallHealth = 'healthy';
      } else {
        overallHealth = 'unknown';
      }
      
      const systemMetrics = {
        totalServices,
        runningServices,
        stoppedServices,
        errorServices,
        healthPercentage: totalServices > 0 ? Math.round((runningServices / totalServices) * 100) : 0,
        uptime: '24/7', // Mock uptime
        lastCheck: new Date().toISOString()
      };
      
      setHealthData({
        services,
        systemMetrics,
        overallHealth
      });
      
    } catch (error) {
      console.error('Error loading health data:', error);
      setHealthData({
        services: [],
        systemMetrics: { error: error.message },
        overallHealth: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHealthData();
    setRefreshing(false);
  };

  // Load data on mount
  useEffect(() => {
    loadHealthData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <CheckCircleOutlined style={{ color: '#10b981' }} />;
      case 'stopped':
        return <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ef4444' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#6b7280' }} />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // Get overall health color
  const getOverallHealthColor = (health) => {
    switch (health) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <HealthContainer>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Loading system health data...</p>
        </div>
      </HealthContainer>
    );
  }

  return (
    <HealthContainer>
      <HealthHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <HealthTitle>System Health Monitor</HealthTitle>
            <HealthSubtitle>
              Real-time monitoring of MCP Engine services and system performance
            </HealthSubtitle>
          </div>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={refreshing}
          >
            Refresh
          </Button>
        </div>
      </HealthHeader>

      {/* System Overview Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <MetricCard>
            <Statistic
              title="Overall Health"
              value={healthData.overallHealth.toUpperCase()}
              valueStyle={{ color: getOverallHealthColor(healthData.overallHealth) }}
              prefix={getStatusIcon(healthData.overallHealth === 'healthy' ? 'running' : 'error')}
            />
          </MetricCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard>
            <Statistic
              title="Total Services"
              value={healthData.systemMetrics.totalServices || 0}
              valueStyle={{ color: '#1f2937' }}
            />
          </MetricCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard>
            <Statistic
              title="Running Services"
              value={healthData.systemMetrics.runningServices || 0}
              valueStyle={{ color: '#10b981' }}
              suffix={`/ ${healthData.systemMetrics.totalServices || 0}`}
            />
          </MetricCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard>
            <Statistic
              title="Health Score"
              value={healthData.systemMetrics.healthPercentage || 0}
              valueStyle={{ color: getOverallHealthColor(healthData.overallHealth) }}
              suffix="%"
            />
          </MetricCard>
        </Col>
      </Row>

      {/* Health Progress Bar */}
      <Card style={{ marginBottom: 24 }}>
        <h3>System Health Overview</h3>
        <Progress
          percent={healthData.systemMetrics.healthPercentage || 0}
          status={healthData.overallHealth === 'healthy' ? 'success' : 
                  healthData.overallHealth === 'warning' ? 'active' : 'exception'}
          strokeColor={getOverallHealthColor(healthData.overallHealth)}
        />
        <p style={{ marginTop: 8, color: '#6b7280' }}>
          {healthData.systemMetrics.runningServices || 0} of {healthData.systemMetrics.totalServices || 0} services running
        </p>
      </Card>

      {/* Service Details */}
      <Card title="Service Status Details">
        <Space direction="vertical" style={{ width: '100%' }}>
          {healthData.services.map((service) => (
            <ServiceCard
              key={service.id}
              status={service.status}
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    {getStatusIcon(service.status)} {service.name}
                  </span>
                  <StatusBadge color={getStatusColor(service.status)}>
                    {service.status?.toUpperCase() || 'UNKNOWN'}
                  </StatusBadge>
                </div>
              }
              size="small"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>Type:</strong> {service.type || 'N/A'}</p>
                  <p><strong>Description:</strong> {service.description || 'No description'}</p>
                </Col>
                <Col span={12}>
                  <p><strong>Port:</strong> {service.port || 'N/A'}</p>
                  <p><strong>Version:</strong> {service.version || 'N/A'}</p>
                </Col>
              </Row>
            </ServiceCard>
          ))}
        </Space>
      </Card>

      {/* System Information */}
      <Card title="System Information" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <p><strong>Last Health Check:</strong> {new Date(healthData.systemMetrics.lastCheck).toLocaleString()}</p>
            <p><strong>System Uptime:</strong> {healthData.systemMetrics.uptime}</p>
          </Col>
          <Col span={12}>
            <p><strong>MCP Engine Version:</strong> 4.0</p>
            <p><strong>Environment:</strong> Production</p>
          </Col>
        </Row>
      </Card>
    </HealthContainer>
  );
};

export default SystemHealthDashboard;
