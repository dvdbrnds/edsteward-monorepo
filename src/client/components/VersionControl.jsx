import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Table, Button, Select, Tag, Space, Tabs, Dropdown, Menu, Modal, Form, Input, DatePicker, Timeline, Card, Divider, Alert, Spin, Badge, Tooltip, message } from 'antd';
import { 
  HistoryOutlined, 
  BranchesOutlined, 
  SwapOutlined, 
  TagOutlined, 
  DownOutlined, 
  PlusOutlined, 
  RollbackOutlined, 
  DiffOutlined,
  ExportOutlined,
  ImportOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

// Styled components
const VersionContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const VersionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const VersionTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const VersionInfo = styled.div`
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  border-left: 4px solid ${props => props.theme.colors.primary};
`;

const DiffView = styled.div`
  font-family: monospace;
  font-size: 0.9rem;
  background-color: #f8f8f8;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  margin-top: 1rem;
  overflow: auto;
  max-height: 400px;
`;

const DiffLine = styled.div`
  padding: 2px 0;
  white-space: pre;
  ${props => props.type === 'added' && `
    background-color: #e6ffed;
    color: #22863a;
    border-left: 4px solid #22863a;
    padding-left: 4px;
  `}
  ${props => props.type === 'removed' && `
    background-color: #ffeef0;
    color: #cb2431;
    border-left: 4px solid #cb2431;
    padding-left: 4px;
  `}
`;

const CompareContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
`;

const VersionTag = styled(Tag)`
  padding: 4px 8px;
  border-radius: 16px;
`;

const ChangesetCard = styled(Card)`
  margin-bottom: 1rem;
`;

/**
 * Version Control Component
 * Manages regulation versions, history, and comparisons
 */
const VersionControl = ({ serverId }) => {
  const [activeTab, setActiveTab] = useState('history');
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareFromVersion, setCompareFromVersion] = useState(null);
  const [compareToVersion, setCompareToVersion] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // Generate mock version data
  useEffect(() => {
    // Simulate API call
    setLoading(true);
    
    setTimeout(() => {
      const mockVersions = generateMockVersionData();
      setVersions(mockVersions);
      
      // Set default selected version to latest
      if (mockVersions.length > 0) {
        setSelectedVersion(mockVersions[0].id);
        setCompareToVersion(mockVersions[0].id);
        if (mockVersions.length > 1) {
          setCompareFromVersion(mockVersions[1].id);
        }
      }
      
      setLoading(false);
    }, 800);
  }, []);
  
  // Generate mock version data
  const generateMockVersionData = () => {
    const now = new Date();
    const mockVersions = [
      {
        id: 'v1.5.2',
        name: 'GDPR 2023 Q2 Update',
        description: 'Updated provisions for data sharing under Article 13',
        timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        author: 'Jane Smith',
        status: 'active',
        changeCount: 8,
        isDeployed: true,
        tags: ['production', 'gdpr', 'stable'],
        changesets: [
          {
            id: 'cs-001',
            title: 'Update Article 13 processing disclosures',
            description: 'Clarified language around third-party data processing disclosures',
            sections: ['Art. 13', 'Recital 42'],
            timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
          {
            id: 'cs-002',
            title: 'Add new legitimate interest examples',
            description: 'Added examples of valid legitimate interest scenarios',
            sections: ['Art. 6(1)(f)', 'Recital 47'],
            timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
          }
        ]
      },
      {
        id: 'v1.5.1',
        name: 'GDPR 2023 Q1 Update',
        description: 'Minor updates to data breach notification requirements',
        timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        author: 'John Doe',
        status: 'archived',
        changeCount: 3,
        isDeployed: false,
        tags: ['gdpr', 'stable'],
        changesets: [
          {
            id: 'cs-003',
            title: 'Revise breach notification timelines',
            description: 'Updated notification requirements for specific types of breaches',
            sections: ['Art. 33', 'Art. 34'],
            timestamp: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
          }
        ]
      },
      {
        id: 'v1.5.0',
        name: 'GDPR 2022 Q4 Update',
        description: 'Major update to consent requirements and cookie policies',
        timestamp: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        author: 'Anne Johnson',
        status: 'archived',
        changeCount: 12,
        isDeployed: false,
        tags: ['gdpr'],
        changesets: [
          {
            id: 'cs-004',
            title: 'Update cookie consent requirements',
            description: 'New requirements for obtaining and managing cookie consent',
            sections: ['Art. 7', 'Recital 32'],
            timestamp: new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000),
          },
          {
            id: 'cs-005',
            title: 'Add child consent provisions',
            description: 'Additional safeguards for processing children\'s data',
            sections: ['Art. 8', 'Recital 38'],
            timestamp: new Date(now.getTime() - 92 * 24 * 60 * 60 * 1000),
          }
        ]
      },
      {
        id: 'v1.4.2',
        name: 'GDPR 2022 Q3 Hotfix',
        description: 'Critical fix for Article 15 access right requirements',
        timestamp: new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000), // 150 days ago
        author: 'Mike Williams',
        status: 'archived',
        changeCount: 2,
        isDeployed: false,
        tags: ['gdpr', 'hotfix'],
        changesets: [
          {
            id: 'cs-006',
            title: 'Fix Article 15 requirements',
            description: 'Critical fix for right of access implementation',
            sections: ['Art. 15'],
            timestamp: new Date(now.getTime() - 151 * 24 * 60 * 60 * 1000),
          }
        ]
      }
    ];
    
    return mockVersions;
  };
  
  // Get a version object by ID
  const getVersionById = (versionId) => {
    return versions.find(v => v.id === versionId) || null;
  };
  
  // Handle version selection
  const handleVersionSelect = (versionId) => {
    setSelectedVersion(versionId);
  };
  
  // Handle comparison version changes
  const handleCompareFromChange = (value) => {
    setCompareFromVersion(value);
  };
  
  const handleCompareToChange = (value) => {
    setCompareToVersion(value);
  };
  
  // Run comparison between versions
  const handleRunComparison = () => {
    if (!compareFromVersion || !compareToVersion) return;
    
    setLoading(true);
    
    // Simulate API call for diff
    setTimeout(() => {
      const fromVersion = getVersionById(compareFromVersion);
      const toVersion = getVersionById(compareToVersion);
      
      // Mock diff result
      const mockDiff = [
        {
          section: 'Article 13 (Information to be provided)',
          changes: [
            { type: 'context', content: '1. Where personal data relating to a data subject are collected from the data subject, the controller shall...' },
            { type: 'removed', content: '(c) the purposes of the processing for which the personal data are intended as well as the legal basis for the processing;' },
            { type: 'added', content: '(c) the purposes of the processing for which the personal data are intended as well as the legal basis for the processing, including a clear explanation of legitimate interests where relied upon;' },
            { type: 'context', content: '(d) where the processing is based on point (f) of Article 6(1), the legitimate interests pursued by the controller or by a third party;' }
          ]
        },
        {
          section: 'Recital 42 (Burden of proof for consent)',
          changes: [
            { type: 'context', content: 'Where processing is based on the data subject\'s consent...' },
            { type: 'added', content: 'Pre-formulated declarations of consent should be provided in an intelligible and easily accessible form, using clear and plain language and should not contain unfair terms.' },
            { type: 'context', content: 'For consent to be informed, the data subject should be aware at least of the identity of the controller and the purposes of the processing...' }
          ]
        }
      ];
      
      setDiffResult({
        fromVersion,
        toVersion,
        diff: mockDiff
      });
      
      setLoading(false);
    }, 1000);
  };
  
  // Apply a version
  const handleApplyVersion = (versionId) => {
    Modal.confirm({
      title: 'Deploy Version',
      content: `Are you sure you want to deploy version ${versionId} to this server?`,
      onOk: () => {
        setLoading(true);
        
        // Simulate API call
        setTimeout(() => {
          // Mark all versions as not deployed
          const updatedVersions = versions.map(v => ({
            ...v,
            isDeployed: v.id === versionId
          }));
          
          setVersions(updatedVersions);
          setLoading(false);
          
          // Success message
          message.success(`Version ${versionId} successfully deployed`);
        }, 1500);
      }
    });
  };
  
  // Show tag version modal
  const handleShowTagModal = () => {
    form.resetFields();
    setTagModalVisible(true);
  };
  
  // Create a new version tag
  const handleCreateVersionTag = (values) => {
    const { tagName, tagDescription } = values;
    
    if (selectedVersion) {
      const updatedVersions = versions.map(v => {
        if (v.id === selectedVersion) {
          return {
            ...v,
            tags: [...v.tags, tagName]
          };
        }
        return v;
      });
      
      setVersions(updatedVersions);
      setTagModalVisible(false);
      
      // Success message
      message.success(`Tag "${tagName}" added to version ${selectedVersion}`);
    }
  };
  
  // Format date
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get version status tag color
  const getStatusTagColor = (status) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'pending':
        return 'orange';
      case 'archived':
        return 'default';
      default:
        return 'blue';
    }
  };
  
  // Columns for versions table
  const versionColumns = [
    {
      title: 'Version',
      dataIndex: 'id',
      key: 'id',
      render: (id, record) => (
        <Space>
          <span>{id}</span>
          {record.isDeployed && <Badge status="processing" text="Deployed" />}
        </Space>
      )
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date) => formatDate(date)
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusTagColor(status)}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (
        <>
          {tags.map(tag => (
            <VersionTag key={tag} color="blue">{tag}</VersionTag>
          ))}
        </>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            onClick={() => handleVersionSelect(record.id)}
          >
            Details
          </Button>
          {!record.isDeployed && (
            <Button 
              size="small" 
              type="primary"
              onClick={() => handleApplyVersion(record.id)}
            >
              Deploy
            </Button>
          )}
        </Space>
      )
    }
  ];
  
  // Render version details
  const renderVersionDetails = () => {
    if (!selectedVersion) return null;
    
    const version = getVersionById(selectedVersion);
    if (!version) return null;
    
    return (
      <div>
        <VersionInfo>
          <h3>{version.name} ({version.id})</h3>
          <p>{version.description}</p>
          <Space>
            <span><strong>Created:</strong> {formatDate(version.timestamp)}</span>
            <span><strong>Author:</strong> {version.author}</span>
            <span><strong>Status:</strong> <Tag color={getStatusTagColor(version.status)}>{version.status.toUpperCase()}</Tag></span>
            {version.isDeployed && <Badge status="processing" text="Currently Deployed" />}
          </Space>
          <div style={{ marginTop: '0.5rem' }}>
            <Space>
              <span><strong>Tags:</strong></span>
              {version.tags.map(tag => (
                <VersionTag key={tag} color="blue">{tag}</VersionTag>
              ))}
              <Button 
                size="small" 
                icon={<PlusOutlined />}
                onClick={handleShowTagModal}
              >
                Add Tag
              </Button>
            </Space>
          </div>
        </VersionInfo>
        
        <Divider orientation="left">Changesets ({version.changesets.length})</Divider>
        
        {version.changesets.map(changeset => (
          <ChangesetCard key={changeset.id} size="small">
            <h4>{changeset.title}</h4>
            <p>{changeset.description}</p>
            <Space size="large">
              <span><strong>Date:</strong> {formatDate(changeset.timestamp)}</span>
              <span>
                <strong>Affected Sections:</strong> {changeset.sections.join(', ')}
              </span>
            </Space>
          </ChangesetCard>
        ))}
      </div>
    );
  };
  
  // Render diff results
  const renderDiffResults = () => {
    if (!diffResult) {
      return (
        <Alert
          message="No Comparison Results"
          description="Select versions and click 'Compare' to see the differences between regulation versions."
          type="info"
          showIcon
        />
      );
    }
    
    const { fromVersion, toVersion, diff } = diffResult;
    
    return (
      <div>
        <Alert
          message={`Comparing ${fromVersion.id} → ${toVersion.id}`}
          description={`Showing changes from "${fromVersion.name}" to "${toVersion.name}"`}
          type="info"
          showIcon
          style={{ marginBottom: '1rem' }}
        />
        
        {diff.map((section, idx) => (
          <div key={idx}>
            <h4>{section.section}</h4>
            <DiffView>
              {section.changes.map((change, i) => (
                <DiffLine key={i} type={change.type}>
                  {change.type === 'added' ? '+ ' : change.type === 'removed' ? '- ' : '  '}
                  {change.content}
                </DiffLine>
              ))}
            </DiffView>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <VersionContainer>
      <VersionHeader>
        <VersionTitle>Version Control & Regulation Management</VersionTitle>
        <Space>
          <Tooltip title="Import Version">
            <Button icon={<ImportOutlined />}>
              Import
            </Button>
          </Tooltip>
          <Tooltip title="Export Version">
            <Button icon={<ExportOutlined />}>
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Create New Version">
            <Button type="primary" icon={<PlusOutlined />}>
              New Version
            </Button>
          </Tooltip>
        </Space>
      </VersionHeader>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={<span><HistoryOutlined /> Version History</span>}
          key="history"
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spin size="large" />
            </div>
          ) : (
            <div>
              <Table 
                dataSource={versions} 
                columns={versionColumns}
                rowKey="id"
                pagination={false}
                style={{ marginBottom: '1.5rem' }}
              />
              
              {selectedVersion && renderVersionDetails()}
            </div>
          )}
        </TabPane>
        
        <TabPane 
          tab={<span><SwapOutlined /> Compare Versions</span>}
          key="compare"
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spin size="large" />
            </div>
          ) : (
            <div>
              <CompareContainer>
                <Select
                  value={compareFromVersion}
                  onChange={handleCompareFromChange}
                  style={{ width: 200 }}
                  placeholder="From Version"
                  disabled={versions.length < 1}
                >
                  {versions.map(version => (
                    <Option key={version.id} value={version.id}>
                      {version.id} - {version.name}
                    </Option>
                  ))}
                </Select>
                
                <BranchesOutlined style={{ fontSize: '24px' }} />
                
                <Select
                  value={compareToVersion}
                  onChange={handleCompareToChange}
                  style={{ width: 200 }}
                  placeholder="To Version"
                  disabled={versions.length < 1}
                >
                  {versions.map(version => (
                    <Option key={version.id} value={version.id}>
                      {version.id} - {version.name}
                    </Option>
                  ))}
                </Select>
                
                <Button 
                  type="primary" 
                  icon={<DiffOutlined />} 
                  onClick={handleRunComparison}
                  disabled={!compareFromVersion || !compareToVersion || compareFromVersion === compareToVersion}
                >
                  Compare
                </Button>
              </CompareContainer>
              
              {renderDiffResults()}
            </div>
          )}
        </TabPane>
        
        <TabPane 
          tab={<span><BranchesOutlined /> Compatibility</span>}
          key="compatibility"
        >
          <Alert
            message="Compatibility Analysis"
            description="Analyze compatibility between different regulation versions and server configurations."
            type="info"
            showIcon
            style={{ marginBottom: '1rem' }}
          />
          
          <Card title="Compatibility Matrix" style={{ marginBottom: '1rem' }}>
            <p>Select versions to analyze for compatibility:</p>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space align="start">
                <Select
                  style={{ width: 200 }}
                  placeholder="Select version"
                  defaultValue={versions.length > 0 ? versions[0].id : undefined}
                >
                  {versions.map(version => (
                    <Option key={version.id} value={version.id}>
                      {version.id} - {version.name}
                    </Option>
                  ))}
                </Select>
                
                <div>
                  <h4>Compatible with:</h4>
                  <Space direction="vertical">
                    <div>
                      <CheckCircleOutlined style={{ color: 'green' }} /> v1.5.1 GDPR 2023 Q1 Update
                    </div>
                    <div>
                      <CheckCircleOutlined style={{ color: 'green' }} /> v1.5.0 GDPR 2022 Q4 Update
                    </div>
                    <div>
                      <CloseCircleOutlined style={{ color: 'red' }} /> v1.4.2 GDPR 2022 Q3 Hotfix
                    </div>
                  </Space>
                </div>
              </Space>
              
              <Divider />
              
              <Alert
                message="Compatibility Issues"
                description="Version v1.5.2 contains changes to Article 13 that are not backward compatible with versions prior to v1.5.0."
                type="warning"
                showIcon
              />
            </Space>
          </Card>
          
          <Card title="Regulation Change Notifications">
            <p>Configure how users are notified of regulation changes:</p>
            
            <Form layout="vertical">
              <Form.Item label="Notification Type">
                <Select defaultValue="email">
                  <Option value="email">Email Notifications</Option>
                  <Option value="system">System Notifications</Option>
                  <Option value="both">Both Email and System</Option>
                </Select>
              </Form.Item>
              
              <Form.Item label="Notification Frequency">
                <Select defaultValue="immediate">
                  <Option value="immediate">Immediate</Option>
                  <Option value="daily">Daily Digest</Option>
                  <Option value="weekly">Weekly Digest</Option>
                </Select>
              </Form.Item>
              
              <Form.Item>
                <Button type="primary">Save Notification Settings</Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
      
      {/* Tag Version Modal */}
      <Modal
        title="Add Version Tag"
        open={tagModalVisible}
        onCancel={() => setTagModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateVersionTag}
        >
          <Form.Item
            name="tagName"
            label="Tag Name"
            rules={[{ required: true, message: 'Please enter a tag name' }]}
          >
            <Input placeholder="e.g., stable, production, beta" />
          </Form.Item>
          
          <Form.Item
            name="tagDescription"
            label="Description"
          >
            <TextArea rows={3} placeholder="Optional description for this tag" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Add Tag
              </Button>
              <Button onClick={() => setTagModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </VersionContainer>
  );
};

export default VersionControl; 