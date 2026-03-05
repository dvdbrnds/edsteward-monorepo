import React, { useState } from 'react';
import styled from 'styled-components';
import { Tabs, Button, Collapse, Divider, Select, ConfigProvider } from 'antd';
import ServerCreationForm from '../components/ServerCreationForm';
import EnhancedServerList from '../components/EnhancedServerList';
import ConfigurationEditor from '../components/ConfigurationEditor';
import ValidationToolEditor from '../components/ValidationToolEditor';
import MCPTestConsole from '../components/MCPTestConsole';
import PerformanceMonitor from '../components/PerformanceMonitor';
import ServerLogsViewer from '../components/ServerLogsViewer';
import VersionControl from '../components/VersionControl';
import ServerUtilities from '../components/ServerUtilities';

// Styled components
const EditorContainer = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  margin-bottom: 2rem;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.5rem;
  background-color: ${props => props.theme.colors.primary};
  color: white;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
`;

const Subtitle = styled.p`
  margin: 0.5rem 0 0;
  font-size: 1rem;
  opacity: 0.8;
`;

const Content = styled.div`
  padding: 1.5rem;
`;

const ActionButton = styled(Button)`
  margin-bottom: 1.5rem;
`;

const ManagementContainer = styled.div`
  padding: 0 1rem;
`;

const ManagementHeader = styled.div`
  margin-bottom: 1.5rem;
`;

// Common container for all tab content
const TabContentContainer = styled.div`
  padding: 0 1rem;
`;

const TabHeader = styled.div`
  margin-bottom: 1.5rem;
`;

// Updated ServerManagement component
const ServerManagement = ({ onServerSelect }) => {
  const [showCreationForm, setShowCreationForm] = useState(false);
  
  return (
    <ManagementContainer>
      <ActionButton 
        type="primary"
        onClick={() => setShowCreationForm(!showCreationForm)}
      >
        {showCreationForm ? 'Cancel Server Creation' : 'Create New MCP Server'}
      </ActionButton>
      
      {showCreationForm ? (
        <ServerCreationForm onServerCreated={(newServer) => {
          setShowCreationForm(false);
          onServerSelect && onServerSelect(newServer);
        }} />
      ) : (
        <div>
          <ManagementHeader>
            <h3>MCP Server Management</h3>
            <p>Manage your existing MCP validation servers or create new ones.</p>
          </ManagementHeader>
          
          <EnhancedServerList onServerSelect={onServerSelect} />
        </div>
      )}
    </ManagementContainer>
  );
};

// Updated ConfigEditor component
const ConfigEditor = ({ selectedServer }) => {
  return (
    <TabContentContainer>
      <TabHeader>
        <h3>Configuration Editor - {selectedServer.name}</h3>
        <p>Edit server configuration, validation logic, and integration settings.</p>
      </TabHeader>
      
      <Divider />
      
      <ConfigProvider>
        <Tabs defaultActiveKey="basic">
          <Tabs.TabPane tab="Basic Configuration" key="basic">
            <ConfigurationEditor serverId={selectedServer.id} />
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="Validation Tools" key="tools">
            <ValidationToolEditor serverId={selectedServer.id} />
          </Tabs.TabPane>
        </Tabs>
      </ConfigProvider>
    </TabContentContainer>
  );
};

// Updated TestConsole component
const TestConsole = ({ selectedServer }) => {
  return (
    <TabContentContainer>
      <TabHeader>
        <h3>Test Console - {selectedServer.name}</h3>
        <p>Test your MCP servers with sample validation requests and view detailed responses.</p>
      </TabHeader>
      
      <Divider />
      
      <MCPTestConsole serverId={selectedServer.id} />
    </TabContentContainer>
  );
};

// Version Control component
const VersionControlTab = ({ selectedServer }) => {
  return (
    <TabContentContainer>
      <TabHeader>
        <h3>Version Control - {selectedServer.name}</h3>
        <p>Manage regulation versions, compatibility, and change notifications.</p>
      </TabHeader>
      
      <Divider />
      
      <ConfigProvider>
        <Tabs defaultActiveKey="versions">
          <Tabs.TabPane tab="Version Management" key="versions">
            <VersionControl serverId={selectedServer.id} />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Server Utilities" key="utilities">
            <ServerUtilities serverId={selectedServer.id} />
          </Tabs.TabPane>
        </Tabs>
      </ConfigProvider>
    </TabContentContainer>
  );
};

// Updated PerformanceMonitor component
const PerformanceMonitorTab = ({ selectedServer }) => {
  return (
    <TabContentContainer>
      <TabHeader>
        <h3>Monitoring & Logs - {selectedServer.name}</h3>
        <p>View real-time performance metrics, resource utilization, and server logs for your MCP servers.</p>
      </TabHeader>
      
      <Divider />
      
      <ConfigProvider>
        <Tabs defaultActiveKey="performance">
          <Tabs.TabPane tab="Performance Metrics" key="performance">
            <PerformanceMonitor serverId={selectedServer.id} />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Server Logs" key="logs">
            <ServerLogsViewer serverId={selectedServer.id} />
          </Tabs.TabPane>
        </Tabs>
      </ConfigProvider>
    </TabContentContainer>
  );
};

/**
 * MCP Editor Tool - Main interface for creating, configuring, and managing MCP validation servers
 */
const MCPEditorTool = () => {
  // Selected server state (lifted up)
  const [selectedServer, setSelectedServer] = useState({
    id: 'gdpr-server-1',
    name: 'GDPR Validation Server'
  });

  // Server selector component for non-management tabs
  const ServerSelector = () => (
    <div style={{ marginBottom: '1rem', padding: '0 1rem' }}>
      <Select
        style={{ width: 300 }}
        value={selectedServer.id}
        onChange={(value, option) => {
          setSelectedServer({
            id: value,
            name: option.children
          });
        }}
      >
        <Select.Option value="gdpr-server-1">GDPR Validation Server</Select.Option>
        <Select.Option value="hipaa-server-1">HIPAA Compliance Server</Select.Option>
        <Select.Option value="ccpa-server-1">CCPA Validation Service</Select.Option>
      </Select>
    </div>
  );
  
  // Handler for server selection
  const handleServerSelect = (server) => {
    setSelectedServer(server);
  };

  // Tab items for the main navigation
  const tabItems = [
    {
      key: 'management',
      label: 'Server Management',
      children: <ServerManagement onServerSelect={handleServerSelect} />,
    },
    {
      key: 'config',
      label: 'Configuration',
      children: (
        <>
          <ServerSelector />
          <ConfigEditor selectedServer={selectedServer} />
        </>
      ),
    },
    {
      key: 'testing',
      label: 'Test Console',
      children: (
        <>
          <ServerSelector />
          <TestConsole selectedServer={selectedServer} />
        </>
      ),
    },
    {
      key: 'version',
      label: 'Version Control',
      children: (
        <>
          <ServerSelector />
          <VersionControlTab selectedServer={selectedServer} />
        </>
      ),
    },
    {
      key: 'performance',
      label: 'Performance',
      children: (
        <>
          <ServerSelector />
          <PerformanceMonitorTab selectedServer={selectedServer} />
        </>
      ),
    },
  ];

  // Active tab state
  const [activeTab, setActiveTab] = useState('management');

  return (
    <ConfigProvider>
      <EditorContainer>
        <Header>
          <Title>MCP Editor Tool</Title>
          <Subtitle>
            Create, configure, and manage Model Context Protocol validation servers
          </Subtitle>
        </Header>
        
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          type="card"
          size="large"
          style={{ marginTop: '1rem' }}
        />
      </EditorContainer>
    </ConfigProvider>
  );
};

export default MCPEditorTool; 