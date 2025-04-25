import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import RequestInspector from '../components/RequestInspector';
import MCPServerControl from '../components/MCPServerControl';
import BatchTestingPanel from '../components/BatchTestingPanel';

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