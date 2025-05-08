import React, { useState } from 'react';
import styled from 'styled-components';
import { Card, Button, Upload, message, Tabs, Space, Alert, List, Divider, Switch, Checkbox, Progress, Modal, Form, Input, Select, Tooltip } from 'antd';
import { 
  CloudUploadOutlined, 
  CloudDownloadOutlined, 
  SaveOutlined, 
  CloudSyncOutlined, 
  ImportOutlined, 
  ExportOutlined, 
  InfoCircleOutlined, 
  FileOutlined,
  CopyOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Dragger } = Upload;
const { Option } = Select;
const { TextArea } = Input;

// Styled components
const UtilitiesContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const UtilitiesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const UtilitiesTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const StyledCard = styled(Card)`
  margin-bottom: 1.5rem;
`;

const BackupItem = styled.div`
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: ${props => props.isActive ? '#f6ffed' : 'white'};
  border-left: ${props => props.isActive ? '4px solid #52c41a' : '1px solid #eee'};
`;

const BackupInfo = styled.div`
  flex: 1;
`;

const BackupMeta = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  color: #888;
  font-size: 0.9rem;
`;

const SettingsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const SettingItem = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const ConfigPreview = styled.pre`
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  overflow: auto;
  font-size: 0.9rem;
  font-family: monospace;
  max-height: 300px;
`;

/**
 * Server Utilities Component
 * Provides backup/restore capabilities and import/export functionality for server configurations
 */
const ServerUtilities = ({ serverId }) => {
  const [activeTab, setActiveTab] = useState('backup');
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // Mock backup data
  const backups = [
    {
      id: 'bkp-001',
      name: 'Daily Auto-Backup',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      size: '24.5 MB',
      type: 'auto',
      isActive: true,
      contents: {
        configurations: true,
        validationTools: true,
        logs: false,
        customRules: true
      }
    },
    {
      id: 'bkp-002',
      name: 'Pre-Update Backup',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      size: '23.8 MB',
      type: 'manual',
      isActive: false,
      contents: {
        configurations: true,
        validationTools: true,
        logs: true,
        customRules: true
      }
    },
    {
      id: 'bkp-003',
      name: 'Weekly Auto-Backup',
      timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      size: '26.2 MB',
      type: 'auto',
      isActive: false,
      contents: {
        configurations: true,
        validationTools: true,
        logs: false,
        customRules: true
      }
    }
  ];
  
  // Mock backup settings
  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    backupFrequency: 'daily',
    includeConfigurations: true,
    includeValidationTools: true,
    includeLogs: false,
    includeCustomRules: true,
    retentionPeriod: 30,
    compressionEnabled: true
  });
  
  // Mock server configuration for export/import
  const serverConfig = {
    id: serverId || 'gdpr-server-1',
    name: 'GDPR Validation Server',
    description: 'Validates content against GDPR requirements',
    validationLevel: 2,
    port: 3000,
    memoryLimit: 512,
    maxConcurrentRequests: 10,
    regulationType: 'gdpr',
    validationTools: [
      { id: 'text-validator', enabled: true },
      { id: 'pattern-matcher', enabled: true }
    ],
    settings: {
      autoStart: true,
      logLevel: 'info'
    }
  };
  
  // Format date
  const formatDate = (date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Create a new backup
  const handleCreateBackup = () => {
    setBackupInProgress(true);
    
    // Simulate backup process
    setTimeout(() => {
      message.success('Backup created successfully');
      setBackupInProgress(false);
    }, 2000);
  };
  
  // Restore from backup
  const handleRestoreBackup = () => {
    if (!selectedBackup) {
      message.warning('Please select a backup to restore');
      return;
    }
    
    Modal.confirm({
      title: 'Restore from Backup',
      content: `Are you sure you want to restore from the backup "${backups.find(b => b.id === selectedBackup)?.name}"? This will replace your current configuration.`,
      onOk() {
        setRestoreInProgress(true);
        
        // Simulate restore process
        setTimeout(() => {
          message.success('Server restored successfully from backup');
          setRestoreInProgress(false);
        }, 3000);
      }
    });
  };
  
  // Select a backup
  const handleSelectBackup = (backupId) => {
    setSelectedBackup(backupId === selectedBackup ? null : backupId);
  };
  
  // Update backup settings
  const handleUpdateBackupSettings = (key, value) => {
    setBackupSettings({
      ...backupSettings,
      [key]: value
    });
  };
  
  // Show import modal
  const handleShowImportModal = () => {
    form.resetFields();
    setImportModalVisible(true);
  };
  
  // Show export modal
  const handleShowExportModal = () => {
    form.resetFields();
    setExportModalVisible(true);
  };
  
  // Handle import configuration
  const handleImportConfig = (values) => {
    console.log('Import config with values:', values);
    
    // Simulate import process
    setTimeout(() => {
      message.success('Server configuration imported successfully');
      setImportModalVisible(false);
    }, 1500);
  };
  
  // Handle export configuration
  const handleExportConfig = (values) => {
    console.log('Export config with values:', values);
    
    // Simulate export process
    setTimeout(() => {
      message.success('Server configuration exported successfully');
      setExportModalVisible(false);
    }, 1500);
  };
  
  // Handle file upload change
  const handleUploadChange = (info) => {
    const { status } = info.file;
    
    if (status === 'done') {
      message.success(`${info.file.name} file uploaded successfully.`);
    } else if (status === 'error') {
      message.error(`${info.file.name} file upload failed.`);
    }
  };
  
  return (
    <UtilitiesContainer>
      <UtilitiesHeader>
        <UtilitiesTitle>Server Utilities</UtilitiesTitle>
        <Space>
          <Button 
            icon={<ImportOutlined />} 
            onClick={handleShowImportModal}
          >
            Import
          </Button>
          <Button 
            icon={<ExportOutlined />} 
            onClick={handleShowExportModal}
          >
            Export
          </Button>
        </Space>
      </UtilitiesHeader>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={<span><CloudSyncOutlined /> Backup & Restore</span>}
          key="backup"
        >
          <StyledCard title="Create Backup">
            <p>Create a backup of your server configuration and validation tools.</p>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <SettingsContainer>
                <Card title="Backup Contents" size="small">
                  <SettingItem>
                    <span>Include Configurations</span>
                    <Checkbox 
                      checked={backupSettings.includeConfigurations} 
                      onChange={(e) => handleUpdateBackupSettings('includeConfigurations', e.target.checked)}
                    />
                  </SettingItem>
                  <SettingItem>
                    <span>Include Validation Tools</span>
                    <Checkbox 
                      checked={backupSettings.includeValidationTools} 
                      onChange={(e) => handleUpdateBackupSettings('includeValidationTools', e.target.checked)}
                    />
                  </SettingItem>
                  <SettingItem>
                    <span>Include Logs</span>
                    <Checkbox 
                      checked={backupSettings.includeLogs} 
                      onChange={(e) => handleUpdateBackupSettings('includeLogs', e.target.checked)}
                    />
                  </SettingItem>
                  <SettingItem>
                    <span>Include Custom Rules</span>
                    <Checkbox 
                      checked={backupSettings.includeCustomRules} 
                      onChange={(e) => handleUpdateBackupSettings('includeCustomRules', e.target.checked)}
                    />
                  </SettingItem>
                </Card>
                
                <Card title="Backup Options" size="small">
                  <SettingItem>
                    <span>
                      <Space>
                        Enable Compression
                        <Tooltip title="Reduces backup size but may increase backup time">
                          <InfoCircleOutlined />
                        </Tooltip>
                      </Space>
                    </span>
                    <Switch 
                      checked={backupSettings.compressionEnabled} 
                      onChange={(checked) => handleUpdateBackupSettings('compressionEnabled', checked)}
                    />
                  </SettingItem>
                </Card>
              </SettingsContainer>
              
              <Button 
                type="primary" 
                icon={<CloudUploadOutlined />} 
                onClick={handleCreateBackup}
                loading={backupInProgress}
              >
                Create Backup
              </Button>
            </Space>
          </StyledCard>
          
          <StyledCard title="Automatic Backups">
            <Space direction="vertical" style={{ width: '100%' }}>
              <SettingItem>
                <span>Enable Automatic Backups</span>
                <Switch 
                  checked={backupSettings.autoBackup} 
                  onChange={(checked) => handleUpdateBackupSettings('autoBackup', checked)}
                />
              </SettingItem>
              
              <SettingItem>
                <span>Backup Frequency</span>
                <Select 
                  value={backupSettings.backupFrequency} 
                  onChange={(value) => handleUpdateBackupSettings('backupFrequency', value)}
                  style={{ width: 150 }}
                  disabled={!backupSettings.autoBackup}
                >
                  <Option value="hourly">Hourly</Option>
                  <Option value="daily">Daily</Option>
                  <Option value="weekly">Weekly</Option>
                  <Option value="monthly">Monthly</Option>
                </Select>
              </SettingItem>
              
              <SettingItem>
                <span>Backup Retention Period (days)</span>
                <Input 
                  type="number" 
                  value={backupSettings.retentionPeriod} 
                  onChange={(e) => handleUpdateBackupSettings('retentionPeriod', parseInt(e.target.value))}
                  style={{ width: 100 }}
                  disabled={!backupSettings.autoBackup}
                />
              </SettingItem>
              
              <Button type="primary">Save Backup Settings</Button>
            </Space>
          </StyledCard>
          
          <StyledCard title="Available Backups">
            <Space direction="vertical" style={{ width: '100%' }}>
              {backups.map(backup => (
                <BackupItem 
                  key={backup.id} 
                  isActive={backup.isActive}
                  onClick={() => handleSelectBackup(backup.id)}
                  style={{ 
                    cursor: 'pointer',
                    border: selectedBackup === backup.id ? '1px solid #1890ff' : '1px solid #eee',
                    backgroundColor: selectedBackup === backup.id ? '#e6f7ff' : backup.isActive ? '#f6ffed' : 'white'
                  }}
                >
                  <BackupInfo>
                    <h4>
                      {backup.name}
                      {backup.isActive && (
                        <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>
                          <CheckCircleOutlined style={{ color: 'green' }} /> Active
                        </span>
                      )}
                    </h4>
                    <BackupMeta>
                      <span>{formatDate(backup.timestamp)}</span>
                      <span>{backup.size}</span>
                      <span>{backup.type === 'auto' ? 'Automatic' : 'Manual'}</span>
                    </BackupMeta>
                  </BackupInfo>
                  <Space>
                    <Button 
                      icon={<DownloadOutlined />}
                      size="small"
                    >
                      Download
                    </Button>
                    <Button 
                      danger
                      icon={<CloseCircleOutlined />}
                      size="small"
                    >
                      Delete
                    </Button>
                  </Space>
                </BackupItem>
              ))}
              
              <Button 
                type="primary" 
                icon={<CloudDownloadOutlined />} 
                onClick={handleRestoreBackup}
                disabled={!selectedBackup}
                loading={restoreInProgress}
              >
                Restore Selected Backup
              </Button>
            </Space>
          </StyledCard>
        </TabPane>
        
        <TabPane 
          tab={<span><ImportOutlined /> Import & Export</span>}
          key="import-export"
        >
          <Alert
            message="Transfer Server Configurations"
            description="Import and export server configurations to transfer settings between environments or create templates."
            type="info"
            showIcon
            style={{ marginBottom: '1.5rem' }}
          />
          
          <StyledCard title="Import Configuration">
            <p>Import a server configuration from a file:</p>
            
            <Dragger 
              name="file"
              multiple={false}
              action="https://www.mocky.io/v2/5cc8019d300000980a055e76"
              onChange={handleUploadChange}
              style={{ marginBottom: '1rem' }}
            >
              <p className="ant-upload-drag-icon">
                <ImportOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">
                Support for .json configuration files
              </p>
            </Dragger>
            
            <Button 
              type="primary" 
              icon={<ImportOutlined />}
              onClick={handleShowImportModal}
            >
              Import Configuration
            </Button>
          </StyledCard>
          
          <StyledCard title="Export Configuration">
            <p>Export your current server configuration:</p>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card size="small" title="Current Configuration">
                <ConfigPreview>
                  {JSON.stringify(serverConfig, null, 2)}
                </ConfigPreview>
              </Card>
              
              <Space>
                <Button 
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(serverConfig, null, 2));
                    message.success('Configuration copied to clipboard');
                  }}
                >
                  Copy to Clipboard
                </Button>
                <Button 
                  type="primary" 
                  icon={<ExportOutlined />}
                  onClick={handleShowExportModal}
                >
                  Export Configuration
                </Button>
              </Space>
            </Space>
          </StyledCard>
          
          <StyledCard title="Batch Operations">
            <p>Perform operations on multiple servers at once:</p>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card size="small" title="Available Servers">
                <List
                  size="small"
                  dataSource={[
                    { id: 'gdpr-server-1', name: 'GDPR Validation Server' },
                    { id: 'hipaa-server-1', name: 'HIPAA Compliance Server' },
                    { id: 'ccpa-server-1', name: 'CCPA Validation Service' }
                  ]}
                  renderItem={item => (
                    <List.Item
                      actions={[
                        <Checkbox />
                      ]}
                    >
                      {item.name}
                    </List.Item>
                  )}
                />
              </Card>
              
              <Space>
                <Button>
                  Apply Template to Selected
                </Button>
                <Button>
                  Sync Selected Servers
                </Button>
              </Space>
            </Space>
          </StyledCard>
        </TabPane>
      </Tabs>
      
      {/* Import Configuration Modal */}
      <Modal
        title="Import Server Configuration"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleImportConfig}
        >
          <Form.Item
            name="configSource"
            label="Configuration Source"
            initialValue="file"
          >
            <Select>
              <Option value="file">From File</Option>
              <Option value="text">From JSON Text</Option>
              <Option value="template">From Template</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="configData"
            label="Configuration Data"
            rules={[{ required: true, message: 'Please enter configuration data' }]}
          >
            <TextArea rows={10} placeholder="Paste your JSON configuration here..." />
          </Form.Item>
          
          <Form.Item
            name="importOptions"
            label="Import Options"
          >
            <Checkbox.Group>
              <Space direction="vertical">
                <Checkbox value="preserveId">Preserve Server ID</Checkbox>
                <Checkbox value="overwrite">Overwrite Existing Configuration</Checkbox>
                <Checkbox value="includeTools" defaultChecked>Include Validation Tools</Checkbox>
                <Checkbox value="includeRules" defaultChecked>Include Custom Rules</Checkbox>
              </Space>
            </Checkbox.Group>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Import
              </Button>
              <Button onClick={() => setImportModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* Export Configuration Modal */}
      <Modal
        title="Export Server Configuration"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExportConfig}
        >
          <Form.Item
            name="exportName"
            label="Export Filename"
            initialValue="server-config"
          >
            <Input placeholder="Enter filename (without extension)" />
          </Form.Item>
          
          <Form.Item
            name="exportFormat"
            label="Export Format"
            initialValue="json"
          >
            <Select>
              <Option value="json">JSON (recommended)</Option>
              <Option value="yaml">YAML</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="exportOptions"
            label="Export Options"
          >
            <Checkbox.Group>
              <Space direction="vertical">
                <Checkbox value="includeId" defaultChecked>Include Server ID</Checkbox>
                <Checkbox value="includeTools" defaultChecked>Include Validation Tools</Checkbox>
                <Checkbox value="includeRules" defaultChecked>Include Custom Rules</Checkbox>
                <Checkbox value="redactSecrets" defaultChecked>Redact Secrets/Credentials</Checkbox>
              </Space>
            </Checkbox.Group>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Export
              </Button>
              <Button onClick={() => setExportModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </UtilitiesContainer>
  );
};

export default ServerUtilities; 