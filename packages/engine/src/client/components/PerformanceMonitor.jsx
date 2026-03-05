import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card, Tabs, Select, Button, Table, Alert, Switch, Form, InputNumber, Progress, Statistic, Space, Badge, Divider, DatePicker, Spin } from 'antd';
import { ReloadOutlined, WarningOutlined, CheckCircleOutlined, LineChartOutlined, PieChartOutlined, AreaChartOutlined } from '@ant-design/icons';
import { Line, Pie, Area } from '@ant-design/plots';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Styled components
const MonitorContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const MonitorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const MonitorTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const MetricCard = styled(Card)`
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const ChartContainer = styled.div`
  width: 100%;
  height: 350px;
  margin-bottom: 1.5rem;
`;

const ServerHealthContainer = styled.div`
  margin-bottom: 1.5rem;
`;

const AlertItem = styled.div`
  padding: 12px;
  border-radius: 6px;
  border: 1px solid ${props => props.severity === 'critical' ? '#ff4d4f' : props.severity === 'warning' ? '#faad14' : '#52c41a'};
  background-color: ${props => props.severity === 'critical' ? '#fff2f0' : props.severity === 'warning' ? '#fffbe6' : '#f6ffed'};
  margin-bottom: 8px;
`;

/**
 * Performance Monitor Component
 * Provides real-time and historical performance metrics for MCP servers
 */
const PerformanceMonitor = ({ serverId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedServer, setSelectedServer] = useState('gdpr-server-1');
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  
  // Mock servers
  const servers = [
    { id: 'gdpr-server-1', name: 'GDPR Validation Server', status: 'active' },
    { id: 'hipaa-server-1', name: 'HIPAA Compliance Server', status: 'active' },
    { id: 'ccpa-server-1', name: 'CCPA Validation Service', status: 'warning' },
    { id: 'pci-dss-server-1', name: 'PCI DSS Validator', status: 'inactive' }
  ];
  
  // Mock metrics data
  const [metricsData, setMetricsData] = useState({
    cpu: 28,
    memory: 42,
    uptime: '5d 12h 43m',
    requestsPerMinute: 24,
    averageResponseTime: 135,
    errorRate: 0.5,
    validationRate: 93,
    queueSize: 3,
  });
  
  // Mock time series data for charts
  const [timeSeriesData, setTimeSeriesData] = useState({
    responseTime: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      value: Math.floor(Math.random() * 200) + 80
    })),
    requestVolume: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      value: Math.floor(Math.random() * 50) + 10
    })),
    resourceUsage: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      cpu: Math.floor(Math.random() * 50) + 10,
      memory: Math.floor(Math.random() * 60) + 20
    })),
    validationResults: [
      { type: 'Valid', value: 75 },
      { type: 'Invalid', value: 15 },
      { type: 'Uncertain', value: 10 }
    ]
  });
  
  // Mock alerts data
  const [alerts, setAlerts] = useState([
    {
      id: 'alert-1',
      severity: 'warning',
      message: 'High memory usage (>80%) detected',
      timestamp: '2023-11-17T10:15:22Z',
      acknowledged: false
    },
    {
      id: 'alert-2',
      severity: 'info',
      message: 'Server restarted successfully',
      timestamp: '2023-11-17T08:30:15Z',
      acknowledged: true
    },
    {
      id: 'alert-3',
      severity: 'critical',
      message: 'API response time exceeded threshold (>500ms)',
      timestamp: '2023-11-16T22:45:10Z',
      acknowledged: false
    }
  ]);
  
  // Alert threshold settings
  const [alertSettings, setAlertSettings] = useState({
    cpuThreshold: 85,
    memoryThreshold: 80,
    responseTimeThreshold: 500,
    errorRateThreshold: 5,
    enabled: true
  });
  
  // Handle server selection
  const handleServerChange = (value) => {
    setSelectedServer(value);
    loadServerData(value);
  };
  
  // Handle time range selection
  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
    loadServerData(selectedServer, value);
  };
  
  // Load server data (simulated)
  const loadServerData = (serverId, range = timeRange) => {
    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      // Generate new random data
      setMetricsData({
        cpu: Math.floor(Math.random() * 60) + 10,
        memory: Math.floor(Math.random() * 50) + 30,
        uptime: '5d 12h 43m',
        requestsPerMinute: Math.floor(Math.random() * 40) + 10,
        averageResponseTime: Math.floor(Math.random() * 200) + 80,
        errorRate: (Math.random() * 2).toFixed(1),
        validationRate: Math.floor(Math.random() * 10) + 90,
        queueSize: Math.floor(Math.random() * 5),
      });
      
      // Update time series based on selected range
      const dataPoints = range === '24h' ? 24 : range === '7d' ? 7 : 30;
      const timeUnit = range === '24h' ? 'hour' : 'day';
      
      setTimeSeriesData({
        responseTime: Array.from({ length: dataPoints }, (_, i) => ({
          time: range === '24h' ? `${i}:00` : `Day ${i+1}`,
          value: Math.floor(Math.random() * 200) + 80
        })),
        requestVolume: Array.from({ length: dataPoints }, (_, i) => ({
          time: range === '24h' ? `${i}:00` : `Day ${i+1}`,
          value: Math.floor(Math.random() * 50) + 10
        })),
        resourceUsage: Array.from({ length: dataPoints }, (_, i) => ({
          time: range === '24h' ? `${i}:00` : `Day ${i+1}`,
          cpu: Math.floor(Math.random() * 50) + 10,
          memory: Math.floor(Math.random() * 60) + 20
        })),
        validationResults: [
          { type: 'Valid', value: Math.floor(Math.random() * 15) + 70 },
          { type: 'Invalid', value: Math.floor(Math.random() * 10) + 10 },
          { type: 'Uncertain', value: Math.floor(Math.random() * 10) + 5 }
        ]
      });
      
      setLoading(false);
    }, 800);
  };
  
  // Handle alert acknowledgment
  const acknowledgeAlert = (alertId) => {
    setAlerts(
      alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true } 
          : alert
      )
    );
  };
  
  // Handle alert settings update
  const updateAlertSettings = (values) => {
    setAlertSettings({
      ...alertSettings,
      ...values
    });
  };
  
  // Initialize with data
  useEffect(() => {
    loadServerData(selectedServer);
  }, []);
  
  // Render server status badge
  const renderStatusBadge = (status) => {
    switch(status) {
      case 'active':
        return <Badge status="success" text="Active" />;
      case 'warning':
        return <Badge status="warning" text="Warning" />;
      case 'inactive':
        return <Badge status="error" text="Inactive" />;
      default:
        return <Badge status="default" text="Unknown" />;
    }
  };
  
  // Config for response time chart
  const responseTimeConfig = {
    data: timeSeriesData.responseTime,
    xField: 'time',
    yField: 'value',
    height: 300,
    point: {
      size: 5,
      shape: 'diamond',
    },
    tooltip: {
      formatter: (datum) => {
        return { name: 'Response Time', value: `${datum.value} ms` };
      },
    },
  };
  
  // Config for request volume chart
  const requestVolumeConfig = {
    data: timeSeriesData.requestVolume,
    xField: 'time',
    yField: 'value',
    height: 300,
    areaStyle: {
      fill: 'l(270) 0:#ffffff 1:#1890ff',
    },
    tooltip: {
      formatter: (datum) => {
        return { name: 'Requests', value: datum.value };
      },
    },
  };
  
  // Config for resource usage chart
  const resourceUsageConfig = {
    data: timeSeriesData.resourceUsage,
    xField: 'time',
    yField: ['cpu', 'memory'],
    height: 300,
    seriesField: 'type',
    meta: {
      cpu: { alias: 'CPU Usage (%)' },
      memory: { alias: 'Memory Usage (%)' }
    },
    tooltip: {
      formatter: (datum) => {
        return { name: datum.type === 'cpu' ? 'CPU' : 'Memory', value: `${datum[datum.type]}%` };
      },
    },
  };
  
  // Config for validation results chart
  const validationResultsConfig = {
    data: timeSeriesData.validationResults,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    height: 300,
    label: {
      type: 'outer',
      formatter: '{name} {percentage}',
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
  };
  
  // Alert table columns
  const alertColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => {
        const colors = {
          critical: 'red',
          warning: 'orange',
          info: 'blue'
        };
        return <Tag color={colors[severity]}>{severity.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message'
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => new Date(timestamp).toLocaleString()
    },
    {
      title: 'Status',
      dataIndex: 'acknowledged',
      key: 'acknowledged',
      render: (acknowledged) => acknowledged ? 
        <Tag color="green">Acknowledged</Tag> : 
        <Tag color="volcano">Unacknowledged</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => !record.acknowledged && (
        <Button 
          size="small" 
          onClick={() => acknowledgeAlert(record.id)}
        >
          Acknowledge
        </Button>
      )
    }
  ];
  
  return (
    <MonitorContainer>
      <MonitorHeader>
        <MonitorTitle>MCP Server Performance Monitoring</MonitorTitle>
        <Space>
          <Select 
            value={selectedServer}
            onChange={handleServerChange}
            style={{ width: 240 }}
          >
            {servers.map(server => (
              <Option key={server.id} value={server.id}>
                <Space>
                  {server.name}
                  {renderStatusBadge(server.status)}
                </Space>
              </Option>
            ))}
          </Select>
          
          <Select 
            value={timeRange}
            onChange={handleTimeRangeChange}
            style={{ width: 120 }}
          >
            <Option value="24h">Last 24h</Option>
            <Option value="7d">Last 7 days</Option>
            <Option value="30d">Last 30 days</Option>
          </Select>
          
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => loadServerData(selectedServer)}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </MonitorHeader>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Overview" key="overview">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              <MetricsGrid>
                <MetricCard>
                  <Statistic 
                    title="CPU Usage" 
                    value={metricsData.cpu} 
                    suffix="%" 
                    valueStyle={{ color: metricsData.cpu > 80 ? '#cf1322' : metricsData.cpu > 60 ? '#faad14' : '#3f8600' }}
                  />
                  <Progress 
                    percent={metricsData.cpu} 
                    status={metricsData.cpu > 80 ? 'exception' : 'normal'} 
                    showInfo={false}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Memory Usage" 
                    value={metricsData.memory} 
                    suffix="%" 
                    valueStyle={{ color: metricsData.memory > 80 ? '#cf1322' : metricsData.memory > 60 ? '#faad14' : '#3f8600' }}
                  />
                  <Progress 
                    percent={metricsData.memory} 
                    status={metricsData.memory > 80 ? 'exception' : 'normal'} 
                    showInfo={false}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Uptime" 
                    value={metricsData.uptime}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Requests Per Minute" 
                    value={metricsData.requestsPerMinute}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Avg. Response Time" 
                    value={metricsData.averageResponseTime}
                    suffix="ms"
                    valueStyle={{ color: metricsData.averageResponseTime > 200 ? '#cf1322' : '#3f8600' }}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Error Rate" 
                    value={metricsData.errorRate}
                    suffix="%"
                    valueStyle={{ color: metricsData.errorRate > 1 ? '#cf1322' : '#3f8600' }}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Validation Success Rate" 
                    value={metricsData.validationRate}
                    suffix="%"
                    valueStyle={{ color: metricsData.validationRate < 90 ? '#cf1322' : '#3f8600' }}
                  />
                </MetricCard>
                
                <MetricCard>
                  <Statistic 
                    title="Request Queue Size" 
                    value={metricsData.queueSize}
                    valueStyle={{ color: metricsData.queueSize > 10 ? '#cf1322' : '#3f8600' }}
                  />
                </MetricCard>
              </MetricsGrid>
              
              <Divider />
              
              <ServerHealthContainer>
                <h4>Server Health Status</h4>
                <Alert
                  message={
                    metricsData.cpu > 80 || metricsData.memory > 80 || metricsData.errorRate > 5 
                      ? "Critical Issues Detected" 
                      : metricsData.cpu > 60 || metricsData.memory > 60 || metricsData.errorRate > 1
                        ? "Performance Warning"
                        : "Server Healthy"
                  }
                  description={
                    metricsData.cpu > 80 || metricsData.memory > 80 || metricsData.errorRate > 5 
                      ? "The server is experiencing critical issues that require immediate attention."
                      : metricsData.cpu > 60 || metricsData.memory > 60 || metricsData.errorRate > 1
                        ? "The server is showing signs of potential issues."
                        : "The server is operating normally within expected parameters."
                  }
                  type={
                    metricsData.cpu > 80 || metricsData.memory > 80 || metricsData.errorRate > 5 
                      ? "error"
                      : metricsData.cpu > 60 || metricsData.memory > 60 || metricsData.errorRate > 1
                        ? "warning"
                        : "success"
                  }
                  showIcon
                />
              </ServerHealthContainer>
              
              <ChartContainer>
                <h4>Response Time (ms)</h4>
                <Line {...responseTimeConfig} />
              </ChartContainer>
              
              <ChartContainer>
                <h4>Request Volume</h4>
                <Area {...requestVolumeConfig} />
              </ChartContainer>
            </>
          )}
        </TabPane>
        
        <TabPane tab="Resource Usage" key="resources">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              <ChartContainer>
                <h4>CPU & Memory Usage</h4>
                <Line {...resourceUsageConfig} />
              </ChartContainer>
              
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card title="CPU Usage" bordered={false}>
                  <Progress 
                    type="dashboard" 
                    percent={metricsData.cpu} 
                    status={metricsData.cpu > 80 ? 'exception' : 'normal'}
                    format={percent => `${percent}%`}
                  />
                  <div style={{ marginTop: '1rem' }}>
                    <p>
                      {metricsData.cpu > 80 
                        ? "Critical: High CPU usage may impact performance" 
                        : metricsData.cpu > 60 
                          ? "Warning: Elevated CPU usage detected"
                          : "Normal: CPU usage is within acceptable limits"}
                    </p>
                  </div>
                </Card>
                
                <Card title="Memory Usage" bordered={false}>
                  <Progress 
                    type="dashboard" 
                    percent={metricsData.memory} 
                    status={metricsData.memory > 80 ? 'exception' : 'normal'}
                    format={percent => `${percent}%`}
                  />
                  <div style={{ marginTop: '1rem' }}>
                    <p>
                      {metricsData.memory > 80 
                        ? "Critical: High memory usage may lead to service degradation" 
                        : metricsData.memory > 60 
                          ? "Warning: Elevated memory usage detected"
                          : "Normal: Memory usage is within acceptable limits"}
                    </p>
                  </div>
                </Card>
              </Space>
            </>
          )}
        </TabPane>
        
        <TabPane tab="Validation Metrics" key="validation">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              <ChartContainer>
                <h4>Validation Results Distribution</h4>
                <Pie {...validationResultsConfig} />
              </ChartContainer>
              
              <Card title="Validation Performance" bordered={false}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <h4>Validation Success Rate</h4>
                    <Progress 
                      percent={metricsData.validationRate} 
                      status={metricsData.validationRate < 90 ? 'exception' : 'success'}
                    />
                  </div>
                  
                  <div>
                    <h4>Average Response Time</h4>
                    <Progress 
                      percent={(metricsData.averageResponseTime / 500) * 100} 
                      status={metricsData.averageResponseTime > 200 ? 'exception' : 'success'}
                      format={() => `${metricsData.averageResponseTime} ms`}
                    />
                  </div>
                  
                  <div>
                    <h4>Error Rate</h4>
                    <Progress 
                      percent={metricsData.errorRate * 20} 
                      status={metricsData.errorRate > 1 ? 'exception' : 'success'}
                      format={() => `${metricsData.errorRate}%`}
                    />
                  </div>
                </Space>
              </Card>
            </>
          )}
        </TabPane>
        
        <TabPane tab="Alerts" key="alerts">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              message="Active Alerts"
              description={`You have ${alerts.filter(a => !a.acknowledged).length} unacknowledged alerts.`}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: '1rem' }}
            />
            
            <Table 
              dataSource={alerts} 
              columns={alertColumns} 
              rowKey="id"
              pagination={false}
            />
            
            <Divider />
            
            <Card title="Alert Configuration" bordered={false}>
              <Form
                layout="vertical"
                initialValues={alertSettings}
                onFinish={updateAlertSettings}
              >
                <Form.Item
                  name="enabled"
                  label="Enable Alerts"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name="cpuThreshold"
                  label="CPU Usage Threshold (%)"
                  rules={[{ required: true, message: 'Please set a threshold' }]}
                >
                  <InputNumber min={10} max={100} />
                </Form.Item>
                
                <Form.Item
                  name="memoryThreshold"
                  label="Memory Usage Threshold (%)"
                  rules={[{ required: true, message: 'Please set a threshold' }]}
                >
                  <InputNumber min={10} max={100} />
                </Form.Item>
                
                <Form.Item
                  name="responseTimeThreshold"
                  label="Response Time Threshold (ms)"
                  rules={[{ required: true, message: 'Please set a threshold' }]}
                >
                  <InputNumber min={50} max={2000} />
                </Form.Item>
                
                <Form.Item
                  name="errorRateThreshold"
                  label="Error Rate Threshold (%)"
                  rules={[{ required: true, message: 'Please set a threshold' }]}
                >
                  <InputNumber min={0.1} max={20} step={0.1} />
                </Form.Item>
                
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Save Alert Settings
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Space>
        </TabPane>
      </Tabs>
    </MonitorContainer>
  );
};

export default PerformanceMonitor; 