import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Input, List, Typography, Spin, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const { Text } = Typography;

const SearchContainer = styled.div`
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  padding: 20px;
  margin-bottom: 20px;
`;

const SearchInput = styled(Input)`
  margin-bottom: 16px;
`;

const ResultItem = styled.div`
  padding: 12px;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #1a365d;
    box-shadow: 0 2px 8px rgba(26, 54, 93, 0.1);
  }
`;

const ResultTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
`;

const ResultId = styled.span`
  font-size: 0.8rem;
  color: #6c757d;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
`;

const ResultsContainer = styled.div`
  /* Removed max-height to show full list without truncation */
`;

const StatsText = styled(Text)`
  display: block;
  margin-bottom: 12px;
  font-size: 0.9rem;
  color: #6c757d;
`;

/**
 * Simple Regulation Search Component for Dashboard
 * Shows all regulations initially, then filters as user types
 * Clicking on a regulation navigates to its MCP engine detail page
 */
const SimpleRegulationSearch = ({ onRegulationSelect, placeholder = "Search regulations..." }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [allRegulations, setAllRegulations] = useState([]);
  const [filteredRegulations, setFilteredRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all regulations on component mount
  useEffect(() => {
    const loadAllRegulations = async () => {
    setLoading(true);
    setError(null);

    try {
        console.log('🔍 Loading all regulations...');
        const response = await fetch('http://localhost:3010/api/regulations/all');
        const data = await response.json();
        
        if (data && data.data) {
          console.log(`✅ Loaded ${data.data.length} regulations`);
          setAllRegulations(data.data);
          setFilteredRegulations(data.data); // Show all initially
      } else {
          throw new Error('No regulation data returned');
      }
    } catch (err) {
        console.error('Error loading regulations:', err);
      setError(err.message);
        setAllRegulations([]);
        setFilteredRegulations([]);
    } finally {
      setLoading(false);
    }
    };

    loadAllRegulations();
  }, []);

  // Filter regulations as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Show all regulations when search is empty
      setFilteredRegulations(allRegulations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allRegulations.filter(regulation => 
      regulation.name?.toLowerCase().includes(query) ||
      regulation.topic?.toLowerCase().includes(query) ||
      regulation.slug?.toLowerCase().includes(query)
    );

    console.log(`🔍 Filtered ${filtered.length} regulations for "${searchQuery}"`);
    setFilteredRegulations(filtered);
  }, [searchQuery, allRegulations]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleRegulationClick = (regulation) => {
    console.log('Regulation selected:', regulation);
    
    // Navigate to the regulation's dedicated console page
    const regulationSlug = regulation.slug || regulation.regulationId || regulation.id || 'unknown-regulation';
    const consoleUrl = `/public/regulations/${regulationSlug}-console.html`;
    
    // Navigate to the specific regulation console page
    window.location.href = consoleUrl;
    
    // Still call the callback if provided
    if (onRegulationSelect) {
      onRegulationSelect(regulation);
    }
  };

  return (
    <SearchContainer>
      <SearchInput
        size="large"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        prefix={<SearchOutlined />}
        allowClear
      />

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '10px', color: '#6c757d' }}>Loading regulations...</p>
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#ff4d4f' }}>
          <Text type="danger">Error: {error}</Text>
        </div>
      )}

      {!loading && !error && (
        <>
          <StatsText>
            {searchQuery ? 
              `Showing ${filteredRegulations.length} of ${allRegulations.length} regulations matching "${searchQuery}"` :
              `Showing all ${allRegulations.length} regulations`
            }
          </StatsText>
          
          <ResultsContainer>
            {filteredRegulations.map((regulation, index) => (
            <ResultItem 
                key={regulation.id || index}
              onClick={() => handleRegulationClick(regulation)}
            >
              <ResultTitle>{regulation.name || 'Unnamed Regulation'}</ResultTitle>
                <ResultId>{regulation.id}</ResultId>
                {regulation.topic && (
                <Tag color="blue" style={{ marginTop: '8px' }}>
                  {regulation.topic}
                </Tag>
              )}
                {regulation.lastUpdated && (
                  <Tag color="default" style={{ marginTop: '8px' }}>
                    Updated: {new Date(regulation.lastUpdated).toLocaleDateString()}
                  </Tag>
                )}
            </ResultItem>
          ))}
          </ResultsContainer>

          {!loading && filteredRegulations.length === 0 && searchQuery && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
              <Text>No regulations found matching "{searchQuery}"</Text>
        </div>
      )}
        </>
      )}
    </SearchContainer>
  );
};

export default SimpleRegulationSearch;




