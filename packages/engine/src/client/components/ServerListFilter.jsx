import React from 'react';
import styled from 'styled-components';
import { Input, Select, Space, Button } from 'antd';
import { SearchOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';

const { Option } = Select;

// Styled components
const FilterContainer = styled.div`
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid ${props => props.theme.colors.border};
`;

const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const FilterGroup = styled.div`
  flex: 1;
  min-width: 200px;
`;

const FilterLabel = styled.div`
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

// Constants for filter options
const VALIDATION_LEVELS = [
  { value: 1, label: 'Level 1: Basic text validation' },
  { value: 2, label: 'Level 2: Pattern matching and contextual validation' },
  { value: 3, label: 'Level 3: AI-assisted validation' },
  { value: 4, label: 'Level 4: Human-in-the-loop validation' },
];

const REGULATION_TYPES = [
  { value: 'gdpr', label: 'GDPR' },
  { value: 'hipaa', label: 'HIPAA' },
  { value: 'ccpa', label: 'CCPA' },
  { value: 'pci-dss', label: 'PCI DSS' },
  { value: 'sox', label: 'SOX' },
  { value: 'custom', label: 'Custom Regulation' },
];

const SERVER_STATUSES = [
  { value: 'running', label: 'Running' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'error', label: 'Error' },
];

/**
 * Server List Filter Component
 * Provides filtering for MCP server listings by various criteria
 */
const ServerListFilter = ({ 
  filters, 
  setFilters, 
  onApplyFilters,
  onClearFilters 
}) => {
  
  // Helper function to handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters({
      ...filters,
      [key]: value
    });
  };
  
  return (
    <FilterContainer>
      <FilterRow>
        <FilterGroup>
          <FilterLabel>Search by Name</FilterLabel>
          <Input 
            placeholder="Search servers" 
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
        </FilterGroup>
        
        <FilterGroup>
          <FilterLabel>Regulation Type</FilterLabel>
          <Select
            placeholder="Select regulation type"
            value={filters.regulationType}
            onChange={(value) => handleFilterChange('regulationType', value)}
            style={{ width: '100%' }}
            allowClear
          >
            {REGULATION_TYPES.map(type => (
              <Option key={type.value} value={type.value}>{type.label}</Option>
            ))}
          </Select>
        </FilterGroup>
        
        <FilterGroup>
          <FilterLabel>Validation Level</FilterLabel>
          <Select
            placeholder="Select validation level"
            value={filters.validationLevel}
            onChange={(value) => handleFilterChange('validationLevel', value)}
            style={{ width: '100%' }}
            allowClear
          >
            {VALIDATION_LEVELS.map(level => (
              <Option key={level.value} value={level.value}>{level.label}</Option>
            ))}
          </Select>
        </FilterGroup>
      </FilterRow>
      
      <FilterRow>
        <FilterGroup>
          <FilterLabel>Server Status</FilterLabel>
          <Select
            placeholder="Select server status"
            value={filters.status}
            onChange={(value) => handleFilterChange('status', value)}
            style={{ width: '100%' }}
            allowClear
          >
            {SERVER_STATUSES.map(status => (
              <Option key={status.value} value={status.value}>{status.label}</Option>
            ))}
          </Select>
        </FilterGroup>
        
        <FilterGroup>
          <FilterLabel>Sort By</FilterLabel>
          <Select
            placeholder="Sort servers by"
            value={filters.sortBy}
            onChange={(value) => handleFilterChange('sortBy', value)}
            style={{ width: '100%' }}
            allowClear
          >
            <Option value="name">Name</Option>
            <Option value="validationLevel">Validation Level</Option>
            <Option value="createdAt">Creation Date</Option>
            <Option value="lastUpdated">Last Updated</Option>
          </Select>
        </FilterGroup>
        
        <FilterGroup>
          <FilterLabel>Sort Direction</FilterLabel>
          <Select
            placeholder="Sort direction"
            value={filters.sortDirection}
            onChange={(value) => handleFilterChange('sortDirection', value)}
            style={{ width: '100%' }}
          >
            <Option value="asc">Ascending</Option>
            <Option value="desc">Descending</Option>
          </Select>
        </FilterGroup>
      </FilterRow>
      
      <ButtonGroup>
        <Button onClick={onClearFilters} icon={<ClearOutlined />}>
          Clear Filters
        </Button>
        <Button type="primary" onClick={onApplyFilters} icon={<FilterOutlined />}>
          Apply Filters
        </Button>
      </ButtonGroup>
    </FilterContainer>
  );
};

export default ServerListFilter; 