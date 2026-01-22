import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Input, List, Typography, Spin, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const { Text } = Typography;

const SearchContainer = styled.div`
  padding: 0;
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
  margin: 12px 0;
  font-size: 0.8rem;
  color: #9ca3af;
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
          // Sort by reg_key (REG-001, REG-002, etc.)
          const sortByRegKey = (a, b) => {
            const aNum = parseInt((a.reg_key || a.regKey || 'REG-999').replace(/\D/g, '')) || 999;
            const bNum = parseInt((b.reg_key || b.regKey || 'REG-999').replace(/\D/g, '')) || 999;
            return aNum - bNum;
          };
          const sortedData = [...data.data].sort(sortByRegKey);
          setAllRegulations(sortedData);
          setFilteredRegulations(sortedData); // Show all initially
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
      regulation.slug?.toLowerCase().includes(query) ||
      regulation.reg_key?.toLowerCase().includes(query) ||
      regulation.regKey?.toLowerCase().includes(query)
    );

    // Sort filtered results by reg_key
    const sortByRegKey = (a, b) => {
      const aNum = parseInt((a.reg_key || a.regKey || 'REG-999').replace(/\D/g, '')) || 999;
      const bNum = parseInt((b.reg_key || b.regKey || 'REG-999').replace(/\D/g, '')) || 999;
      return aNum - bNum;
    };
    const sortedFiltered = [...filtered].sort(sortByRegKey);

    console.log(`🔍 Filtered ${sortedFiltered.length} regulations for "${searchQuery}"`);
    setFilteredRegulations(sortedFiltered);
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
              `${filteredRegulations.length} results` :
              `${allRegulations.length} regulations`
            }
          </StatsText>
          
          <ResultsContainer>
            {filteredRegulations.map((regulation, index) => {
              const regKey = regulation.reg_key || regulation.regKey || '--';
              const lovvLevel = regulation.lovv_level || regulation.lovvLevel;
              const taskCount = regulation.complianceTasks?.length || regulation.tasks?.length || 0;
              const jurisdictionSource = regulation.jurisdiction_source || regulation.jurisdictionSource || 'federal';
              const stateCode = regulation.state_code || regulation.stateCode;
              const applicabilityScope = regulation.applicability_scope || regulation.applicabilityScope;
              const version = regulation.version || 1;
              const lastUpdated = regulation.updated_at || regulation.updatedAt || regulation.lastUpdated;
              const isGold = lovvLevel === 'A';
              const isState = jurisdictionSource === 'state';
              
              // Build jurisdiction label
              let jurisdictionLabel = 'Federal';
              if (isState && stateCode) {
                jurisdictionLabel = stateCode;
                if (applicabilityScope === 'student_residency') {
                  jurisdictionLabel += ' (Student Residency)';
                } else if (applicabilityScope === 'both') {
                  jurisdictionLabel += ' (Institution + Residency)';
                }
              }
              
              return (
                <ResultItem 
                  key={regulation.id || index}
                  onClick={() => handleRegulationClick(regulation)}
                  style={{ 
                    borderLeft: isGold ? '4px solid #d97706' : '4px solid #e1e5e9',
                    background: isGold ? '#fffbeb' : '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ 
                          fontFamily: 'Monaco, Menlo, monospace', 
                          fontSize: '13px', 
                          fontWeight: '700',
                          color: '#7c3aed',
                          background: '#f3e8ff',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {regKey}
                        </span>
                        {isGold && (
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '700',
                            color: '#92400e',
                            background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            ★ GOLD
                          </span>
                        )}
                        {lovvLevel && !isGold && (
                          <span style={{ 
                            fontSize: '11px', 
                            color: '#6b7280',
                            background: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            Level {lovvLevel}
                          </span>
                        )}
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#6b7280',
                          background: '#f3f4f6',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          v{version}
                        </span>
                      </div>
                      <ResultTitle style={{ marginBottom: '4px' }}>{regulation.name || 'Unnamed Regulation'}</ResultTitle>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7280' }}>
                        <span style={{ 
                          color: isState ? '#0369a1' : '#6b7280',
                          fontWeight: isState ? '600' : '400'
                        }}>{jurisdictionLabel}</span>
                        {regulation.topic && <span>• {regulation.topic}</span>}
                        {taskCount > 0 && <span>• {taskCount} tasks</span>}
                        {lastUpdated && <span>• Updated {new Date(lastUpdated).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </ResultItem>
              );
            })}
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




