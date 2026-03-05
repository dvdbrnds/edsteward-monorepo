import React, { useState } from 'react';
import styled from 'styled-components';
import { Card, Button, Table, Switch, Input, Modal, Form, Select, Space, Tooltip, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

// Styled components
const EditorContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const EditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const EditorTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text};
`;

const ActionButton = styled(Button)`
  margin-left: 0.5rem;
`;

const CodeBlock = styled.pre`
  background-color: #f5f5f5;
  padding: 0.75rem;
  border-radius: 4px;
  overflow: auto;
  font-family: monospace;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;

/**
 * Validation Tool Editor Component
 * Allows configuring validation tools and their input schemas
 */
const ValidationToolEditor = ({ serverId }) => {
  const [form] = Form.useForm();
  const [toolModalVisible, setToolModalVisible] = useState(false);
  const [schemaModalVisible, setSchemaModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [editingSchema, setEditingSchema] = useState(null);
  
  // Mock validation tools - would be fetched from API in real implementation
  const [validationTools, setValidationTools] = useState([
    {
      id: 'text-validator',
      name: 'Text Validator',
      description: 'Basic text validation against regulation content',
      enabled: true,
      type: 'text',
      order: 1,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text content to validate' },
          context: { type: 'string', description: 'Optional context information' }
        },
        required: ['text']
      }
    },
    {
      id: 'pattern-matcher',
      name: 'Pattern Matcher',
      description: 'Advanced pattern matching for structured content',
      enabled: true,
      type: 'pattern',
      order: 2,
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Content to validate' },
          patterns: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of patterns to match against'
          }
        },
        required: ['content', 'patterns']
      }
    },
    {
      id: 'entity-extractor',
      name: 'Entity Extractor',
      description: 'Extracts entities like names, addresses, etc. from text',
      enabled: false,
      type: 'extraction',
      order: 3,
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text content to analyze' },
          entityTypes: { 
            type: 'array', 
            items: { type: 'string', enum: ['PERSON', 'ADDRESS', 'DATE', 'ORGANIZATION'] },
            description: 'Types of entities to extract'
          }
        },
        required: ['text']
      }
    }
  ]);
  
  // Tool type options
  const toolTypes = [
    { value: 'text', label: 'Text Processing' },
    { value: 'pattern', label: 'Pattern Matching' },
    { value: 'extraction', label: 'Entity Extraction' },
    { value: 'ai', label: 'AI-Assisted Analysis' },
    { value: 'human', label: 'Human-in-the-Loop' },
    { value: 'custom', label: 'Custom Validation' }
  ];
  
  // Handle tool status toggle
  const handleToolStatusChange = (toolId, checked) => {
    const updatedTools = validationTools.map(tool => {
      if (tool.id === toolId) {
        return { ...tool, enabled: checked };
      }
      return tool;
    });
    
    setValidationTools(updatedTools);
    message.success(`Tool ${checked ? 'enabled' : 'disabled'}`);
  };
  
  // Handle tool reordering
  const handleMoveUp = (toolId) => {
    const index = validationTools.findIndex(tool => tool.id === toolId);
    if (index <= 0) return;
    
    const newTools = [...validationTools];
    const temp = newTools[index - 1].order;
    newTools[index - 1].order = newTools[index].order;
    newTools[index].order = temp;
    
    // Sort by order
    newTools.sort((a, b) => a.order - b.order);
    
    setValidationTools(newTools);
  };
  
  const handleMoveDown = (toolId) => {
    const index = validationTools.findIndex(tool => tool.id === toolId);
    if (index >= validationTools.length - 1) return;
    
    const newTools = [...validationTools];
    const temp = newTools[index + 1].order;
    newTools[index + 1].order = newTools[index].order;
    newTools[index].order = temp;
    
    // Sort by order
    newTools.sort((a, b) => a.order - b.order);
    
    setValidationTools(newTools);
  };
  
  // Open tool edit modal
  const showToolModal = (tool = null) => {
    setEditingTool(tool);
    
    if (tool) {
      form.setFieldsValue({
        toolName: tool.name,
        toolDescription: tool.description,
        toolType: tool.type,
        toolEnabled: tool.enabled
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        toolEnabled: true,
        toolType: 'text'
      });
    }
    
    setToolModalVisible(true);
  };
  
  // Open schema edit modal
  const showSchemaModal = (tool) => {
    setEditingSchema(tool);
    setSchemaModalVisible(true);
  };
  
  // Handle tool form submission
  const handleToolSubmit = () => {
    form.validateFields().then(values => {
      const { toolName, toolDescription, toolType, toolEnabled } = values;
      
      if (editingTool) {
        // Update existing tool
        const updatedTools = validationTools.map(tool => {
          if (tool.id === editingTool.id) {
            return {
              ...tool,
              name: toolName,
              description: toolDescription,
              type: toolType,
              enabled: toolEnabled
            };
          }
          return tool;
        });
        
        setValidationTools(updatedTools);
        message.success('Validation tool updated successfully');
      } else {
        // Create new tool
        const newTool = {
          id: `tool-${Date.now()}`,
          name: toolName,
          description: toolDescription,
          type: toolType,
          enabled: toolEnabled,
          order: validationTools.length + 1,
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input data to validate' }
            },
            required: ['input']
          }
        };
        
        setValidationTools([...validationTools, newTool]);
        message.success('New validation tool created');
      }
      
      setToolModalVisible(false);
    });
  };
  
  // Handle updating schema for a tool
  const handleSchemaUpdate = (schemaJson) => {
    try {
      const schema = JSON.parse(schemaJson);
      
      const updatedTools = validationTools.map(tool => {
        if (tool.id === editingSchema.id) {
          return {
            ...tool,
            inputSchema: schema
          };
        }
        return tool;
      });
      
      setValidationTools(updatedTools);
      message.success('Input schema updated successfully');
      setSchemaModalVisible(false);
    } catch (error) {
      message.error('Invalid JSON schema format');
    }
  };
  
  // Handle tool deletion
  const handleDeleteTool = (toolId) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this validation tool?',
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        const updatedTools = validationTools.filter(tool => tool.id !== toolId);
        
        // Reorder remaining tools
        updatedTools.forEach((tool, index) => {
          tool.order = index + 1;
        });
        
        setValidationTools(updatedTools);
        message.success('Validation tool deleted');
      }
    });
  };
  
  // Table columns
  const columns = [
    {
      title: 'Order',
      dataIndex: 'order',
      key: 'order',
      width: 70,
      render: (order, record) => (
        <Space size="small">
          <Button 
            icon={<ArrowUpOutlined />} 
            size="small"
            disabled={order === 1}
            onClick={() => handleMoveUp(record.id)}
          />
          <Button 
            icon={<ArrowDownOutlined />} 
            size="small"
            disabled={order === validationTools.length}
            onClick={() => handleMoveDown(record.id)}
          />
        </Space>
      )
    },
    {
      title: 'Tool Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeObj = toolTypes.find(t => t.value === type);
        return typeObj ? typeObj.label : type;
      }
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) => (
        <Switch 
          checked={enabled} 
          onChange={(checked) => handleToolStatusChange(record.id, checked)}
        />
      )
    },
    {
      title: 'Schema',
      key: 'schema',
      width: 100,
      render: (_, record) => (
        <Tooltip title="Edit Input Schema">
          <Button 
            icon={<InfoCircleOutlined />} 
            onClick={() => showSchemaModal(record)}
          >
            Schema
          </Button>
        </Tooltip>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EditOutlined />} 
            onClick={() => showToolModal(record)}
          />
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteTool(record.id)}
          />
        </Space>
      )
    }
  ];
  
  return (
    <EditorContainer>
      <EditorHeader>
        <EditorTitle>Validation Tools Configuration</EditorTitle>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => showToolModal()}
        >
          Add Validation Tool
        </Button>
      </EditorHeader>
      
      <Table 
        dataSource={validationTools} 
        columns={columns} 
        rowKey="id"
        pagination={false}
      />
      
      {/* Tool Edit Modal */}
      <Modal
        title={editingTool ? 'Edit Validation Tool' : 'Add Validation Tool'}
        open={toolModalVisible}
        onCancel={() => setToolModalVisible(false)}
        onOk={handleToolSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="toolName"
            label="Tool Name"
            rules={[{ required: true, message: 'Please enter a name for this tool' }]}
          >
            <Input placeholder="e.g., Text Validator" />
          </Form.Item>
          
          <Form.Item
            name="toolDescription"
            label="Description"
          >
            <TextArea 
              placeholder="Description of what this validation tool does" 
              rows={3}
            />
          </Form.Item>
          
          <Form.Item
            name="toolType"
            label="Tool Type"
            rules={[{ required: true, message: 'Please select a tool type' }]}
          >
            <Select>
              {toolTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="toolEnabled"
            label="Enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* Schema Edit Modal */}
      <Modal
        title="Edit Input Schema"
        open={schemaModalVisible}
        onCancel={() => setSchemaModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSchemaModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            onClick={() => {
              const schemaTextarea = document.getElementById('schema-editor');
              handleSchemaUpdate(schemaTextarea.value);
            }}
          >
            Save Schema
          </Button>
        ]}
        width={800}
      >
        {editingSchema && (
          <>
            <p>Define the JSON Schema for this validation tool's input:</p>
            <TextArea
              id="schema-editor"
              defaultValue={JSON.stringify(editingSchema.inputSchema, null, 2)}
              rows={15}
              style={{ fontFamily: 'monospace' }}
            />
            <div style={{ marginTop: '1rem' }}>
              <h4>Example Validation Request:</h4>
              <CodeBlock>
                {`{
  "method": "validate",
  "params": {
    "tool": "${editingSchema.id}",
    "input": ${JSON.stringify(generateSampleInput(editingSchema.inputSchema), null, 2)}
  }
}`}
              </CodeBlock>
            </div>
          </>
        )}
      </Modal>
    </EditorContainer>
  );
};

// Helper function to generate sample input based on schema
const generateSampleInput = (schema) => {
  if (!schema || !schema.properties) return {};
  
  const result = {};
  
  Object.entries(schema.properties).forEach(([key, prop]) => {
    if (prop.type === 'string') {
      result[key] = `Sample ${key}`;
    } else if (prop.type === 'number' || prop.type === 'integer') {
      result[key] = 42;
    } else if (prop.type === 'boolean') {
      result[key] = true;
    } else if (prop.type === 'array') {
      if (prop.items && prop.items.enum) {
        result[key] = [prop.items.enum[0]];
      } else {
        result[key] = ['sample item'];
      }
    } else if (prop.type === 'object') {
      result[key] = {};
    }
  });
  
  return result;
};

export default ValidationToolEditor; 