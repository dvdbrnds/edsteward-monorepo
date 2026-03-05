/**
 * Compliance Page - Phase 3
 * Main page showcasing the modernized compliance interface
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import ServiceDashboard from '../components/ServiceDashboard.jsx';
import ComplianceQuery from '../components/ComplianceQuery.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const PageContainer = styled.div`
  max-width: ${props => props.theme.sizes.maxWidth};
  margin: 0 auto;
  padding: ${props => props.theme.space[4]};
`;

const PageHeader = styled.header`
  margin-bottom: ${props => props.theme.space[6]};
  text-align: center;
`;

const PageTitle = styled.h1`
  margin: 0 0 ${props => props.theme.space[2]} 0;
  font-size: ${props => props.theme.fontSizes[6]}px;
  color: ${props => props.theme.colors.text};
  font-weight: ${props => props.theme.fontWeights.bold};
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: ${props => props.theme.fontSizes[2]}px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: ${props => props.theme.lineHeights.body};
`;

const TabContainer = styled.div`
  margin-bottom: ${props => props.theme.space[4]};
`;

const TabList = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.divider};
  margin-bottom: ${props => props.theme.space[4]};
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: ${props => props.theme.space[3]} ${props => props.theme.space[4]};
  font-size: ${props => props.theme.fontSizes[1]}px;
  font-weight: ${props => props.theme.fontWeights.bold};
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    color: ${props => props.theme.colors.text};
    background-color: ${props => props.theme.colors.hover};
  }

  ${props => props.active && `
    color: ${props.theme.colors.primary};
    border-bottom-color: ${props.theme.colors.primary};
  `}

  &:first-child {
    margin-left: 0;
  }
`;

const TabContent = styled.div`
  min-height: 400px;
`;

const FeatureHighlight = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${props => props.theme.space[4]};
  margin: ${props => props.theme.space[6]} 0;
  padding: ${props => props.theme.space[4]};
  background-color: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.radii[2]}px;
  border: 1px solid ${props => props.theme.colors.divider};
`;

const FeatureCard = styled.div`
  text-align: center;
  padding: ${props => props.theme.space[3]};
`;

const FeatureIcon = styled.div`
  font-size: 48px;
  margin-bottom: ${props => props.theme.space[2]};
`;

const FeatureTitle = styled.h3`
  margin: 0 0 ${props => props.theme.space[1]} 0;
  font-size: ${props => props.theme.fontSizes[2]}px;
  color: ${props => props.theme.colors.text};
`;

const FeatureDescription = styled.p`
  margin: 0;
  font-size: ${props => props.theme.fontSizes[1]}px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: ${props => props.theme.lineHeights.body};
`;

const CompliancePage = () => {
  const [activeTab, setActiveTab] = useState('query');

  const tabs = [
    {
      id: 'query',
      label: 'Compliance Query',
      description: 'Ask questions about compliance requirements'
    },
    {
      id: 'dashboard',
      label: 'Service Dashboard',
      description: 'Monitor system health and statistics'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'query':
        return (
          <ErrorBoundary>
            <ComplianceQuery />
          </ErrorBoundary>
        );
      case 'dashboard':
        return (
          <ErrorBoundary>
            <ServiceDashboard />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>MCP Compliance Engine</PageTitle>
        <PageSubtitle>
          Advanced compliance analysis powered by modern service architecture
        </PageSubtitle>
      </PageHeader>

      <FeatureHighlight>
        <FeatureCard>
          <FeatureIcon>🔍</FeatureIcon>
          <FeatureTitle>Intelligent Analysis</FeatureTitle>
          <FeatureDescription>
            AI-powered compliance analysis with real-time query processing
          </FeatureDescription>
        </FeatureCard>
        
        <FeatureCard>
          <FeatureIcon>🛡️</FeatureIcon>
          <FeatureTitle>Regulation Compliance</FeatureTitle>
          <FeatureDescription>
            Support for FERPA, ADA, HIPAA, and other key regulations
          </FeatureDescription>
        </FeatureCard>
        
        <FeatureCard>
          <FeatureIcon>⚡</FeatureIcon>
          <FeatureTitle>Modern Architecture</FeatureTitle>
          <FeatureDescription>
            Built with service layers, dependency injection, and caching
          </FeatureDescription>
        </FeatureCard>
        
        <FeatureCard>
          <FeatureIcon>📊</FeatureIcon>
          <FeatureTitle>Real-time Monitoring</FeatureTitle>
          <FeatureDescription>
            Live service health monitoring and performance metrics
          </FeatureDescription>
        </FeatureCard>
      </FeatureHighlight>

      <TabContainer>
        <TabList>
          {tabs.map(tab => (
            <Tab
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Tab>
          ))}
        </TabList>

        <TabContent>
          {renderTabContent()}
        </TabContent>
      </TabContainer>
    </PageContainer>
  );
};

export default CompliancePage; 