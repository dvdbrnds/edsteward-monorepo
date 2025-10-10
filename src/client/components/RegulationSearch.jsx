import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Input, Card, List, Empty, Spin, Tag, Typography, Button } from 'antd';
import { SearchOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { debounce } from 'lodash';
import api from '../api/api';

const { Text, Title } = Typography;

// Styled components
const SearchContainer = styled.div`
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
  overflow: hidden;
`;

const SearchHeader = styled.div`
  background: linear-gradient(135deg, #1a365d, #2d5282);
  color: white;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
`;

const SearchTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.025em;
`;

const SearchSubtitle = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  opacity: 0.8;
`;

const SearchContent = styled.div`
  padding: 24px;
`;

const SearchInputContainer = styled.div`
  margin-bottom: 20px;
`;

const SearchStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f8f9fb;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #6c757d;
`;

const ResultsList = styled.div`
  max-height: ${props => props.compact ? '300px' : '500px'};
  overflow-y: auto;
`;

const ResultItem = styled.div`
  padding: 16px;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  margin-bottom: 12px;
  background: #ffffff;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    border-color: #1a365d;
    box-shadow: 0 2px 8px rgba(26, 54, 93, 0.1);
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ResultHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const ResultTitle = styled.h4`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
`;

const ResultId = styled.span`
  font-size: 0.8rem;
  color: #6c757d;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
`;

const ResultDescription = styled.p`
  margin: 8px 0;
  font-size: 0.9rem;
  color: #4a5568;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ResultTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
`;

const EmptyStateContainer = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
`;

const ClearButton = styled(Button)`
  margin-left: 8px;
`;

/**
 * Regulation Search Component
 * Provides real-time search functionality for regulations with keyword highlighting
 */
const RegulationSearch = ({ onRegulationSelect, showHeader = true, placeholder = "Search regulations by name, topic, or keywords...", compact = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchStats, setSearchStats] = useState(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setSearchStats(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log(`🔍 Searching regulations for: "${query}"`);
        const response = await api.searchRegulations(query, compact ? 10 : 20);
        
        if (response.success) {
          setSearchResults(response.data || []);
          setSearchStats({
            query: response.query,
            totalResults: response.totalResults,
            returnedResults: response.returnedResults,
            searchFields: response.searchFields
          });
          console.log(`✅ Search returned ${response.returnedResults} results (${response.totalResults} total matches)`);
        } else {
          throw new Error(response.error || 'Search failed');
        }
      } catch (err) {
        console.error('Search error:', err);
        setError(err.message);
        setSearchResults([]);
        setSearchStats(null);
      } finally {
        setLoading(false);
      }
    }, 300),
    [compact]
  );

  // Handle search input changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchStats(null);
    setError(null);
  };

  const handleRegulationClick = (regulation) => {
    if (onRegulationSelect) {
      onRegulationSelect(regulation);
    }
  };

  const highlightSearchTerm = (text, searchTerm) => {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#fff3cd', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  const renderSearchResults = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px', color: '#6c757d' }}>Searching regulations...</p>
        </div>
      );
    }

    if (error) {
      return (
        <EmptyStateContainer>
          <FileTextOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
          <Title level={4} style={{ color: '#ff4d4f' }}>Search Error</Title>
          <Text>{error}</Text>
        </EmptyStateContainer>
      );
    }

    if (searchQuery && searchResults.length === 0) {
      return (
        <EmptyStateContainer>
          <SearchOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4} style={{ color: '#8c8c8c' }}>No Results Found</Title>
          <Text>No regulations match your search query "{searchQuery}"</Text>
          <br />
          <Text type="secondary">Try different keywords or check your spelling</Text>
        </EmptyStateContainer>
      );
    }

    if (!searchQuery) {
      return (
        <EmptyStateContainer>
          <SearchOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4} style={{ color: '#8c8c8c' }}>Start Searching</Title>
          <Text>Enter keywords to search through regulations</Text>
          <br />
          <Text type="secondary">Search by name, topic, requirements, or regulation ID</Text>
        </EmptyStateContainer>
      );
    }

    return (
      <ResultsList compact={compact}>
        {searchResults.map((regulation, index) => (
          <ResultItem 
            key={regulation.regulationId || index}
            onClick={() => handleRegulationClick(regulation)}
          >
            <ResultHeader>
              <ResultTitle>
                {highlightSearchTerm(regulation.name || 'Unnamed Regulation', searchQuery)}
              </ResultTitle>
              <ResultId>{regulation.regulationId}</ResultId>
            </ResultHeader>
            
            {!compact && regulation.description && (
              <ResultDescription>
                {highlightSearchTerm(regulation.description, searchQuery)}
              </ResultDescription>
            )}
            
            <ResultTags>
              {regulation.type && (
                <Tag color="blue" icon={<FileTextOutlined />}>
                  {regulation.type}
                </Tag>
              )}
              {regulation.topic && (
                <Tag color="green">
                  {highlightSearchTerm(regulation.topic, searchQuery)}
                </Tag>
              )}
              {!compact && regulation.lastUpdated && (
                <Tag color="default" icon={<ClockCircleOutlined />}>
                  {new Date(regulation.lastUpdated).toLocaleDateString()}
                </Tag>
              )}
            </ResultTags>
          </ResultItem>
        ))}
      </ResultsList>
    );
  };

  return (
    <SearchContainer>
      {showHeader && (
        <SearchHeader>
          <SearchTitle>Regulation Search</SearchTitle>
          <SearchSubtitle>
            Search through all available regulations by keywords, topics, or requirements
          </SearchSubtitle>
        </SearchHeader>
      )}
      
      <SearchContent>
        <SearchInputContainer>
          <Input
            size="large"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleInputChange}
            prefix={<SearchOutlined />}
            suffix={
              searchQuery && (
                <ClearButton 
                  type="text" 
                  size="small" 
                  onClick={handleClearSearch}
                >
                  Clear
                </ClearButton>
              )
            }
            allowClear
          />
        </SearchInputContainer>

        {searchStats && (
          <SearchStats>
            <div>
              <strong>{searchStats.returnedResults}</strong> of <strong>{searchStats.totalResults}</strong> results for "{searchStats.query}"
            </div>
            <div>
              <Text type="secondary">
                Searched: {searchStats.searchFields?.slice(0, 3).join(', ')}
                {searchStats.searchFields?.length > 3 && ` +${searchStats.searchFields.length - 3} more`}
              </Text>
            </div>
          </SearchStats>
        )}

        {renderSearchResults()}
      </SearchContent>
    </SearchContainer>
  );
};

export default RegulationSearch;
