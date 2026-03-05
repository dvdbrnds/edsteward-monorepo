/**
 * Service Dashboard Component - Phase 3
 * Modern dashboard showing service health and statistics
 */

import React from 'react';
import styled from 'styled-components';
import { useCompliance } from '../context/ComplianceContext.jsx';
import { useServiceHealth, useRegulationStats } from '../hooks/useComplianceApi.js';
import LoadingSpinner, { SkeletonCard } from './LoadingSpinner.jsx';

const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${props => props.theme.space[4]};
  padding: ${props => props.theme.space[4]};
`;

const Card = styled.div`
  padding: ${props => props.theme.space[4]};
  background-color: ${props => props.theme.colors.paper};
  border-radius: ${props => props.theme.radii[2]}px;
  box-shadow: ${props => props.theme.shadows.small};
  border: 1px solid ${props => props.theme.colors.border};
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.theme.space[3]};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${props => props.theme.fontSizes[2]}px;
  color: ${props => props.theme.colors.text};
  font-weight: ${props => props.theme.fontWeights.bold};
`;

const StatusBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.space[1]};
  padding: ${props => props.theme.space[1]} ${props => props.theme.space[2]};
  border-radius: ${props => props.theme.radii[3]}px;
  font-size: ${props => props.theme.fontSizes[0]}px;
  font-weight: ${props => props.theme.fontWeights.bold};
  text-transform: uppercase;

  ${props => props.status === 'healthy' && `
    background-color: rgba(46, 125, 50, 0.1);
    color: ${props.theme.colors.success};
  `}

  ${props => props.status === 'degraded' && `
    background-color: rgba(245, 124, 0, 0.1);
    color: ${props.theme.colors.warning};
  `}

  ${props => props.status === 'unhealthy' && `
    background-color: rgba(211, 47, 47, 0.1);
    color: ${props.theme.colors.error};
  `}
`;

const StatusIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  ${props => props.status === 'healthy' && `background-color: ${props.theme.colors.success};`}
  ${props => props.status === 'degraded' && `background-color: ${props.theme.colors.warning};`}
  ${props => props.status === 'unhealthy' && `background-color: ${props.theme.colors.error};`}
`;

const ServiceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.space[2]};
`;

const ServiceItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${props => props.theme.space[2]};
  background-color: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.radii[1]}px;
  border: 1px solid ${props => props.theme.colors.divider};
`;

const ServiceName = styled.span`
  font-weight: ${props => props.theme.fontWeights.bold};
  color: ${props => props.theme.colors.text};
`;

const ServiceStatus = styled.span`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.space[1]};
  font-size: ${props => props.theme.fontSizes[0]}px;
  color: ${props => props.theme.colors.textSecondary};
`;

const StatValue = styled.div`
  font-size: ${props => props.theme.fontSizes[5]}px;
  font-weight: ${props => props.theme.fontWeights.bold};
  color: ${props => props.theme.colors.primary};
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: ${props => props.theme.fontSizes[1]}px;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: ${props => props.theme.space[1]};
`;

const StatCard = styled(Card)`
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background-color: ${props => props.theme.colors.divider};
  border-radius: ${props => props.theme.radii[1]}px;
  overflow: hidden;
  margin-top: ${props => props.theme.space[2]};
`;

const ProgressFill = styled.div`
  height: 100%;
  background-color: ${props => props.theme.colors.primary};
  border-radius: ${props => props.theme.radii[1]}px;
  transition: width 0.3s ease;
  width: ${props => props.percentage}%;
`;

const ErrorMessage = styled.div`
  padding: ${props => props.theme.space[3]};
  background-color: rgba(211, 47, 47, 0.1);
  border: 1px solid ${props => props.theme.colors.error};
  border-radius: ${props => props.theme.radii[1]}px;
  color: ${props => props.theme.colors.error};
  text-align: center;
`;

const RefreshButton = styled.button`
  padding: ${props => props.theme.space[1]} ${props => props.theme.space[2]};
  background-color: transparent;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radii[1]}px;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  font-size: ${props => props.theme.fontSizes[0]}px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
    color: ${props => props.theme.colors.text};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ServiceDashboard = () => {
  const { health, stats, loading, error, checkHealth, fetchStats } = useCompliance();

  const formatServiceStatus = (status) => {
    if (status === true || status === 'healthy') return 'healthy';
    if (status === 'degraded') return 'degraded';
    return 'unhealthy';
  };

  const getOverallHealthStatus = (health) => {
    if (!health) return 'unhealthy';
    
    const services = health.services || {};
    const statuses = Object.values(services).map(service => 
      typeof service === 'object' ? service.status : service
    );

    if (statuses.every(status => status === 'healthy' || status === true)) {
      return 'healthy';
    }
    if (statuses.some(status => status === 'healthy' || status === true)) {
      return 'degraded';
    }
    return 'unhealthy';
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([checkHealth(), fetchStats()]);
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    }
  };

  if (loading.health && !health) {
    return (
      <DashboardContainer>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </DashboardContainer>
    );
  }

  if (error) {
    return (
      <DashboardContainer>
        <Card>
          <ErrorMessage>
            Failed to load dashboard data: {error}
            <RefreshButton onClick={handleRefresh} style={{ marginLeft: '16px' }}>
              Retry
            </RefreshButton>
          </ErrorMessage>
        </Card>
      </DashboardContainer>
    );
  }

  const overallStatus = getOverallHealthStatus(health);

  return (
    <DashboardContainer>
      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <RefreshButton 
            onClick={handleRefresh} 
            disabled={loading.health || loading.stats}
          >
            {loading.health || loading.stats ? 'Refreshing...' : 'Refresh'}
          </RefreshButton>
        </CardHeader>
        
        <StatusBadge status={overallStatus}>
          <StatusIndicator status={overallStatus} />
          {overallStatus}
        </StatusBadge>

        {health && health.services && (
          <ServiceList style={{ marginTop: '16px' }}>
            {Object.entries(health.services).map(([serviceName, serviceData]) => {
              const serviceStatus = formatServiceStatus(
                typeof serviceData === 'object' ? serviceData.status : serviceData
              );
              
              return (
                <ServiceItem key={serviceName}>
                  <ServiceName>{serviceName.replace(/([A-Z])/g, ' $1').trim()}</ServiceName>
                  <ServiceStatus>
                    <StatusIndicator status={serviceStatus} />
                    {serviceStatus}
                  </ServiceStatus>
                </ServiceItem>
              );
            })}
          </ServiceList>
        )}
      </Card>

      {/* Regulation Statistics */}
      <StatCard>
        <CardHeader>
          <CardTitle>Regulations</CardTitle>
        </CardHeader>
        {loading.stats ? (
          <LoadingSpinner size="small" />
        ) : (
          <>
            <StatValue>{stats?.data?.total || 0}</StatValue>
            <StatLabel>Total Regulations</StatLabel>
            {stats?.data?.categories && (
              <ProgressBar>
                <ProgressFill percentage={stats.data.total > 0 ? 100 : 0} />
              </ProgressBar>
            )}
          </>
        )}
      </StatCard>

      {/* Query Performance */}
      <StatCard>
        <CardTitle>Performance</CardTitle>
        <StatValue>
          {health?.responseTime ? `${health.responseTime}ms` : 'N/A'}
        </StatValue>
        <StatLabel>Average Response Time</StatLabel>
      </StatCard>

      {/* Cache Status */}
      <StatCard>
        <CardTitle>Cache</CardTitle>
        {health?.services?.cacheRepository ? (
          <>
            <StatValue>Active</StatValue>
            <StatLabel>Cache Status</StatLabel>
          </>
        ) : (
          <>
            <StatValue>N/A</StatValue>
            <StatLabel>Cache Status</StatLabel>
          </>
        )}
      </StatCard>
    </DashboardContainer>
  );
};

export default ServiceDashboard; 