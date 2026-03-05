import React, { useState } from 'react';
import styled from 'styled-components';
import { Tabs, Form, Input, Select, InputNumber, Radio, Switch, Button, Space, Card, message } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// Styled components
const EditorContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const EditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const EditorTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const TabContent = styled.div`
  padding: 1rem 0;
`;

const FormSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h4`
  margin-bottom: 1rem;
  color: ${props => props.theme.colors.text};
  font-weight: 500;
`;

/**
 * Configuration Editor Component
 * Allows editing of MCP server configuration settings
 */
const ConfigurationEditor = ({ serverId }) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  
  // Mock server data - would be fetched from API in real implementation
  const [serverConfig, setServerConfig] = useState({
    name: 'GDPR Validation Server',
    description: 'Validates content against GDPR (General Data Protection Regulation) requirements.',
    validationLevel: 2,
    maxConcurrentRequests: 10,
    memoryLimit: 512,
    port: 3000,
    autoStart: true,
    logLevel: 'info',
    validationCertainty: 80,
    regulationType: 'gdpr',
    regulationVersion: '2018-05',
    regulationIdentifier: 'REG-GDPR-2016-679',
    databaseConnection: {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'regulation_db',
      username: 'admin',
    },
    apiEndpoints: {
      enabled: true,
      baseUrl: '/api/v1',
      authRequired: true
    },
    validationTools: [
      {
        id: 'text-validator',
        name: 'Text Validator',
        description: 'Basic text validation against regulation content',
        enabled: true
      },
      {
        id: 'pattern-matcher',
        name: 'Pattern Matcher',
        description: 'Advanced pattern matching for structured content',
        enabled: true
      }
    ]
  });
  
  // Initialize form with server config
  React.useEffect(() => {
    form.setFieldsValue({
      // Basic settings
      name: serverConfig.name,
      description: serverConfig.description,
      validationLevel: serverConfig.validationLevel,
      maxConcurrentRequests: serverConfig.maxConcurrentRequests,
      memoryLimit: serverConfig.memoryLimit,
      port: serverConfig.port,
      autoStart: serverConfig.autoStart,
      logLevel: serverConfig.logLevel,
      
      // Regulation settings
      validationCertainty: serverConfig.validationCertainty,
      regulationType: serverConfig.regulationType,
      regulationVersion: serverConfig.regulationVersion,
      regulationIdentifier: serverConfig.regulationIdentifier,
      
      // Integration settings
      dbType: serverConfig.databaseConnection.type,
      dbHost: serverConfig.databaseConnection.host,
      dbPort: serverConfig.databaseConnection.port,
      dbName: serverConfig.databaseConnection.database,
      dbUsername: serverConfig.databaseConnection.username,
      apiEnabled: serverConfig.apiEndpoints.enabled,
      apiBaseUrl: serverConfig.apiEndpoints.baseUrl,
      apiAuthRequired: serverConfig.apiEndpoints.authRequired
    });
  }, [serverConfig, form]);
  
  // Handle form submission
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        console.log('Saved configuration:', values);
        
        // Update local state
        setServerConfig({
          ...serverConfig,
          name: values.name,
          description: values.description,
          validationLevel: values.validationLevel,
          maxConcurrentRequests: values.maxConcurrentRequests,
          memoryLimit: values.memoryLimit,
          port: values.port,
          autoStart: values.autoStart,
          logLevel: values.logLevel,
          validationCertainty: values.validationCertainty,
          regulationType: values.regulationType,
          regulationVersion: values.regulationVersion,
          regulationIdentifier: values.regulationIdentifier,
          databaseConnection: {
            type: values.dbType,
            host: values.dbHost,
            port: values.dbPort,
            database: values.dbName,
            username: values.dbUsername,
          },
          apiEndpoints: {
            enabled: values.apiEnabled,
            baseUrl: values.apiBaseUrl,
            authRequired: values.apiAuthRequired
          }
        });
        
        setLoading(false);
        message.success('Server configuration saved successfully!');
      }, 800);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };
  
  // Reset form to original values
  const handleReset = () => {
    form.resetFields();
    message.info('Form reset to saved values');
  };
  
  return (
    <EditorContainer>
      <EditorHeader>
        <EditorTitle>Edit Server Configuration</EditorTitle>
        <ButtonGroup>
          <Button 
            icon={<UndoOutlined />} 
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave}
            loading={loading}
          >
            Save Changes
          </Button>
        </ButtonGroup>
      </EditorHeader>
      
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          logLevel: 'info',
          dbType: 'postgres'
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Basic Settings" key="basic">
            <TabContent>
              <FormSection>
                <SectionTitle>Server Identification</SectionTitle>
                
                <Form.Item
                  name="name"
                  label="Server Name"
                  rules={[{ required: true, message: 'Please enter a name for this server' }]}
                >
                  <Input placeholder="e.g., GDPR Validation Server" />
                </Form.Item>
                
                <Form.Item
                  name="description"
                  label="Description"
                >
                  <TextArea 
                    placeholder="Description of this server's purpose and functionality" 
                    rows={3}
                  />
                </Form.Item>
              </FormSection>
              
              <FormSection>
                <SectionTitle>Validation Configuration</SectionTitle>
                
                <Form.Item
                  name="validationLevel"
                  label="Validation Level (LOV)"
                  rules={[{ required: true, message: 'Please select a validation level' }]}
                >
                  <Radio.Group>
                    <Space direction="vertical">
                      <Radio value={1}>Level 1: Basic text validation (Web scraper)</Radio>
                      <Radio value={2}>Level 2: Pattern matching and contextual validation (API)</Radio>
                      <Radio value={3}>Level 3: AI-assisted validation for complex regulations</Radio>
                      <Radio value={4}>Level 4: Human-in-the-loop validation for highest certainty</Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>
              </FormSection>
              
              <FormSection>
                <SectionTitle>Server Resources</SectionTitle>
                
                <Space style={{ display: 'flex' }} align="baseline">
                  <Form.Item
                    name="port"
                    label="Server Port"
                    rules={[{ required: true, message: 'Please enter a port number' }]}
                  >
                    <InputNumber min={1024} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                  
                  <Form.Item
                    name="memoryLimit"
                    label="Memory Limit (MB)"
                  >
                    <InputNumber min={128} max={4096} style={{ width: '100%' }} />
                  </Form.Item>
                  
                  <Form.Item
                    name="maxConcurrentRequests"
                    label="Max Concurrent Requests"
                  >
                    <InputNumber min={1} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                
                <Space style={{ display: 'flex' }} align="baseline">
                  <Form.Item
                    name="autoStart"
                    label="Auto-start server on boot"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="logLevel"
                    label="Log Level"
                  >
                    <Select style={{ width: 200 }}>
                      <Option value="error">Error</Option>
                      <Option value="warn">Warning</Option>
                      <Option value="info">Info</Option>
                      <Option value="debug">Debug</Option>
                      <Option value="trace">Trace</Option>
                    </Select>
                  </Form.Item>
                </Space>
              </FormSection>
            </TabContent>
          </TabPane>
          
          <TabPane tab="Regulation Settings" key="regulation">
            <TabContent>
              <FormSection>
                <SectionTitle>Regulation Configuration</SectionTitle>
                
                <Form.Item
                  name="regulationType"
                  label="Regulation Type"
                  rules={[{ required: true, message: 'Please select a regulation type' }]}
                >
                  <Select placeholder="Select a regulation type">
                    <Option value="gdpr">GDPR (General Data Protection Regulation)</Option>
                    <Option value="hipaa">HIPAA (Health Insurance Portability and Accountability Act)</Option>
                    <Option value="ccpa">CCPA (California Consumer Privacy Act)</Option>
                    <Option value="pci-dss">PCI DSS (Payment Card Industry Data Security Standard)</Option>
                    <Option value="sox">SOX (Sarbanes-Oxley Act)</Option>
                    <Option value="custom">Custom Regulation</Option>
                  </Select>
                </Form.Item>
                
                <Space style={{ display: 'flex' }} align="baseline">
                  <Form.Item
                    name="regulationVersion"
                    label="Regulation Version"
                    rules={[{ required: true, message: 'Please enter a version' }]}
                  >
                    <Input placeholder="e.g., 1.0.0 or 2018-01" />
                  </Form.Item>
                  
                  <Form.Item
                    name="regulationIdentifier"
                    label="Regulation Identifier"
                  >
                    <Input placeholder="e.g., REG-GDPR-2016-679" />
                  </Form.Item>
                </Space>
                
                <Form.Item
                  name="validationCertainty"
                  label="Validation Certainty Threshold (%)"
                  rules={[{ required: true, message: 'Please set a certainty threshold' }]}
                >
                  <InputNumber min={0} max={100} style={{ width: 200 }} />
                </Form.Item>
              </FormSection>
            </TabContent>
          </TabPane>
          
          <TabPane tab="Integration Settings" key="integration">
            <TabContent>
              <FormSection>
                <SectionTitle>Database Configuration</SectionTitle>
                
                <Form.Item
                  name="dbType"
                  label="Database Type"
                >
                  <Select style={{ width: 200 }}>
                    <Option value="postgres">PostgreSQL</Option>
                    <Option value="mysql">MySQL</Option>
                    <Option value="mongodb">MongoDB</Option>
                    <Option value="sqlite">SQLite</Option>
                  </Select>
                </Form.Item>
                
                <Space style={{ display: 'flex' }} align="baseline">
                  <Form.Item
                    name="dbHost"
                    label="Host"
                  >
                    <Input placeholder="e.g., localhost" />
                  </Form.Item>
                  
                  <Form.Item
                    name="dbPort"
                    label="Port"
                  >
                    <InputNumber placeholder="e.g., 5432" style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                
                <Space style={{ display: 'flex' }} align="baseline">
                  <Form.Item
                    name="dbName"
                    label="Database Name"
                  >
                    <Input placeholder="e.g., regulation_db" />
                  </Form.Item>
                  
                  <Form.Item
                    name="dbUsername"
                    label="Username"
                  >
                    <Input placeholder="e.g., admin" />
                  </Form.Item>
                </Space>
              </FormSection>
              
              <FormSection>
                <SectionTitle>API Configuration</SectionTitle>
                
                <Form.Item
                  name="apiEnabled"
                  label="Enable API Endpoints"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name="apiBaseUrl"
                  label="API Base URL"
                >
                  <Input placeholder="e.g., /api/v1" />
                </Form.Item>
                
                <Form.Item
                  name="apiAuthRequired"
                  label="Require Authentication"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </FormSection>
            </TabContent>
          </TabPane>
        </Tabs>
      </Form>
    </EditorContainer>
  );
};

export default ConfigurationEditor; 