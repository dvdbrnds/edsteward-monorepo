import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Select, Button, Input, Table, Tag, Space, Tooltip, DatePicker, Spin, Badge } from 'antd';
import { SearchOutlined, DownloadOutlined, ReloadOutlined, WarningOutlined, InfoCircleOutlined, BugOutlined } from '@ant-design/icons';

const { Option } = Select;
const { RangePicker } = DatePicker;

// Styled components
const LogsContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const LogsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const LogsTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const FiltersContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  align-items: center;
`;

const FilterItem = styled.div`
  min-width: 200px;
`;

const LogMessage = styled.div`
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-all;
`;

const LogContext = styled.div`
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  border-left: 3px solid #ccc;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
`;

const StatsCard = styled(Card)`
  margin-bottom: 1rem;
`;

/**
 * Server Logs Viewer Component
 * Displays and filters log entries from MCP validation servers
 */
const ServerLogsViewer = ({ serverId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [component, setComponent] = useState('all');
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  
  // Mock log stats
  const [logStats, setLogStats] = useState({
    total: 0,
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
    trace: 0
  });
  
  // Generate mock log data
  const generateMockLogs = () => {
    const components = ['api', 'validation', 'database', 'auth', 'system'];
    const messages = [
      'Server started successfully',
      'Processing validation request',
      'Database connection established',
      'Failed to validate content against regulation',
      'Authentication successful for user',
      'Warning: High memory usage detected',
      'Cached validation result expired',
      'Processing batch job complete',
      'Regulation update detected',
      'API rate limit exceeded for client'
    ];
    
    // Get a random date in the last 7 days
    const getRandomDate = () => {
      const now = new Date();
      const daysAgo = Math.floor(Math.random() * 7);
      const hoursAgo = Math.floor(Math.random() * 24);
      const minutesAgo = Math.floor(Math.random() * 60);
      const secondsAgo = Math.floor(Math.random() * 60);
      
      return new Date(
        now.getTime() 
        - (daysAgo * 24 * 60 * 60 * 1000)
        - (hoursAgo * 60 * 60 * 1000)
        - (minutesAgo * 60 * 1000)
        - (secondsAgo * 1000)
      );
    };
    
    // Generate random logs
    const logs = [];
    const totalCount = 200;
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let debugCount = 0;
    let traceCount = 0;
    
    for (let i = 0; i < totalCount; i++) {
      // Determine log level with weighted probability
      const levelRand = Math.random();
      let level;
      
      if (levelRand < 0.05) {
        level = 'error';
        errorCount++;
      } else if (levelRand < 0.15) {
        level = 'warn';
        warnCount++;
      } else if (levelRand < 0.55) {
        level = 'info';
        infoCount++;
      } else if (levelRand < 0.85) {
        level = 'debug';
        debugCount++;
      } else {
        level = 'trace';
        traceCount++;
      }
      
      // Determine if this log has additional context
      const hasContext = Math.random() < 0.3;
      const contextData = hasContext ? {
        request: { id: `req-${Math.floor(Math.random() * 10000)}`, method: 'POST', path: '/api/validate' },
        response: { status: level === 'error' ? 500 : 200, time: `${Math.floor(Math.random() * 300)}ms` },
        additional: { validationId: `val-${Math.floor(Math.random() * 10000)}` }
      } : null;
      
      logs.push({
        id: `log-${i}`,
        timestamp: getRandomDate(),
        level,
        component: components[Math.floor(Math.random() * components.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        context: contextData ? JSON.stringify(contextData, null, 2) : null
      });
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);
    
    setLogStats({
      total: totalCount,
      error: errorCount,
      warn: warnCount,
      info: infoCount,
      debug: debugCount,
      trace: traceCount
    });
    
    return logs;
  };
  
  // Load logs (simulated)
  const loadLogs = () => {
    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const mockLogs = generateMockLogs();
      setLogs(mockLogs);
      setLoading(false);
    }, 800);
  };
  
  // Initial load
  useEffect(() => {
    loadLogs();
  }, []);
  
  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
  };
  
  // Handle log level filter
  const handleLogLevelChange = (value) => {
    setLogLevel(value);
  };
  
  // Handle component filter
  const handleComponentChange = (value) => {
    setComponent(value);
  };
  
  // Handle date range change
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    loadLogs();
  };
  
  // Handle row expansion
  const handleExpandRow = (expanded, record) => {
    setExpandedRowKeys(expanded ? [record.id] : []);
  };
  
  // Apply filters to logs
  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Apply level filter
      if (logLevel !== 'all' && log.level !== logLevel) {
        return false;
      }
      
      // Apply component filter
      if (component !== 'all' && log.component !== component) {
        return false;
      }
      
      // Apply date range filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const logDate = new Date(log.timestamp);
        if (logDate < dateRange[0] || logDate > dateRange[1]) {
          return false;
        }
      }
      
      // Apply search text
      if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };
  
  // Download logs as JSON
  const handleDownloadLogs = () => {
    const filteredLogs = getFilteredLogs();
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Render log level tag
  const renderLogLevelTag = (level) => {
    const colors = {
      error: 'error',
      warn: 'warning',
      info: 'processing',
      debug: 'default',
      trace: 'default'
    };
    
    const icons = {
      error: <WarningOutlined />,
      warn: <WarningOutlined />,
      info: <InfoCircleOutlined />,
      debug: <BugOutlined />,
      trace: null
    };
    
    return (
      <Tag color={colors[level]} icon={icons[level]}>
        {level.toUpperCase()}
      </Tag>
    );
  };
  
  // Table columns
  const columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => new Date(timestamp).toLocaleString()
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 120,
      render: (level) => renderLogLevelTag(level)
    },
    {
      title: 'Component',
      dataIndex: 'component',
      key: 'component',
      width: 150,
      render: (component) => <Tag>{component}</Tag>
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (message, record) => (
        <LogMessage>
          {message}
          {record.context && <Badge status="processing" style={{ marginLeft: 8 }} />}
        </LogMessage>
      )
    }
  ];
  
  // Expandable row configuration
  const expandableConfig = {
    expandedRowKeys,
    onExpand: handleExpandRow,
    expandedRowRender: (record) => (
      <LogContext>
        <strong>Context Data:</strong>
        <pre>{record.context}</pre>
      </LogContext>
    ),
    rowExpandable: (record) => record.context !== null
  };
  
  // Get unique components for filter
  const getUniqueComponents = () => {
    const components = new Set();
    logs.forEach(log => components.add(log.component));
    return Array.from(components);
  };
  
  // Get filtered logs
  const filteredLogs = getFilteredLogs();
  
  return (
    <LogsContainer>
      <LogsHeader>
        <LogsTitle>Server Logs</LogsTitle>
        <Space>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleDownloadLogs}
            disabled={filteredLogs.length === 0}
          >
            Export Logs
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </LogsHeader>
      
      <StatsCard size="small">
        <Space size="large">
          <Tooltip title="Total Logs">
            <Badge count={logStats.total} showZero overflowCount={9999} style={{ backgroundColor: '#1890ff' }} />
          </Tooltip>
          <Tooltip title="Errors">
            <Badge count={logStats.error} showZero style={{ backgroundColor: '#f5222d' }} />
          </Tooltip>
          <Tooltip title="Warnings">
            <Badge count={logStats.warn} showZero style={{ backgroundColor: '#faad14' }} />
          </Tooltip>
          <Tooltip title="Info">
            <Badge count={logStats.info} showZero style={{ backgroundColor: '#52c41a' }} />
          </Tooltip>
          <Tooltip title="Debug">
            <Badge count={logStats.debug} showZero style={{ backgroundColor: '#8c8c8c' }} />
          </Tooltip>
          <Tooltip title="Trace">
            <Badge count={logStats.trace} showZero style={{ backgroundColor: '#d9d9d9', color: '#666' }} />
          </Tooltip>
        </Space>
      </StatsCard>
      
      <FiltersContainer>
        <FilterItem>
          <Input
            placeholder="Search logs..."
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
            prefix={<SearchOutlined />}
          />
        </FilterItem>
        
        <FilterItem>
          <Select
            style={{ width: '100%' }}
            placeholder="Log Level"
            value={logLevel}
            onChange={handleLogLevelChange}
          >
            <Option value="all">All Levels</Option>
            <Option value="error">Error</Option>
            <Option value="warn">Warning</Option>
            <Option value="info">Info</Option>
            <Option value="debug">Debug</Option>
            <Option value="trace">Trace</Option>
          </Select>
        </FilterItem>
        
        <FilterItem>
          <Select
            style={{ width: '100%' }}
            placeholder="Component"
            value={component}
            onChange={handleComponentChange}
          >
            <Option value="all">All Components</Option>
            {getUniqueComponents().map(comp => (
              <Option key={comp} value={comp}>{comp}</Option>
            ))}
          </Select>
        </FilterItem>
        
        <FilterItem>
          <RangePicker
            onChange={handleDateRangeChange}
            showTime
            format="YYYY-MM-DD HH:mm"
          />
        </FilterItem>
      </FiltersContainer>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          expandable={expandableConfig}
          pagination={{ pageSize: 20 }}
          size="middle"
          locale={{ emptyText: 'No logs match the current filters' }}
        />
      )}
    </LogsContainer>
  );
};

export default ServerLogsViewer; 