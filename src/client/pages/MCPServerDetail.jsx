import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { 
  Card, 
  Button, 
  Typography, 
  Space, 
  Divider, 
  Tag, 
  Table, 
  Row, 
  Col, 
  Alert,
  Spin,
  message
} from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  RollbackOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  ToolOutlined
} from '@ant-design/icons';
import MCPApiClient from '../services/MCPApiClient';

const { Title, Text } = Typography;

const DetailCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

const ServerTitle = styled(Title)`
  margin-bottom: 8px !important;
`;

const StatusTag = styled(Tag)`
  font-size: 14px;
  padding: 2px 8px;
  border-radius: 4px;
`;

const ServerInfoTable = styled(Table)`
  .ant-table-thead > tr > th {
    background-color: #f0f2f5;
  }
  margin-top: 16px;
`;

const ActionButton = styled(Button)`
  min-width: 120px;
`;

const InspectorOutput = styled.pre`
  background-color: #f0f2f5;
  border-radius: 4px;
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  margin-top: 16px;
  white-space: pre-wrap;
  word-break: break-all;
`;

const MCPServerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inspectorState, setInspectorState] = useState({
    isLaunching: false,
    isRunning: false,
    processId: null,
    output: '',
    error: null
  });
  const outputPollingRef = useRef(null);

  const loadServerDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await MCPApiClient.getServerById(id);
      
      if (response.success) {
        setServer(response.server);
      } else {
        setError(response.error || 'Failed to load server details');
      }
    } catch (err) {
      setError('An unexpected error occurred while loading server details');
      console.error('Error loading server details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServerDetails();
    
    // Clean up any active polling when component unmounts
    return () => {
      if (outputPollingRef.current) {
        clearInterval(outputPollingRef.current);
      }
    };
  }, [id]);

  const handleStartServer = async () => {
    try {
      message.loading({ content: 'Starting server...', key: 'serverAction' });
      const response = await MCPApiClient.startServer(id);
      
      if (response.success) {
        message.success({ content: 'Server started successfully', key: 'serverAction' });
        setServer(prev => ({ ...prev, status: 'online' }));
      } else {
        message.error({ content: response.error || 'Failed to start server', key: 'serverAction' });
      }
    } catch (err) {
      message.error({ content: 'An error occurred while starting the server', key: 'serverAction' });
      console.error('Error starting server:', err);
    }
  };

  const handleStopServer = async () => {
    try {
      message.loading({ content: 'Stopping server...', key: 'serverAction' });
      const response = await MCPApiClient.stopServer(id);
      
      if (response.success) {
        message.success({ content: 'Server stopped successfully', key: 'serverAction' });
        setServer(prev => ({ ...prev, status: 'offline' }));
      } else {
        message.error({ content: response.error || 'Failed to stop server', key: 'serverAction' });
      }
    } catch (err) {
      message.error({ content: 'An error occurred while stopping the server', key: 'serverAction' });
      console.error('Error stopping server:', err);
    }
  };

  const startPollingOutput = async (processId) => {
    // Clear any existing polling interval
    if (outputPollingRef.current) {
      clearInterval(outputPollingRef.current);
    }

    // Set up polling for inspector output
    outputPollingRef.current = setInterval(async () => {
      try {
        // Get the current status
        const statusResponse = await MCPApiClient.getInspectorStatus(processId);
        
        if (!statusResponse.success) {
          clearInterval(outputPollingRef.current);
          setInspectorState(prev => ({
            ...prev,
            isRunning: false,
            error: statusResponse.error || 'Inspector is no longer running'
          }));
          return;
        }

        // If it's still running, get the latest output
        if (statusResponse.isRunning) {
          const outputResponse = await MCPApiClient.getInspectorOutput(processId);
          if (outputResponse.success) {
            setInspectorState(prev => ({
              ...prev,
              output: outputResponse.output
            }));
          }
        } else {
          // If it's not running anymore, stop polling
          clearInterval(outputPollingRef.current);
          setInspectorState(prev => ({
            ...prev,
            isRunning: false
          }));
        }
      } catch (error) {
        console.error('Error polling inspector output:', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleLaunchInspector = async () => {
    if (!server) return;
    
    setInspectorState(prev => ({
      ...prev,
      isLaunching: true,
      error: null,
      output: 'Launching MCP Inspector...\n'
    }));

    try {
      const response = await MCPApiClient.launchInspector(server.id, server.port, server.type);
      
      if (response.success) {
        const processId = response.processId;
        
        setInspectorState(prev => ({
          ...prev,
          isLaunching: false,
          isRunning: true,
          processId,
          output: prev.output + `MCP Inspector launched successfully!\nProcess ID: ${processId}\nInspector URL: ${response.inspectorUrl}\n`
        }));
        
        // Open the Inspector URL in a new tab
        window.open(response.inspectorUrl, '_blank');
        
        // Start polling for output
        startPollingOutput(processId);
        
      } else {
        setInspectorState(prev => ({
          ...prev,
          isLaunching: false,
          error: response.error || 'Failed to launch MCP Inspector',
          output: prev.output + `Error launching inspector: ${response.error}\n`
        }));
        
        // Even with an error, try to provide a fallback URL if one is returned
        if (response.inspectorUrl) {
          window.open(response.inspectorUrl, '_blank');
        }
      }
    } catch (err) {
      console.error('Error launching inspector:', err);
      setInspectorState(prev => ({
        ...prev,
        isLaunching: false,
        error: 'An unexpected error occurred while launching the inspector',
        output: prev.output + `Unexpected error: ${err.message}\n`
      }));
    }
  };

  const handleTerminateInspector = async () => {
    const { processId } = inspectorState;
    if (!processId) return;
    
    try {
      const response = await MCPApiClient.terminateInspector(processId);
      
      if (response.success) {
        // Stop polling for output
        if (outputPollingRef.current) {
          clearInterval(outputPollingRef.current);
        }
        
        setInspectorState(prev => ({
          ...prev,
          isRunning: false,
          output: prev.output + `\nMCP Inspector terminated successfully.\n`
        }));
        
        message.success('MCP Inspector terminated successfully');
      } else {
        setInspectorState(prev => ({
          ...prev,
          error: response.error || 'Failed to terminate MCP Inspector'
        }));
      }
    } catch (err) {
      console.error('Error terminating inspector:', err);
      setInspectorState(prev => ({
        ...prev,
        error: 'An unexpected error occurred while terminating the inspector'
      }));
    }
  };

  const serverInfoColumns = [
    {
      title: 'Property',
      dataIndex: 'property',
      key: 'property',
      width: '30%',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>Loading server details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="Error Loading Server Details"
          description={error}
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  if (!server) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="Server Not Found"
          description={`No server found with ID: ${id}`}
          type="warning"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  const serverData = [
    {
      key: '1',
      property: 'Server ID',
      value: server.id,
    },
    {
      key: '2',
      property: 'Type',
      value: server.type === 'core' ? 'Core Server' : 'Regulation Server',
    },
    {
      key: '3',
      property: 'Category',
      value: server.category,
    },
    {
      key: '4',
      property: 'Port',
      value: server.port,
    },
    {
      key: '5',
      property: 'Uptime',
      value: server.status === 'online' ? server.uptime : 'Not running',
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Button 
        type="default" 
        icon={<RollbackOutlined />} 
        onClick={() => navigate('/dashboard')}
        style={{ marginBottom: '20px' }}
      >
        Back to Dashboard
      </Button>
      
      <DetailCard>
        <Row justify="space-between" align="middle">
          <Col>
            <ServerTitle level={3}>
              {server.name}
            </ServerTitle>
            <Space>
              <StatusTag 
                color={server.status === 'online' ? 'green' : 'red'}
              >
                {server.status === 'online' ? 'ONLINE' : 'OFFLINE'}
              </StatusTag>
              <Text type="secondary">ID: {server.id}</Text>
            </Space>
          </Col>
          <Col>
            <Space>
              {server.status === 'online' ? (
                <ActionButton 
                  type="default" 
                  danger
                  icon={<PauseCircleOutlined />} 
                  onClick={handleStopServer}
                >
                  Stop Server
                </ActionButton>
              ) : (
                <ActionButton 
                  type="primary" 
                  icon={<PlayCircleOutlined />} 
                  onClick={handleStartServer}
                >
                  Start Server
                </ActionButton>
              )}
            </Space>
          </Col>
        </Row>
        
        <Divider />
        
        <ServerInfoTable 
          columns={serverInfoColumns} 
          dataSource={serverData} 
          pagination={false}
          size="middle"
        />
      </DetailCard>
      
      <DetailCard title="MCP Inspector" extra={<InfoCircleOutlined />}>
        <Text>
          The MCP Inspector provides real-time insights into the server's operation, 
          allowing you to monitor its execution, view logs, and analyze decision-making.
        </Text>
        
        <Divider />
        
        <Row justify="space-between" align="middle">
          <Col>
            <Space direction="vertical">
              <Text strong>Current Status:</Text>
              <StatusTag color={inspectorState.isRunning ? 'green' : 'blue'}>
                {inspectorState.isLaunching ? 'LAUNCHING' : inspectorState.isRunning ? 'RUNNING' : 'READY'}
              </StatusTag>
            </Space>
          </Col>
          <Col>
            <Space>
              {inspectorState.isRunning ? (
                <ActionButton 
                  type="default" 
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={handleTerminateInspector}
                >
                  Terminate Inspector
                </ActionButton>
              ) : (
                <ActionButton 
                  type="primary" 
                  icon={<ToolOutlined />}
                  onClick={handleLaunchInspector}
                  loading={inspectorState.isLaunching}
                  disabled={server.status !== 'online'}
                >
                  Launch MCP Inspector
                </ActionButton>
              )}
              
              {server.status !== 'online' && (
                <Text type="warning">Server must be online to launch Inspector</Text>
              )}
            </Space>
          </Col>
        </Row>
        
        {(inspectorState.output || inspectorState.error) && (
          <>
            <Divider />
            {inspectorState.error && (
              <Alert 
                message="Inspector Error" 
                description={inspectorState.error}
                type="error" 
                showIcon 
                style={{ marginBottom: '16px' }}
              />
            )}
            {inspectorState.output && (
              <>
                <Text strong>Inspector Output:</Text>
                <InspectorOutput>{inspectorState.output}</InspectorOutput>
              </>
            )}
          </>
        )}
      </DetailCard>
    </div>
  );
};

export default MCPServerDetail; 