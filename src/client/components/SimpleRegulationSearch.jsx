import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Input, Typography, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
const { Text } = Typography;

const SearchContainer = styled.div`
  padding: 0;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  align-items: stretch;
`;

const SearchInput = styled(Input)`
  flex: 1;
`;

const DropdownWrapper = styled.div`
  position: relative;
`;

const DropdownButton = styled.button`
  height: 40px;
  padding: 0 14px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: all 0.15s ease;

  &:hover {
    border-color: #4096ff;
    color: #4096ff;
  }
`;

const DropdownPanel = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 220px;
  background: #fff;
  border: 1px solid #e1e5e9;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 200;
  padding: 8px 0;
  animation: dropIn 0.12s ease-out;

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const DropdownItem = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: background 0.1s;

  &:hover {
    background: #f3f4f6;
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #4096ff;
    cursor: pointer;
  }
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
`;

const DropdownAction = styled.button`
  display: block;
  width: calc(100% - 16px);
  margin: 4px 8px;
  padding: 6px 8px;
  background: none;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  text-align: center;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
`;

const FilterBadge = styled.span`
  background: #4096ff;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
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

const ResultsContainer = styled.div``;

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

  // Jurisdiction filter
  const [availableJurisdictions, setAvailableJurisdictions] = useState([]);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState(new Set()); // empty = show all
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getJurisdictionKey = useCallback((regulation) => {
    const js = regulation.jurisdiction_source || regulation.jurisdictionSource || 'federal';
    if (js === 'state') {
      return regulation.state_code || regulation.stateCode || 'State';
    }
    return 'Federal';
  }, []);

  // Load all regulations on component mount
  useEffect(() => {
    const loadAllRegulations = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('http://localhost:3010/api/regulations/all');
        const data = await response.json();
        
        if (data && data.data) {
          const sortByRegKey = (a, b) => {
            const aNum = parseInt((a.reg_key || a.regKey || 'REG-999').replace(/\D/g, '')) || 999;
            const bNum = parseInt((b.reg_key || b.regKey || 'REG-999').replace(/\D/g, '')) || 999;
            return aNum - bNum;
          };
          const sortedData = [...data.data].sort(sortByRegKey);
          setAllRegulations(sortedData);
          setFilteredRegulations(sortedData);

          // Build jurisdiction list from data
          const counts = {};
          for (const reg of sortedData) {
            const key = getJurisdictionKey(reg);
            counts[key] = (counts[key] || 0) + 1;
          }
          // Sort: Federal first, then states alphabetically
          const jurisdictions = Object.entries(counts)
            .sort(([a], [b]) => {
              if (a === 'Federal') return -1;
              if (b === 'Federal') return 1;
              return a.localeCompare(b);
            })
            .map(([key, count]) => ({ key, count }));
          setAvailableJurisdictions(jurisdictions);
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
  }, [getJurisdictionKey]);

  // Filter regulations by text search AND jurisdiction
  useEffect(() => {
    let results = allRegulations;

    // Jurisdiction filter
    if (selectedJurisdictions.size > 0) {
      results = results.filter(reg => selectedJurisdictions.has(getJurisdictionKey(reg)));
    }

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(regulation => 
        regulation.name?.toLowerCase().includes(query) ||
        regulation.topic?.toLowerCase().includes(query) ||
        regulation.slug?.toLowerCase().includes(query) ||
        regulation.reg_key?.toLowerCase().includes(query) ||
        regulation.regKey?.toLowerCase().includes(query)
      );
    }

    const sortByRegKey = (a, b) => {
      const aNum = parseInt((a.reg_key || a.regKey || 'REG-999').replace(/\D/g, '')) || 999;
      const bNum = parseInt((b.reg_key || b.regKey || 'REG-999').replace(/\D/g, '')) || 999;
      return aNum - bNum;
    };
    setFilteredRegulations([...results].sort(sortByRegKey));
  }, [searchQuery, allRegulations, selectedJurisdictions, getJurisdictionKey]);

  const toggleJurisdiction = (key) => {
    setSelectedJurisdictions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearJurisdictionFilter = () => {
    setSelectedJurisdictions(new Set());
  };

  const handleRegulationClick = (regulation) => {
    console.log('Regulation selected:', regulation);
    
    // Navigate to the regulation's dedicated console page
    const regulationSlug = regulation.slug || regulation.regulationId || regulation.id || 'unknown-regulation';
    const consoleUrl = `/regulations/${regulationSlug}-console.html`;
    
    // Navigate to the specific regulation console page
    window.location.href = consoleUrl;
    
    // Still call the callback if provided
    if (onRegulationSelect) {
      onRegulationSelect(regulation);
    }
  };

  const filterActive = selectedJurisdictions.size > 0;
  const filterLabel = filterActive
    ? [...selectedJurisdictions].join(', ')
    : 'Jurisdiction';

  return (
    <SearchContainer>
      <FilterBar>
        <SearchInput
          size="large"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
        />

        <DropdownWrapper ref={dropdownRef}>
          <DropdownButton onClick={() => setDropdownOpen(!dropdownOpen)}>
            <span style={{ fontSize: '15px' }}>🏛</span>
            <span>{filterActive ? filterLabel : 'Jurisdiction'}</span>
            {filterActive && <FilterBadge>{selectedJurisdictions.size}</FilterBadge>}
            <span style={{ fontSize: '10px', marginLeft: '2px' }}>{dropdownOpen ? '▲' : '▼'}</span>
          </DropdownButton>

          {dropdownOpen && (
            <DropdownPanel>
              {availableJurisdictions.map(({ key, count }) => (
                <DropdownItem key={key}>
                  <input
                    type="checkbox"
                    checked={selectedJurisdictions.has(key)}
                    onChange={() => toggleJurisdiction(key)}
                  />
                  <span style={{ flex: 1 }}>
                    {key === 'Federal' ? '🇺🇸 Federal' : `🏛 ${key}`}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{count}</span>
                </DropdownItem>
              ))}
              {filterActive && (
                <>
                  <DropdownDivider />
                  <DropdownAction onClick={clearJurisdictionFilter}>
                    Clear filter
                  </DropdownAction>
                </>
              )}
            </DropdownPanel>
          )}
        </DropdownWrapper>
      </FilterBar>

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
            {(searchQuery || filterActive) ? 
              `${filteredRegulations.length} of ${allRegulations.length} regulations` :
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

