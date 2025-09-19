import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Card, 
  Form, 
  Input, 
  InputNumber, 
  Switch, 
  Button, 
  Select, 
  Divider, 
  Space, 
  Row, 
  Col,
  Tabs,
  Alert,
  Tag
} from 'antd';
import { 
  SaveOutlined, 
  ReloadOutlined, 
  SettingOutlined,
  SecurityScanOutlined,
  DatabaseOutlined,
  ApiOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;

// Styled Components
const SettingsContainer = styled.div`
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
`;

const SettingsHeader = styled.div`
  background: white;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const SettingsTitle = styled.h1`
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 28px;
  font-weight: 600;
`;

const SettingsSubtitle = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 16px;
`;

const SettingCard = styled(Card)`
  margin-bottom: 16px;
`;

const SystemSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    // System Configuration
    system: {
      maxConcurrentRequests: 100,
      requestTimeout: 30000,
      enableLogging: true,
      logLevel: 'info',
      enableMetrics: true,
      autoRestart: true
    },
    // API Configuration
    api: {
      rateLimit: 1000,
      enableCors: true,
      corsOrigins: ['http://localhost:3050', 'https://mcp-engine.com'],
      apiVersion: '4.0',
      enableSwagger: true
    },
    // Database Configuration
    database: {
      connectionPoolSize: 10,
      queryTimeout: 5000,
      enableCaching: true,
      cacheExpiry: 3600,
      enableBackups: true,
      backupInterval: 24
    },
    // Security Configuration
    security: {
      enableAuth: false,
      sessionTimeout: 3600,
      enableRateLimit: true,
      maxLoginAttempts: 5,
      enableAuditLog: true,
      encryptionEnabled: false
    },
    // Regulation Configuration
    regulations: {
      enableFederalRegister: true,
      enableStateRegulations: true,
      enableThirdPartyAgencies: false,
      autoUpdateRegulations: true,
      updateInterval: 24,
      enableValidationCache: true
    }
  });

  // Load settings
  const loadSettings = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from an API
      // For now, we'll use the default settings
      form.setFieldsValue(settings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save settings
  const handleSave = async (values) => {
    try {
      setSaving(true);
      
      // In a real implementation, this would save to an API
      console.log('Saving settings:', values);
      
      setSettings(values);
      
      // Show success message
      // toast.success('Settings saved successfully!');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      // toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    form.setFieldsValue(settings);
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Tab items
  const tabItems = [
    {
      key: 'system',
      label: (
        <span>
          <SettingOutlined />
          System
        </span>
      ),
      children: (
        <SettingCard title="System Configuration">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['system', 'maxConcurrentRequests']}
                label="Max Concurrent Requests"
                tooltip="Maximum number of concurrent API requests"
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['system', 'requestTimeout']}
                label="Request Timeout (ms)"
                tooltip="API request timeout in milliseconds"
              >
                <InputNumber min={1000} max={60000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['system', 'logLevel']}
                label="Log Level"
                tooltip="System logging level"
              >
                <Select>
                  <Option value="debug">Debug</Option>
                  <Option value="info">Info</Option>
                  <Option value="warn">Warning</Option>
                  <Option value="error">Error</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['system', 'enableLogging']}
                label="Enable Logging"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['system', 'enableMetrics']}
                label="Enable Metrics"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['system', 'autoRestart']}
                label="Auto Restart Services"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </SettingCard>
      )
    },
    {
      key: 'api',
      label: (
        <span>
          <ApiOutlined />
          API
        </span>
      ),
      children: (
        <SettingCard title="API Configuration">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['api', 'rateLimit']}
                label="Rate Limit (requests/hour)"
                tooltip="Maximum requests per hour per client"
              >
                <InputNumber min={100} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['api', 'apiVersion']}
                label="API Version"
              >
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['api', 'enableCors']}
                label="Enable CORS"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['api', 'enableSwagger']}
                label="Enable API Documentation"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name={['api', 'corsOrigins']}
            label="CORS Origins"
            tooltip="Allowed origins for CORS requests"
          >
            <Select mode="tags" placeholder="Add allowed origins">
              <Option value="http://localhost:3050">http://localhost:3050</Option>
              <Option value="https://mcp-engine.com">https://mcp-engine.com</Option>
            </Select>
          </Form.Item>
        </SettingCard>
      )
    },
    {
      key: 'database',
      label: (
        <span>
          <DatabaseOutlined />
          Database
        </span>
      ),
      children: (
        <SettingCard title="Database Configuration">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['database', 'connectionPoolSize']}
                label="Connection Pool Size"
                tooltip="Maximum database connections"
              >
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['database', 'queryTimeout']}
                label="Query Timeout (ms)"
                tooltip="Database query timeout"
              >
                <InputNumber min={1000} max={30000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['database', 'cacheExpiry']}
                label="Cache Expiry (seconds)"
                tooltip="Cache expiration time"
              >
                <InputNumber min={60} max={86400} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['database', 'backupInterval']}
                label="Backup Interval (hours)"
                tooltip="Automatic backup interval"
              >
                <InputNumber min={1} max={168} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['database', 'enableCaching']}
                label="Enable Caching"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['database', 'enableBackups']}
                label="Enable Backups"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </SettingCard>
      )
    },
    {
      key: 'security',
      label: (
        <span>
          <SecurityScanOutlined />
          Security
        </span>
      ),
      children: (
        <SettingCard title="Security Configuration">
          <Alert
            message="Security Settings"
            description="These settings affect system security. Changes should be made carefully."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['security', 'sessionTimeout']}
                label="Session Timeout (seconds)"
                tooltip="User session timeout"
              >
                <InputNumber min={300} max={86400} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['security', 'maxLoginAttempts']}
                label="Max Login Attempts"
                tooltip="Maximum failed login attempts before lockout"
              >
                <InputNumber min={3} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['security', 'enableAuth']}
                label="Enable Authentication"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['security', 'enableRateLimit']}
                label="Enable Rate Limiting"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['security', 'enableAuditLog']}
                label="Enable Audit Logging"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </SettingCard>
      )
    },
    {
      key: 'regulations',
      label: (
        <span>
          📋
          Regulations
        </span>
      ),
      children: (
        <SettingCard title="Regulation Configuration">
          <Alert
            message="Regulation Coverage"
            description="Configure which regulatory sources are enabled for compliance monitoring."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['regulations', 'updateInterval']}
                label="Update Interval (hours)"
                tooltip="How often to check for regulation updates"
              >
                <InputNumber min={1} max={168} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Divider>Regulatory Sources</Divider>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['regulations', 'enableFederalRegister']}
                label="Federal Register"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Tag color="blue">295+ Regulations</Tag>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['regulations', 'enableStateRegulations']}
                label="State Regulations"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Tag color="green">52+ PA Regulations</Tag>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['regulations', 'enableThirdPartyAgencies']}
                label="Third-Party Agencies"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Tag color="orange">Coming Soon</Tag>
            </Col>
          </Row>
          
          <Divider>Automation</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['regulations', 'autoUpdateRegulations']}
                label="Auto-Update Regulations"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['regulations', 'enableValidationCache']}
                label="Enable Validation Cache"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </SettingCard>
      )
    }
  ];

  return (
    <SettingsContainer>
      <SettingsHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SettingsTitle>System Settings</SettingsTitle>
            <SettingsSubtitle>
              Configure MCP Engine system parameters and operational settings
            </SettingsSubtitle>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              Reset
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={() => form.submit()}
              loading={saving}
            >
              Save Settings
            </Button>
          </Space>
        </div>
      </SettingsHeader>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={settings}
        >
          <Tabs items={tabItems} />
        </Form>
      </Card>
    </SettingsContainer>
  );
};

export default SystemSettings;
