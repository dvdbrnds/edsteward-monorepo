import React, { useState } from 'react';
import styled from 'styled-components';
import { Select, Button, Tabs, Input, Space, Spin, Collapse, Alert, Tag, Divider } from 'antd';
import { SendOutlined, CopyOutlined, DownloadOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactJson from '@uiw/react-json-view';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Panel } = Collapse;

// Styled components
const ConsoleContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const ConsoleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ConsoleTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const RequestArea = styled.div`
  margin-bottom: 1rem;
`;

const ResponseArea = styled.div`
  margin-top: 1.5rem;
`;

const LogEntry = styled.div`
  font-family: monospace;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-all;
  
  &:last-child {
    border-bottom: none;
  }
  
  ${props => props.level === 'error' && `
    color: ${props.theme.colors.error};
  `}
  
  ${props => props.level === 'warn' && `
    color: ${props.theme.colors.warning};
  `}
  
  ${props => props.level === 'info' && `
    color: ${props.theme.colors.info};
  `}
  
  ${props => props.level === 'debug' && `
    color: ${props.theme.colors.textSecondary};
  `}
`;

const MetricCard = styled.div`
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
`;

const MetricTitle = styled.div`
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const MetricValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
`;

const TemplateButton = styled(Button)`
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
`;

const ValidationTag = styled(Tag)`
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
`;

/**
 * MCP Test Console Component
 * Provides an interface for testing MCP validation servers
 */
const MCPTestConsole = ({ serverId }) => {
  const [selectedServer, setSelectedServer] = useState('gdpr-server-1');
  const [requestBody, setRequestBody] = useState('{\n  "method": "validate",\n  "params": {\n    "text": "Your test content here",\n    "context": "Additional context information"\n  }\n}');
  const [activeTab, setActiveTab] = useState('response');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  
  // Mock servers
  const servers = [
    { id: 'gdpr-server-1', name: 'GDPR Validation Server' },
    { id: 'hipaa-server-1', name: 'HIPAA Compliance Server' },
    { id: 'ccpa-server-1', name: 'CCPA Validation Service' },
    { id: 'pci-dss-server-1', name: 'PCI DSS Validator' }
  ];
  
  // Request templates
  const requestTemplates = [
    {
      name: 'Basic Validation',
      body: '{\n  "method": "validate",\n  "params": {\n    "text": "Your test content here",\n    "context": "Additional context information"\n  }\n}'
    },
    {
      name: 'Pattern Matching',
      body: '{\n  "method": "validate",\n  "params": {\n    "tool": "pattern-matcher",\n    "input": {\n      "content": "Sample text to validate",\n      "patterns": ["pattern1", "pattern2"]\n    }\n  }\n}'
    },
    {
      name: 'Entity Extraction',
      body: '{\n  "method": "validate",\n  "params": {\n    "tool": "entity-extractor",\n    "input": {\n      "text": "John Doe lives at 123 Main St and works at ACME Corp.",\n      "entityTypes": ["PERSON", "ADDRESS", "ORGANIZATION"]\n    }\n  }\n}'
    }
  ];
  
  // Mock logs
  const logs = [
    { timestamp: '2023-11-17T10:15:22Z', level: 'info', message: 'Received validation request' },
    { timestamp: '2023-11-17T10:15:22Z', level: 'debug', message: 'Processing request with tools: text-validator' },
    { timestamp: '2023-11-17T10:15:23Z', level: 'info', message: 'Text validation complete' },
    { timestamp: '2023-11-17T10:15:23Z', level: 'warn', message: 'Potential sensitive data detected: email addresses' },
    { timestamp: '2023-11-17T10:15:23Z', level: 'info', message: 'Validation response sent' }
  ];
  
  // Handle server selection
  const handleServerChange = (value) => {
    setSelectedServer(value);
    setTestResults(null);
  };
  
  // Apply request template
  const applyTemplate = (template) => {
    setRequestBody(template.body);
  };
  
  // Handle test execution
  const runTest = () => {
    setLoading(true);
    setTestResults(null);
    
    // Simulate API call delay
    setTimeout(() => {
      try {
        const requestJson = JSON.parse(requestBody);
        
        // Mock response based on request
        let mockResponse = {
          id: `request-${Date.now()}`,
          result: {
            valid: Math.random() > 0.3, // 70% chance of being valid
            certainty: Math.floor(Math.random() * 30) + 70, // 70-99% certainty
            findings: [
              {
                type: 'POTENTIAL_PII',
                description: 'Potential personally identifiable information detected',
                location: { start: 10, end: 25 },
                severity: 'WARNING'
              }
            ],
            regulations: [
              { id: 'GDPR-A13', name: 'Article 13 - Information to be provided', compliance: 'PARTIAL' },
              { id: 'GDPR-A5-1C', name: 'Article 5(1)(c) - Data minimization', compliance: 'COMPLIANT' }
            ]
          }
        };
        
        setTestResults({
          request: requestJson,
          response: mockResponse,
          executionTime: Math.floor(Math.random() * 500) + 100, // 100-599ms
          timestamp: new Date().toISOString()
        });
        
        setActiveTab('response');
      } catch (error) {
        setTestResults({
          error: true,
          message: `Error parsing request JSON: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
      
      setLoading(false);
    }, 800);
  };
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Render test results
  const renderTestResults = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spin size="large" />
          <div style={{ marginTop: '1rem' }}>Running validation test...</div>
        </div>
      );
    }
    
    if (!testResults) {
      return (
        <Alert
          message="No Test Results"
          description="Run a validation test to see results here."
          type="info"
          showIcon
        />
      );
    }
    
    if (testResults.error) {
      return (
        <Alert
          message="Test Error"
          description={testResults.message}
          type="error"
          showIcon
        />
      );
    }
    
    const selectedServerObj = servers.find(s => s.id === selectedServer);
    
    return (
      <div>
        <Alert
          message={testResults.response.result.valid ? "Validation Passed" : "Validation Failed"}
          description={`The content was ${testResults.response.result.valid ? "validated successfully" : "not valid"} against the regulations with ${testResults.response.result.certainty}% certainty.`}
          type={testResults.response.result.valid ? "success" : "error"}
          showIcon
          style={{ marginBottom: '1rem' }}
        />
        
        <Space style={{ marginBottom: '1rem' }}>
          <span><strong>Server:</strong> {selectedServerObj?.name}</span>
          <span><strong>Time:</strong> {formatDate(testResults.timestamp)}</span>
          <span><strong>Execution:</strong> {testResults.executionTime}ms</span>
        </Space>
        
        <Divider />
        
        <h4>Regulation Compliance</h4>
        <div style={{ marginBottom: '1rem' }}>
          {testResults.response.result.regulations.map((reg, index) => (
            <ValidationTag 
              key={index} 
              color={
                reg.compliance === 'COMPLIANT' ? 'success' : 
                reg.compliance === 'NON_COMPLIANT' ? 'error' : 
                'warning'
              }
            >
              {reg.name}: {reg.compliance}
            </ValidationTag>
          ))}
        </div>
        
        <h4>Findings</h4>
        <Collapse>
          {testResults.response.result.findings.map((finding, index) => (
            <Panel 
              header={`${finding.type}: ${finding.description}`} 
              key={index}
              extra={
                <Tag color={
                  finding.severity === 'ERROR' ? 'error' : 
                  finding.severity === 'WARNING' ? 'warning' : 
                  'default'
                }>
                  {finding.severity}
                </Tag>
              }
            >
              <p><strong>Location:</strong> Characters {finding.location.start}-{finding.location.end}</p>
              <p><strong>Severity:</strong> {finding.severity}</p>
            </Panel>
          ))}
        </Collapse>
      </div>
    );
  };
  
  return (
    <ConsoleContainer>
      <ConsoleHeader>
        <ConsoleTitle>MCP Validation Test Console</ConsoleTitle>
        <div>
          <Button icon={<ReloadOutlined />} onClick={() => setTestResults(null)}>
            Reset
          </Button>
        </div>
      </ConsoleHeader>
      
      <RequestArea>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label style={{ marginRight: '1rem' }}>Select Server:</label>
            <Select 
              value={selectedServer}
              onChange={handleServerChange}
              style={{ width: 300 }}
            >
              {servers.map(server => (
                <Option key={server.id} value={server.id}>{server.name}</Option>
              ))}
            </Select>
          </div>
          
          <div>
            <label>Request Templates:</label>
            <div style={{ marginTop: '0.5rem' }}>
              {requestTemplates.map((template, index) => (
                <TemplateButton 
                  key={index}
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
                </TemplateButton>
              ))}
            </div>
          </div>
          
          <div>
            <label>Request Body (JSON):</label>
            <TextArea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              rows={10}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          
          <Button 
            type="primary" 
            icon={<SendOutlined />} 
            onClick={runTest}
            loading={loading}
          >
            Run Validation Test
          </Button>
        </Space>
      </RequestArea>
      
      <ResponseArea>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Test Results" key="response">
            {renderTestResults()}
          </TabPane>
          
          <TabPane tab="Raw Response" key="raw">
            {testResults && !testResults.error ? (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <Button 
                    icon={<CopyOutlined />} 
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(testResults.response, null, 2))}
                  >
                    Copy JSON
                  </Button>
                </div>
                <ReactJson src={testResults.response} collapsed={1} />
              </div>
            ) : (
              <Alert
                message="No Response Data"
                description="Run a validation test to see the raw response here."
                type="info"
                showIcon
              />
            )}
          </TabPane>
          
          <TabPane tab="Execution Logs" key="logs">
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
              {logs.map((log, index) => (
                <LogEntry key={index} level={log.level}>
                  [{new Date(log.timestamp).toLocaleTimeString()}] [{log.level.toUpperCase()}] {log.message}
                </LogEntry>
              ))}
            </div>
          </TabPane>
          
          <TabPane tab="Performance" key="performance">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              <MetricCard>
                <MetricTitle>Response Time</MetricTitle>
                <MetricValue>{testResults ? testResults.executionTime : '-'} ms</MetricValue>
              </MetricCard>
              
              <MetricCard>
                <MetricTitle>Validation Certainty</MetricTitle>
                <MetricValue>{testResults && !testResults.error ? `${testResults.response.result.certainty}%` : '-'}</MetricValue>
              </MetricCard>
              
              <MetricCard>
                <MetricTitle>Regulations Checked</MetricTitle>
                <MetricValue>{testResults && !testResults.error ? testResults.response.result.regulations.length : '-'}</MetricValue>
              </MetricCard>
              
              <MetricCard>
                <MetricTitle>Findings</MetricTitle>
                <MetricValue>{testResults && !testResults.error ? testResults.response.result.findings.length : '-'}</MetricValue>
              </MetricCard>
            </div>
            
            <Alert
              message="Performance Monitoring"
              description="These metrics are for the current test execution only. View the Performance tab in the main navigation for detailed server performance metrics over time."
              type="info"
              showIcon
              style={{ marginTop: '1rem' }}
            />
          </TabPane>
        </Tabs>
      </ResponseArea>
    </ConsoleContainer>
  );
};

export default MCPTestConsole; 