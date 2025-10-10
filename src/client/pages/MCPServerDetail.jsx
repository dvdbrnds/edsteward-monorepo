import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { 
  Card, 
  Button, 
  Typography, 
  Space, 
  Divider, 
  Tag, 
  Tabs,
  Spin,
  Result,
  Empty,
  Collapse,
  List,
  Timeline
} from 'antd';
import { 
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
  AuditOutlined,
  SafetyOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import ConfigurationEditor from '../components/ConfigurationEditor';
import ValidationToolEditor from '../components/ValidationToolEditor';
import MCPTestConsole from '../components/MCPTestConsole';
import ServerLogsViewer from '../components/ServerLogsViewer';
import ServerUtilities from '../components/ServerUtilities';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const DetailContainer = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.5rem;
  background-color: ${props => props.theme.colors.primary};
  color: white;
  display: flex;
  align-items: center;
`;

const BackButton = styled(Button)`
  margin-right: 1rem;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const HeaderTitle = styled(Title)`
  margin: 0 !important;
  color: white !important;
`;

const HeaderSubtitle = styled(Text)`
  color: rgba(255, 255, 255, 0.8);
  display: block;
`;

const StatusTag = styled(Tag)`
  margin-left: 1rem;
`;

const Content = styled.div`
  padding: 1.5rem;
`;

const ServerInfo = styled(Card)`
  margin-bottom: 1.5rem;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
`;

const InfoLabel = styled(Text)`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.85rem;
`;

const InfoValue = styled(Text)`
  font-weight: 500;
  font-size: 1rem;
`;

const RegulationCard = styled(Card)`
  margin-bottom: 1.5rem;
`;

const RegulationSection = styled.div`
  margin-bottom: 1.5rem;
`;

const RegulationTitle = styled(Title)`
  font-size: 1.25rem !important;
  margin-bottom: 0.5rem !important;
`;

const RequirementItem = styled.div`
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const RequirementDescription = styled.div`
  color: ${props => props.theme.colors.textSecondary};
`;

// Category to color mapping
const CATEGORY_COLORS = {
  'gdpr': '#1976D2', // Blue
  'hipaa': '#C2185B', // Pink
  'ccpa': '#F57C00', // Orange
  'Ethics': '#9C27B0', // Purple
  'Export Controls': '#2E7D32', // Green
  'Research': '#0277BD', // Light Blue
  'Financial': '#F9A825', // Yellow
  'Education': '#00796B', // Teal
  'Healthcare': '#D32F2F', // Red
  'Government Contracts': '#795548', // Brown
  'Tax': '#607D8B', // Blue Grey
  'Information Security': '#455A64', // Dark Blue Grey
  'default': '#1976D2' // Default Blue
};

// Default compliance steps if not provided in data
const DEFAULT_COMPLIANCE_STEPS = [
  'Identify applicable regulation requirements',
  'Document current compliance status',
  'Implement necessary controls and processes',
  'Train staff on compliance requirements',
  'Continuously monitor and test compliance',
  'Update procedures as regulations change',
  'Conduct regular compliance audits'
];

const MCPServerDetail = () => {
  const { serverId, regulationId } = useParams(); // Get both serverId and regulationId
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState(null);
  const [regulationInfo, setRegulationInfo] = useState(null);
  const [error, setError] = useState(null);

  // Use regulationId if available (from console route), otherwise use serverId
  const currentId = regulationId || serverId;

  // Get the original server ID from the route parameter
  const getOriginalId = (routeId) => {
    // If it starts with 'regulation-', remove it to get the original ID
    if (routeId.startsWith('regulation-')) {
      return routeId.substring('regulation-'.length);
    }
    return routeId;
  };

  // Function to fetch regulation registry data
  const fetchRegulationRegistry = async () => {
    try {
      const origin = window.location.origin || '';
      const response = await axios.get(`${origin}/regulation-servers-registry.json`);
      return response.data;
    } catch (error) {
      console.error('Error fetching regulation registry:', error);
      return null;
    }
  };

  // Function to find a regulation in the registry by ID
  const findRegulationById = (registry, id) => {
    // First try exact match
    if (registry[id]) {
      return { ...registry[id], id };
    }
    
    // Try matching against regulation ID or original ID
    const originalId = getOriginalId(id);
    if (registry[originalId]) {
      return { ...registry[originalId], id: originalId };
    }
    
    // Try matching a prefix
    for (const regId in registry) {
      if (id.includes(regId) || regId.includes(id)) {
        return { ...registry[regId], id: regId };
      }
    }
    
    // Try matching by type 
    const lowerCaseId = id.toLowerCase();
    for (const regId in registry) {
      const regulation = registry[regId];
      const name = (regulation.name || '').toLowerCase();
      const category = (regulation.category || '').toLowerCase();
      
      // Check for common regulation types in the ID
      if (
        (lowerCaseId.includes('gdpr') && (name.includes('gdpr') || name.includes('general data'))) ||
        (lowerCaseId.includes('hipaa') && (name.includes('hipaa') || name.includes('health insurance'))) ||
        (lowerCaseId.includes('ccpa') && (name.includes('ccpa') || name.includes('california consumer'))) ||
        (lowerCaseId.includes('sox') && (name.includes('sarbanes') || name.includes('sox'))) ||
        (lowerCaseId.includes('pci') && (name.includes('payment card')))
      ) {
        return { ...regulation, id: regId };
      }
    }
    
    return null;
  };

  // Get regulation-specific colors based on category
  const getRegulationColor = (regulation) => {
    if (!regulation) return CATEGORY_COLORS.default;
    
    const category = regulation.category || '';
    const name = (regulation.name || '').toLowerCase();
    const id = (regulation.id || '').toLowerCase();
    
    // Check for specific regulation types first
    if (name.includes('gdpr') || id.includes('gdpr') || name.includes('general data protection')) {
      return CATEGORY_COLORS.gdpr;
    }
    if (name.includes('hipaa') || id.includes('hipaa') || name.includes('health insurance')) {
      return CATEGORY_COLORS.hipaa;
    }
    if (name.includes('ccpa') || id.includes('ccpa') || name.includes('california consumer')) {
      return CATEGORY_COLORS.ccpa;
    }
    
    // Otherwise use category-based colors
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  // Get server status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return 'success';
      case 'stopped': return 'default';
      case 'error': return 'error';
      default: return 'warning';
    }
  };

  // Convert server registry data to server object
  const convertRegulationToServer = (regulation) => {
    if (!regulation) return null;
    
    return {
      id: regulation.id,
      name: regulation.name || `Regulation ${regulation.id}`,
      description: regulation.description || 'Regulation compliance validation server.',
      type: regulation.category || 'Regulation',
      validationLevel: 2, // Default LOV
      status: regulation.server?.running ? 'running' : 'stopped',
      port: regulation.server?.port || 3000,
      uptime: regulation.server?.lastStarted ? 
        formatUptime(new Date(regulation.server.lastStarted)) : '0',
      lastUpdated: regulation.server?.lastStarted || new Date().toISOString(),
      version: regulation.version || '1.0.0',
      url: regulation.server?.url || null
    };
  };
  
  // Format uptime from a timestamp
  const formatUptime = (startDate) => {
    if (!startDate) return '0';
    
    const now = new Date();
    const diff = now - startDate;
    
    // Convert to days, hours, and minutes
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Extract compliance steps from regulation data
  const getComplianceSteps = (regulation) => {
    // In the future, if we have compliance steps in the registry, extract them here
    return DEFAULT_COMPLIANCE_STEPS;
  };

  // Extract key provisions from regulation data
  const getKeyProvisions = (regulation) => {
    if (!regulation) return [];
    
    // Create key provisions from the available data
    const provisions = [];
    
    // Add statute as a provision
    if (regulation.statuteReference) {
      provisions.push({
        title: regulation.statuteReference,
        description: `Statutory reference: ${regulation.statute || 'N/A'}`
      });
    }
    
    // Add regulation reference as a provision
    if (regulation.regulationReference) {
      provisions.push({
        title: regulation.regulationReference,
        description: `Regulatory reference: ${regulation.regulation || 'N/A'}`
      });
    }
    
    // If we have a deadline, add it as a provision
    if (regulation.deadline && regulation.deadline !== 'Not Applicable') {
      provisions.push({
        title: 'Compliance Deadline',
        description: `${regulation.deadline} (${regulation.deadlineType || 'N/A'})`
      });
    }
    
    // If we have a validation frequency, add it as a provision
    if (regulation.validationFrequency) {
      let frequency = regulation.validationFrequency;
      // Convert camelCase to readable format
      frequency = frequency.replace(/([A-Z])/g, ' $1').toLowerCase();
      frequency = frequency.charAt(0).toUpperCase() + frequency.slice(1);
      
      provisions.push({
        title: 'Validation Frequency',
        description: frequency
      });
    }
    
    // If we don't have any provisions yet, create a generic one from the description
    if (provisions.length === 0 && regulation.description) {
      provisions.push({
        title: 'Overview',
        description: regulation.description
      });
    }
    
    return provisions;
  };

  useEffect(() => {
    const loadServer = async () => {
      setLoading(true);
      try {
        console.log('Loading regulation details for ID:', currentId);
        
        // If we're coming from console route, try to fetch from regulations API first
        if (regulationId) {
          try {
            const response = await fetch('http://localhost:3010/api/regulations/all');
            const data = await response.json();
            
            if (data && data.data) {
              // Find regulation by slug, name, or id
              const regulation = data.data.find(reg => 
                reg.slug === currentId || 
                reg.name?.toLowerCase().includes(currentId.toLowerCase()) ||
                reg.id === currentId
              );
              
              if (regulation) {
                console.log('Found regulation in API:', regulation);
                // Convert regulation to server format
                const serverData = {
                  id: regulation.id || regulation.slug,
                  name: regulation.name,
                  type: regulation.topic || 'Regulation',
                  status: 'running',
                  description: `MCP Engine for ${regulation.name}`,
                  lastUpdated: regulation.lastUpdated,
                  uptime: '24/7',
                  validationLevel: 'A',
                  version: '1.0',
                  consoleUrl: regulation.consoleUrl
                };
                
                setServer(serverData);
                setRegulationInfo(regulation);
                setError(null);
                setLoading(false);
                return;
              }
            }
          } catch (apiError) {
            console.warn('Failed to fetch from regulations API:', apiError);
          }
        }
        
        // Fallback to original registry approach
        const registry = await fetchRegulationRegistry();
        
        if (!registry) {
          throw new Error('Failed to load regulation registry');
        }
        
        // Find the regulation in the registry
        const regulation = findRegulationById(registry, currentId);
        
        if (!regulation) {
          console.warn(`Regulation not found for ID: ${currentId}`);
          throw new Error('Regulation not found');
        }
        
        // Convert the regulation to a server object
        const serverData = convertRegulationToServer(regulation);
        
        setServer(serverData);
        setRegulationInfo(regulation);
        setError(null);
      } catch (err) {
        console.error('Error loading server:', err);
        setError('Failed to load server details');
      } finally {
        setLoading(false);
      }
    };
    
    loadServer();
  }, [currentId, regulationId]);

  const handleGoBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <DetailContainer>
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: '1rem' }}>Loading server details...</div>
        </div>
      </DetailContainer>
    );
  }

  if (error) {
    return (
      <DetailContainer>
        <Result
          status="error"
          title="Failed to load server details"
          subTitle={error}
          extra={
            <Button type="primary" onClick={handleGoBack}>
              Go Back to Server List
            </Button>
          }
        />
      </DetailContainer>
    );
  }

  if (!server) {
    return (
      <DetailContainer>
        <Empty 
          description="Server not found" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={handleGoBack}>
            Go Back to Server List
          </Button>
        </Empty>
      </DetailContainer>
    );
  }

  // Get color and provisions
  const regulationColor = getRegulationColor(regulationInfo);
  const keyProvisions = getKeyProvisions(regulationInfo);
  const complianceSteps = getComplianceSteps(regulationInfo);
  
  return (
    <DetailContainer>
      <Header style={{ backgroundColor: regulationColor }}>
        <BackButton 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          size="large"
          onClick={handleGoBack}
          style={{ color: 'white' }}
        />
        <HeaderContent>
          <HeaderTitle level={3}>{server.name}</HeaderTitle>
          <HeaderSubtitle>{server.description}</HeaderSubtitle>
        </HeaderContent>
        <StatusTag 
          color={getStatusColor(server.status)} 
          icon={server.status === 'running' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {server.status?.toUpperCase()}
        </StatusTag>
      </Header>

      <Content>
        {/* Regulation Information Section */}
        <RegulationCard>
          <Title level={4}>
            <FileProtectOutlined style={{ marginRight: '8px' }} />
            {regulationInfo?.name || 'Regulation Information'}
          </Title>
          <Paragraph>{regulationInfo?.description || 'Regulatory compliance validation.'}</Paragraph>
          
          <InfoGrid>
            <InfoItem>
              <InfoLabel>Regulation ID</InfoLabel>
              <InfoValue>{regulationInfo?.id || 'N/A'}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Version</InfoLabel>
              <InfoValue>{regulationInfo?.version || '1.0'}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Category</InfoLabel>
              <InfoValue>{regulationInfo?.category || 'Regulation'}</InfoValue>
            </InfoItem>
            {regulationInfo?.statuteReference && (
              <InfoItem>
                <InfoLabel>Statute</InfoLabel>
                <InfoValue>{regulationInfo.statuteReference}</InfoValue>
              </InfoItem>
            )}
          </InfoGrid>

          {regulationInfo?.regulation && (
            <InfoGrid style={{ marginTop: '1rem' }}>
              <InfoItem>
                <InfoLabel>Regulation Reference</InfoLabel>
                <InfoValue>{regulationInfo.regulationReference || regulationInfo.regulation}</InfoValue>
              </InfoItem>
              {regulationInfo?.deadline && regulationInfo.deadline !== 'Not Applicable' && (
                <InfoItem>
                  <InfoLabel>Deadline</InfoLabel>
                  <InfoValue>{regulationInfo.deadline}</InfoValue>
                </InfoItem>
              )}
              {regulationInfo?.validationFrequency && (
                <InfoItem>
                  <InfoLabel>Validation Frequency</InfoLabel>
                  <InfoValue>
                    {regulationInfo.validationFrequency.replace(/([A-Z])/g, ' $1').toLowerCase().charAt(0).toUpperCase() + 
                    regulationInfo.validationFrequency.replace(/([A-Z])/g, ' $1').toLowerCase().slice(1)}
                  </InfoValue>
                </InfoItem>
              )}
            </InfoGrid>
          )}
        </RegulationCard>

        {/* Server Information Section */}
        <ServerInfo>
          <Title level={4}>
            <AuditOutlined style={{ marginRight: '8px' }} />
            Server Information
          </Title>
          <Divider style={{ margin: '12px 0' }} />
          <InfoGrid>
            <InfoItem>
              <InfoLabel>Server ID</InfoLabel>
              <InfoValue>{server.id}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Server Version</InfoLabel>
              <InfoValue>{server.version}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Port</InfoLabel>
              <InfoValue>{server.port}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Uptime</InfoLabel>
              <InfoValue>{server.uptime}</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Last Updated</InfoLabel>
              <InfoValue>{new Date(server.lastUpdated).toLocaleString()}</InfoValue>
            </InfoItem>
            {server.url && (
              <InfoItem>
                <InfoLabel>URL</InfoLabel>
                <InfoValue>{server.url}</InfoValue>
              </InfoItem>
            )}
          </InfoGrid>
        </ServerInfo>

        {/* Key Requirements Section */}
        <RegulationSection>
          <RegulationTitle level={4}>
            <SafetyOutlined style={{ marginRight: '8px' }} />
            Key Provisions
          </RegulationTitle>
          <Collapse defaultActiveKey={['0']} style={{ marginTop: '1rem' }}>
            {keyProvisions.map((provision, index) => (
              <Panel header={provision.title} key={index}>
                <RequirementDescription>
                  {provision.description}
                </RequirementDescription>
              </Panel>
            ))}
            {(!keyProvisions || keyProvisions.length === 0) && (
              <Panel header="No key provisions available" key="0">
                <RequirementDescription>
                  Information about key provisions is not available for this regulation.
                </RequirementDescription>
              </Panel>
            )}
          </Collapse>
        </RegulationSection>

        {/* Compliance Steps Section */}
        <RegulationSection>
          <RegulationTitle level={4}>
            <ClockCircleOutlined style={{ marginRight: '8px' }} />
            Compliance Steps
          </RegulationTitle>
          <Timeline style={{ marginTop: '1rem', marginLeft: '1rem' }}>
            {complianceSteps.map((step, index) => (
              <Timeline.Item key={index}>{step}</Timeline.Item>
            ))}
          </Timeline>
        </RegulationSection>

        {/* Server Configuration Tabs */}
        <Tabs defaultActiveKey="configuration">
          <TabPane tab="Configuration" key="configuration">
            <ConfigurationEditor serverId={server.id} />
          </TabPane>
          <TabPane tab="Validation Tools" key="tools">
            <ValidationToolEditor serverId={server.id} />
          </TabPane>
          <TabPane tab="Test Console" key="test">
            <MCPTestConsole serverId={server.id} />
          </TabPane>
          <TabPane tab="Logs" key="logs">
            <ServerLogsViewer serverId={server.id} />
          </TabPane>
          <TabPane tab="Utilities" key="utilities">
            <ServerUtilities serverId={server.id} />
          </TabPane>
        </Tabs>
      </Content>
    </DetailContainer>
  );
};

export default MCPServerDetail; 