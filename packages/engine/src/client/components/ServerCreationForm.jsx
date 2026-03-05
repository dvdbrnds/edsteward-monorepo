import React, { useState } from 'react';
import styled from 'styled-components';
import { Steps, Button, Form, Input, Select, InputNumber, Radio, Switch, Space, Card, Divider } from 'antd';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

// Styled components
const FormContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const StepContent = styled.div`
  margin-top: 2rem;
  margin-bottom: 2rem;
  min-height: 320px;
`;

const ButtonsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
`;

const TemplateCard = styled(Card)`
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  ${props => props.selected && `
    border: 2px solid ${props.theme.colors.primary};
  `}
`;

// Server templates for quick setup
const SERVER_TEMPLATES = [
  {
    id: 'basic',
    name: 'Basic Validation Server',
    description: 'Simple validation server with minimal configuration. Good starting point for most use cases.',
    validationLevel: 1,
    icon: '📄'
  },
  {
    id: 'advanced',
    name: 'Advanced Pattern Matching',
    description: 'Validation server with pattern matching capabilities for more complex validation scenarios.',
    validationLevel: 2,
    icon: '🔍'
  },
  {
    id: 'ai-assisted',
    name: 'AI-Assisted Validation',
    description: 'Server with AI-assisted validation for complex regulations and content analysis.',
    validationLevel: 3,
    icon: '🤖'
  },
  {
    id: 'human-loop',
    name: 'Human-in-the-Loop',
    description: 'High certainty validation with human review integration for critical validations.',
    validationLevel: 4,
    icon: '👥'
  }
];

// Regulation types
const REGULATION_TYPES = [
  { value: 'gdpr', label: 'GDPR (General Data Protection Regulation)' },
  { value: 'hipaa', label: 'HIPAA (Health Insurance Portability and Accountability Act)' },
  { value: 'ccpa', label: 'CCPA (California Consumer Privacy Act)' },
  { value: 'pci-dss', label: 'PCI DSS (Payment Card Industry Data Security Standard)' },
  { value: 'sox', label: 'SOX (Sarbanes-Oxley Act)' },
  { value: 'custom', label: 'Custom Regulation' }
];

/**
 * Server Creation Form
 * A wizard-style form for creating new MCP validation servers
 */
const ServerCreationForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customRegulation, setCustomRegulation] = useState(false);
  
  // Steps in the wizard
  const steps = [
    { title: 'Template' },
    { title: 'Basic Info' },
    { title: 'Regulation' },
    { title: 'Resources' },
    { title: 'Review' },
  ];
  
  // Go to next step
  const next = async () => {
    try {
      // Validate current form fields before moving to next step
      if (currentStep === 1 || currentStep === 2 || currentStep === 3) {
        await form.validateFields();
      }
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };
  
  // Go to previous step
  const prev = () => {
    setCurrentStep(currentStep - 1);
  };
  
  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    
    // Pre-fill form with template values
    form.setFieldsValue({
      validationLevel: template.validationLevel
    });
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Combine with selected template
      const serverConfig = {
        ...values,
        template: selectedTemplate?.id
      };
      
      console.log('Server configuration:', serverConfig);
      
      // TODO: Submit to API to create server
      
      // Reset form
      form.resetFields();
      setSelectedTemplate(null);
      setCurrentStep(0);
      
      // Show success message
      // toast.success('MCP Server created successfully!');
      
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };
  
  // Render content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Template selection
        return (
          <div>
            <h3>Select a Server Template</h3>
            <p>Choose a template to quickly set up your MCP validation server:</p>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              {SERVER_TEMPLATES.map(template => (
                <TemplateCard 
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  selected={selectedTemplate?.id === template.id}
                  hoverable
                >
                  <Card.Meta
                    avatar={<span style={{ fontSize: '2rem' }}>{template.icon}</span>}
                    title={template.name}
                    description={template.description}
                  />
                  <div style={{ marginTop: '1rem' }}>
                    <strong>Validation Level:</strong> {template.validationLevel}
                  </div>
                </TemplateCard>
              ))}
            </Space>
          </div>
        );
        
      case 1: // Basic Information
        return (
          <div>
            <h3>Basic Server Information</h3>
            <p>Enter the basic details for your MCP validation server:</p>
            
            <Form.Item
              name="serverName"
              label="Server Name"
              rules={[{ required: true, message: 'Please enter a server name' }]}
            >
              <Input placeholder="e.g., GDPR Validation Server" />
            </Form.Item>
            
            <Form.Item
              name="serverDescription"
              label="Description"
            >
              <TextArea 
                placeholder="Brief description of this server's purpose" 
                rows={4}
              />
            </Form.Item>
            
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
          </div>
        );
        
      case 2: // Regulation Configuration
        return (
          <div>
            <h3>Regulation Configuration</h3>
            <p>Configure the regulation scope and identifiers:</p>
            
            <Form.Item
              name="regulationType"
              label="Regulation Type"
              rules={[{ required: true, message: 'Please select a regulation type' }]}
            >
              <Select
                placeholder="Select a regulation type"
                onChange={(value) => setCustomRegulation(value === 'custom')}
              >
                {REGULATION_TYPES.map(type => (
                  <Option key={type.value} value={type.value}>{type.label}</Option>
                ))}
              </Select>
            </Form.Item>
            
            {customRegulation && (
              <Form.Item
                name="customRegulationName"
                label="Custom Regulation Name"
                rules={[{ required: true, message: 'Please enter a name for your custom regulation' }]}
              >
                <Input placeholder="e.g., Internal Company Policy" />
              </Form.Item>
            )}
            
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
            
            <Form.Item
              name="validationCertainty"
              label="Validation Certainty Threshold (%)"
              rules={[{ required: true, message: 'Please set a certainty threshold' }]}
            >
              <InputNumber min={0} max={100} defaultValue={80} />
            </Form.Item>
          </div>
        );
        
      case 3: // Resource Configuration
        return (
          <div>
            <h3>Resource Configuration</h3>
            <p>Configure the server resources and runtime parameters:</p>
            
            <Form.Item
              name="port"
              label="Server Port"
              rules={[{ required: true, message: 'Please enter a port number' }]}
            >
              <InputNumber min={1024} max={65535} defaultValue={3000} />
            </Form.Item>
            
            <Form.Item
              name="memoryLimit"
              label="Memory Limit (MB)"
            >
              <InputNumber min={128} max={4096} defaultValue={512} />
            </Form.Item>
            
            <Form.Item
              name="maxConcurrentRequests"
              label="Max Concurrent Requests"
            >
              <InputNumber min={1} max={100} defaultValue={10} />
            </Form.Item>
            
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
              <Select defaultValue="info">
                <Option value="error">Error</Option>
                <Option value="warn">Warning</Option>
                <Option value="info">Info</Option>
                <Option value="debug">Debug</Option>
                <Option value="trace">Trace</Option>
              </Select>
            </Form.Item>
          </div>
        );
        
      case 4: // Review
        return (
          <div>
            <h3>Review Server Configuration</h3>
            <p>Review your MCP server configuration before creating:</p>
            
            <Card>
              <h4>Basic Information</h4>
              <p><strong>Server Name:</strong> {form.getFieldValue('serverName')}</p>
              <p><strong>Description:</strong> {form.getFieldValue('serverDescription')}</p>
              <p><strong>Validation Level:</strong> {form.getFieldValue('validationLevel')}</p>
              
              <Divider />
              
              <h4>Regulation Configuration</h4>
              <p>
                <strong>Regulation Type:</strong> {
                  REGULATION_TYPES.find(t => t.value === form.getFieldValue('regulationType'))?.label
                }
              </p>
              {customRegulation && (
                <p><strong>Custom Regulation Name:</strong> {form.getFieldValue('customRegulationName')}</p>
              )}
              <p><strong>Regulation Version:</strong> {form.getFieldValue('regulationVersion')}</p>
              <p><strong>Regulation Identifier:</strong> {form.getFieldValue('regulationIdentifier')}</p>
              <p><strong>Validation Certainty Threshold:</strong> {form.getFieldValue('validationCertainty')}%</p>
              
              <Divider />
              
              <h4>Resource Configuration</h4>
              <p><strong>Server Port:</strong> {form.getFieldValue('port')}</p>
              <p><strong>Memory Limit:</strong> {form.getFieldValue('memoryLimit')} MB</p>
              <p><strong>Max Concurrent Requests:</strong> {form.getFieldValue('maxConcurrentRequests')}</p>
              <p><strong>Auto-start:</strong> {form.getFieldValue('autoStart') ? 'Yes' : 'No'}</p>
              <p><strong>Log Level:</strong> {form.getFieldValue('logLevel')}</p>
              
              <Divider />
              
              <h4>Template</h4>
              <p><strong>Selected Template:</strong> {selectedTemplate?.name}</p>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <FormContainer>
      <Steps current={currentStep} items={steps} />
      
      <Form form={form} layout="vertical">
        <StepContent>
          {renderStepContent()}
        </StepContent>
      </Form>
      
      <ButtonsContainer>
        {currentStep > 0 && (
          <Button onClick={prev}>
            Previous
          </Button>
        )}
        
        {currentStep < steps.length - 1 && (
          <Button 
            type="primary" 
            onClick={next}
            disabled={currentStep === 0 && !selectedTemplate}
          >
            Next
          </Button>
        )}
        
        {currentStep === steps.length - 1 && (
          <Button type="primary" onClick={handleSubmit}>
            Create Server
          </Button>
        )}
      </ButtonsContainer>
    </FormContainer>
  );
};

export default ServerCreationForm; 