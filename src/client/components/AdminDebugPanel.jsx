import React, { useState } from 'react';
import styled from 'styled-components';
import { Card, Button, Form, Input, Select, Switch, notification, Spin, Divider } from 'antd';
import { BugOutlined, SendOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

// Styled components
const PanelContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 8px;
    color: ${props => props.theme.colors.warning};
  }
`;

const FormWrapper = styled.div`
  max-width: 800px;
`;

const DebugCard = styled(Card)`
  margin-bottom: 1.5rem;
  border-left: 4px solid ${props => props.theme.colors.warning};
`;

const ResponseCard = styled(Card)`
  margin-top: 1.5rem;
  border-left: 4px solid ${props => 
    props.success ? props.theme.colors.success : props.theme.colors.error};
  background-color: ${props => 
    props.success ? 'rgba(46, 125, 50, 0.05)' : 'rgba(211, 47, 47, 0.05)'};
`;

const ResponseTitle = styled.div`
  font-weight: 500;
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  
  svg {
    margin-right: 8px;
  }
`;

const ResponseCode = styled.pre`
  background-color: #f5f5f5;
  padding: 0.75rem;
  border-radius: 4px;
  overflow: auto;
`;

/**
 * Admin Debug Panel Component
 * Provides tools for testing the CDC → API → WebSocket → front-end chain
 */
const AdminDebugPanel = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  
  // Default form values
  const defaultValues = {
    frontend_url: window.location.origin,
    tenant_id: 'moravian',
    reg_id: 'TEST-42CFR999',
    title: '🚧 Dummy Regulation',
    revision: '2025-05-22',
    payload: JSON.stringify({ summary: 'This is only a drill.' }, null, 2),
    bypass_production: false
  };
  
  const handleSubmit = async (values) => {
    setLoading(true);
    setResponse(null);
    setError(null);
    
    try {
      // Parse the payload if it's a string
      let parsedPayload;
      try {
        parsedPayload = typeof values.payload === 'string' 
          ? JSON.parse(values.payload) 
          : values.payload;
      } catch (parseError) {
        throw new Error(`Invalid JSON payload: ${parseError.message}`);
      }
      
      // Prepare the request body
      const requestBody = {
        tenant_id: values.tenant_id,
        reg_id: values.reg_id,
        title: values.title,
        revision: values.revision,
        payload: parsedPayload
      };
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add debug bypass header if needed
      if (values.bypass_production) {
        headers['X-Debug-Bypass'] = 'true';
      }
      
      // Make the API call
      const apiUrl = `${values.frontend_url}/v1/admin/inject-test-reg`;
      console.log(`Sending request to: ${apiUrl}`);
      console.log('Request body:', JSON.stringify(requestBody));
      console.log('Request headers:', headers);
      
      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
          credentials: 'include', // Include cookies for authentication
          mode: 'cors' // Explicitly set CORS mode
        });
        
        // Check if response is ok
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error('Server responded with error:', apiResponse.status, errorText);
          throw new Error(`Server responded with status: ${apiResponse.status}. ${errorText}`);
        }
        
        // Parse the response
        const responseData = await apiResponse.json();
        
        // Show success notification
        notification.success({
          message: 'Test Regulation Injected',
          description: 'Test regulation was successfully injected and will trigger the CDC pipeline.',
          duration: 5
        });
        
        // Store the response
        setResponse(responseData);
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }
    } catch (err) {
      console.error('Error injecting test regulation:', err);
      
      // Show error notification
      notification.error({
        message: 'Failed to Inject Test Regulation',
        description: err.message,
        duration: 7
      });
      
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <PanelContainer>
      <PanelHeader>
        <PanelTitle>
          <BugOutlined /> Admin Debug Tools
        </PanelTitle>
      </PanelHeader>
      
      <DebugCard title="Inject Test Regulation">
        <p>
          This tool injects a test regulation into the database to trigger the full 
          CDC → API → WebSocket → front-end chain. Only available to admin users.
        </p>
        
        <FormWrapper>
          <Form
            form={form}
            layout="vertical"
            initialValues={defaultValues}
            onFinish={handleSubmit}
          >
            <Form.Item
              name="frontend_url"
              label="Backend API URL"
              rules={[{ required: true, message: 'Please enter the backend API URL' }]}
            >
              <Input placeholder="http://localhost:3000" />
            </Form.Item>
            
            <Divider orientation="left">Regulation Data</Divider>
            
            <Form.Item
              name="tenant_id"
              label="Tenant ID"
              rules={[{ required: true, message: 'Please enter a tenant ID' }]}
            >
              <Input placeholder="moravian" />
            </Form.Item>
            
            <Form.Item
              name="reg_id"
              label="Regulation ID"
              rules={[{ required: true, message: 'Please enter a regulation ID' }]}
            >
              <Input placeholder="TEST-42CFR999" />
            </Form.Item>
            
            <Form.Item
              name="title"
              label="Title"
              rules={[{ required: true, message: 'Please enter a title' }]}
            >
              <Input placeholder="🚧 Dummy Regulation" />
            </Form.Item>
            
            <Form.Item
              name="revision"
              label="Revision Date"
              rules={[{ required: true, message: 'Please enter a revision date' }]}
            >
              <Input placeholder="2025-05-22" />
            </Form.Item>
            
            <Form.Item
              name="payload"
              label="Payload (JSON)"
              rules={[
                { required: true, message: 'Please enter a JSON payload' },
                {
                  validator: (_, value) => {
                    try {
                      if (value) JSON.parse(value);
                      return Promise.resolve();
                    } catch (error) {
                      return Promise.reject('Please enter valid JSON');
                    }
                  }
                }
              ]}
            >
              <TextArea 
                rows={6} 
                placeholder='{ "summary": "This is only a drill." }'
              />
            </Form.Item>
            
            <Form.Item
              name="bypass_production"
              valuePropName="checked"
            >
              <Switch checkedChildren="Production Bypass" unCheckedChildren="Production Blocked" />
            </Form.Item>
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SendOutlined />} 
                loading={loading}
                danger
              >
                Inject Test Regulation
              </Button>
            </Form.Item>
          </Form>
        </FormWrapper>
        
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spin size="large" />
            <div style={{ marginTop: '1rem' }}>Processing request...</div>
          </div>
        )}
        
        {response && (
          <ResponseCard success>
            <ResponseTitle>
              <CheckCircleOutlined style={{ color: '#2E7D32' }} /> 
              Success Response
            </ResponseTitle>
            <ResponseCode>{JSON.stringify(response, null, 2)}</ResponseCode>
          </ResponseCard>
        )}
        
        {error && (
          <ResponseCard>
            <ResponseTitle>
              <WarningOutlined style={{ color: '#D32F2F' }} /> 
              Error Response
            </ResponseTitle>
            <ResponseCode>{error}</ResponseCode>
          </ResponseCard>
        )}
      </DebugCard>
    </PanelContainer>
  );
};

export default AdminDebugPanel; 