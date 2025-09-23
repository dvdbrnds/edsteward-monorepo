import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Card, 
  Select, 
  Button, 
  Space, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Alert, 
  Modal, 
  Progress,
  Descriptions,
  List,
  Typography,
  Divider,
  Switch,
  DatePicker,
  notification
} from 'antd';
import { 
  SendOutlined, 
  EyeOutlined, 
  ReloadOutlined,
  UserOutlined,
  GlobalOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Title, Text } = Typography;

// Styled Components
const DeliveryContainer = styled.div`
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
`;

const DeliveryHeader = styled.div`
  background: white;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const DeliveryTitle = styled.h1`
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 28px;
  font-weight: 600;
`;

const DeliverySubtitle = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 16px;
`;

const CustomerCard = styled(Card)`
  margin-bottom: 16px;
  
  .ant-card-head {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
`;

const StatCard = styled(Card)`
  text-align: center;
  
  .ant-statistic-content {
    font-size: 20px;
    font-weight: 600;
  }
`;

const RegulationPreview = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 16px;
  margin: 16px 0;
`;

const CustomerDeliveryDashboard = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [deliveryPreview, setDeliveryPreview] = useState(null);
  const [loading, setLoading] = useState({
    customers: false,
    preview: false,
    delivery: false
  });
  const [deliveryModal, setDeliveryModal] = useState({
    visible: false,
    testMode: false,
    scheduledTime: null
  });
  const [deliveryStatus, setDeliveryStatus] = useState(null);

  // API base URL
  const API_BASE = 'http://localhost:3060/api';

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Load delivery preview when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      loadDeliveryPreview(selectedCustomer);
    } else {
      setDeliveryPreview(null);
    }
  }, [selectedCustomer]);

  // Load customers
  const loadCustomers = async () => {
    try {
      setLoading(prev => ({ ...prev, customers: true }));
      const response = await fetch(`${API_BASE}/customers`);
      const data = await response.json();
      
      if (data.success) {
        setCustomers(data.data);
      } else {
        throw new Error(data.error || 'Failed to load customers');
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      notification.error({
        message: 'Error Loading Customers',
        description: error.message
      });
    } finally {
      setLoading(prev => ({ ...prev, customers: false }));
    }
  };

  // Load delivery preview
  const loadDeliveryPreview = async (customerId) => {
    try {
      setLoading(prev => ({ ...prev, preview: true }));
      const response = await fetch(`${API_BASE}/delivery/preview/${customerId}`);
      const data = await response.json();
      
      if (data.success) {
        setDeliveryPreview(data.data);
      } else {
        throw new Error(data.error || 'Failed to load delivery preview');
      }
    } catch (error) {
      console.error('Error loading delivery preview:', error);
      notification.error({
        message: 'Error Loading Preview',
        description: error.message
      });
    } finally {
      setLoading(prev => ({ ...prev, preview: false }));
    }
  };

  // Execute bulk delivery
  const executeBulkDelivery = async () => {
    try {
      setLoading(prev => ({ ...prev, delivery: true }));
      
      const response = await fetch(`${API_BASE}/delivery/bulk/${selectedCustomer}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testMode: deliveryModal.testMode,
          scheduledTime: deliveryModal.scheduledTime
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDeliveryStatus(data.data);
        setDeliveryModal({ visible: false, testMode: false, scheduledTime: null });
        
        notification.success({
          message: 'Delivery Initiated',
          description: `Bulk delivery started for ${data.data.customer.name}`,
          duration: 5
        });

        // Start polling for delivery status updates
        startDeliveryPolling(data.data.deliveryId);

        // Refresh customer data to update last delivery time
        loadCustomers();
      } else {
        throw new Error(data.error || 'Failed to execute delivery');
      }
    } catch (error) {
      console.error('Error executing delivery:', error);
      notification.error({
        message: 'Delivery Failed',
        description: error.message
      });
    } finally {
      setLoading(prev => ({ ...prev, delivery: false }));
    }
  };

  // Start polling for delivery status updates
  const startDeliveryPolling = (deliveryId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/delivery/status/${deliveryId}`);
        const data = await response.json();
        
        if (data.success) {
          setDeliveryStatus(data.data);
          
          // Stop polling if delivery is completed or failed
          if (data.data.status === 'completed' || data.data.status === 'failed') {
            clearInterval(pollInterval);
            
            if (data.data.status === 'completed') {
              notification.success({
                message: 'Delivery Completed',
                description: `Successfully delivered ${data.data.progress.total} regulations`,
                duration: 8
              });
            } else {
              notification.error({
                message: 'Delivery Failed',
                description: 'Bulk delivery encountered errors',
                duration: 8
              });
            }
            
            // Refresh customer data
            loadCustomers();
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Clean up interval after 10 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 600000);
  };

  // Get customer type color
  const getCustomerTypeColor = (type) => {
    switch (type) {
      case 'public_university': return 'blue';
      case 'private_university': return 'purple';
      case 'community_college': return 'green';
      case 'research_institution': return 'orange';
      default: return 'default';
    }
  };

  // Get jurisdiction tags
  const getJurisdictionTags = (jurisdiction) => {
    return jurisdiction.map(j => {
      const colors = {
        federal: 'blue',
        pennsylvania: 'green',
        california: 'orange',
        multi_state: 'purple'
      };
      return (
        <Tag key={j} color={colors[j] || 'default'}>
          {j.replace('_', ' ').toUpperCase()}
        </Tag>
      );
    });
  };

  return (
    <DeliveryContainer>
      <DeliveryHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <DeliveryTitle>Customer Regulation Delivery</DeliveryTitle>
            <DeliverySubtitle>
              Push jurisdiction-specific regulation sets to customers based on their location and institution type
            </DeliverySubtitle>
          </div>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadCustomers}
              loading={loading.customers}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </DeliveryHeader>

      {/* Customer Selection */}
      <Card title="Select Customer" style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Select
              placeholder="Choose a customer to deliver regulations"
              style={{ width: '100%' }}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              loading={loading.customers}
              showSearch
              optionFilterProp="children"
            >
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{customer.name}</span>
                    <Space>
                      <Tag color={getCustomerTypeColor(customer.type)} size="small">
                        {customer.type.replace('_', ' ')}
                      </Tag>
                      <Tag color="blue" size="small">
                        {customer.location.state}
                      </Tag>
                    </Space>
                  </div>
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={12}>
            <Text type="secondary">
              {customers.length} customers available • Select a customer to preview applicable regulations
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Delivery Preview */}
      {deliveryPreview && (
        <Row gutter={16}>
          <Col span={16}>
            <CustomerCard
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <UserOutlined /> {deliveryPreview.customer.name}
                  </span>
                  <Space>
                    {getJurisdictionTags(deliveryPreview.customer.jurisdiction)}
                    <Tag color={deliveryPreview.customer.status === 'test' ? 'orange' : 'green'}>
                      {deliveryPreview.customer.status.toUpperCase()}
                    </Tag>
                  </Space>
                </div>
              }
              loading={loading.preview}
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Institution Type">
                  <Tag color={getCustomerTypeColor(deliveryPreview.customer.type)}>
                    {deliveryPreview.customer.type.replace('_', ' ')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Total Regulations">
                  <Text strong>{deliveryPreview.delivery.totalRegulations}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Estimated Size">
                  {deliveryPreview.delivery.estimatedSize}
                </Descriptions.Item>
                <Descriptions.Item label="Estimated Time">
                  {deliveryPreview.delivery.estimatedTime}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery Format">
                  {deliveryPreview.delivery.format}
                </Descriptions.Item>
                <Descriptions.Item label="Last Delivery">
                  {deliveryPreview.lastDelivery ? 
                    new Date(deliveryPreview.lastDelivery).toLocaleDateString() : 
                    'Never'
                  }
                </Descriptions.Item>
              </Descriptions>

              {deliveryPreview.warnings.length > 0 && (
                <Alert
                  message="Delivery Warnings"
                  description={deliveryPreview.warnings.join(', ')}
                  type="warning"
                  showIcon
                  style={{ margin: '16px 0' }}
                />
              )}

              <RegulationPreview>
                <Title level={5}>📋 Regulation Breakdown</Title>
                <Row gutter={16}>
                  <Col span={8}>
                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '4px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
                        {deliveryPreview.regulations.federal.count}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>Federal Regulations</div>
                      {deliveryPreview.regulations.federal.examples.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af' }}>
                          {deliveryPreview.regulations.federal.examples.join(', ')}...
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '4px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                        {deliveryPreview.regulations.state.count}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>State Regulations</div>
                      {deliveryPreview.regulations.state.examples.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af' }}>
                          {deliveryPreview.regulations.state.examples.join(', ')}...
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '4px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>
                        {deliveryPreview.regulations.thirdParty.count}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>Third-Party</div>
                      {deliveryPreview.regulations.thirdParty.examples.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af' }}>
                          {deliveryPreview.regulations.thirdParty.examples.join(', ')}...
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              </RegulationPreview>

              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <Space size="large">
                  <Button 
                    type="default" 
                    icon={<EyeOutlined />}
                    onClick={() => loadDeliveryPreview(selectedCustomer)}
                    loading={loading.preview}
                  >
                    Refresh Preview
                  </Button>
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<SendOutlined />}
                    onClick={() => setDeliveryModal({ ...deliveryModal, visible: true })}
                    disabled={deliveryPreview.delivery.totalRegulations === 0}
                  >
                    Push All Regulations
                  </Button>
                </Space>
              </div>
            </CustomerCard>
          </Col>

          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <StatCard>
                <Statistic
                  title="Total Regulations"
                  value={deliveryPreview.delivery.totalRegulations}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#7c3aed' }}
                />
              </StatCard>
              
              <StatCard>
                <Statistic
                  title="Estimated Delivery Time"
                  value={deliveryPreview.delivery.estimatedTime}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#059669' }}
                />
              </StatCard>

              <StatCard>
                <Statistic
                  title="Package Size"
                  value={deliveryPreview.delivery.estimatedSize}
                  prefix={<GlobalOutlined />}
                  valueStyle={{ color: '#dc2626' }}
                />
              </StatCard>
            </Space>
          </Col>
        </Row>
      )}

      {/* Delivery Status */}
      {deliveryStatus && (
        <Card 
          title={
            <span>
              <CheckCircleOutlined style={{ color: '#059669' }} /> Delivery Status
            </span>
          }
          style={{ marginTop: 24 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Delivery ID">{deliveryStatus.deliveryId}</Descriptions.Item>
                <Descriptions.Item label="Customer">{deliveryStatus.customer?.name || 'Unknown Customer'}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={deliveryStatus.status === 'completed' ? 'green' : 'blue'}>
                    {deliveryStatus.status.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Started">{deliveryStatus.delivery?.startTime ? new Date(deliveryStatus.delivery.startTime).toLocaleString() : 'Not available'}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col span={12}>
              <div style={{ padding: '16px' }}>
                <Text strong>Progress: {deliveryStatus.progress?.completed || 0}/{deliveryStatus.progress?.total || 0}</Text>
                <Progress 
                  percent={deliveryStatus.progress?.completed && deliveryStatus.progress?.total ? 
                    Math.round((deliveryStatus.progress.completed / deliveryStatus.progress.total) * 100) : 0}
                  status={deliveryStatus.status === 'completed' ? 'success' : 'active'}
                  style={{ marginTop: '8px' }}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {deliveryStatus.progress?.currentPhase || 'Initializing...'}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Delivery Confirmation Modal */}
      <Modal
        title="Confirm Bulk Regulation Delivery"
        open={deliveryModal.visible}
        onOk={executeBulkDelivery}
        onCancel={() => setDeliveryModal({ visible: false, testMode: false, scheduledTime: null })}
        confirmLoading={loading.delivery}
        width={600}
      >
        {deliveryPreview && (
          <div>
            <Alert
              message="You are about to deliver ALL applicable regulations to this customer"
              description={`This will send ${deliveryPreview.delivery.totalRegulations} regulations to ${deliveryPreview.customer.name} based on their jurisdiction and institution type.`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Delivery Options:</Text>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>Test Mode (no actual delivery):</Text>
                <Switch 
                  checked={deliveryModal.testMode}
                  onChange={(checked) => setDeliveryModal({ ...deliveryModal, testMode: checked })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>Schedule for later:</Text>
                <DatePicker 
                  showTime
                  placeholder="Deliver immediately"
                  value={deliveryModal.scheduledTime}
                  onChange={(time) => setDeliveryModal({ ...deliveryModal, scheduledTime: time })}
                />
              </div>
            </Space>

            <Divider />

            <Text type="secondary" style={{ fontSize: '12px' }}>
              This action will trigger the EdSteward integration system to deliver the complete regulation package to the customer's compliance management system.
            </Text>
          </div>
        )}
      </Modal>
    </DeliveryContainer>
  );
};

export default CustomerDeliveryDashboard;
