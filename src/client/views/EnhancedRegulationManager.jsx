import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import axios from 'axios';
import EnhancedRegulationUploader from '../components/EnhancedRegulationUploader';

// Registry API endpoints
const REGISTRY_API_URL = 'http://localhost:3010/api/regulations';

const RegulationManagerContainer = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 28px;
  margin-bottom: 24px;
  color: ${props => props.theme.colors.text};
`;

const RegulationsTable = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 30px;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr 2fr 1fr 1fr 1fr;
  padding: 16px;
  background-color: ${props => props.theme.colors.primary};
  color: white;
  font-weight: 600;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr 2fr 1fr 1fr 1fr;
  padding: 16px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const Cell = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
`;

const Button = styled.button`
  background-color: ${props => props.primary ? props.theme.colors.primary : props.theme.colors.secondary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-right: 8px;
  
  &:hover {
    background-color: ${props => props.primary ? props.theme.colors.primaryDark : props.theme.colors.secondary};
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: ${props => props.theme.colors.textSecondary};
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  background-color: ${props => {
    if (props.status === 'running') return props.theme.colors.success;
    if (props.status === 'stopped') return props.theme.colors.warning;
    return props.theme.colors.secondary;
  }};
  color: white;
`;

const ActionsCell = styled(Cell)`
  gap: 8px;
  justify-content: flex-start;
`;

const RefreshButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 4px;
  
  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const SearchContainer = styled.div`
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  flex: 1;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const LinkCell = styled(Cell)`
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

const EnhancedRegulationManager = () => {
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverActions, setServerActions] = useState({});
  
  useEffect(() => {
    fetchRegulations();
  }, []);
  
  const fetchRegulations = async () => {
    try {
      setLoading(true);
      
      // Fetch regulations from registry
      const response = await axios.get(REGISTRY_API_URL);
      setRegulations(response.data || []);
      
    } catch (error) {
      console.error('Error fetching regulations:', error);
      toast.error('Error loading regulations from registry');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartServer = async (regulationId) => {
    try {
      setServerActions(prev => ({ ...prev, [regulationId]: 'starting' }));
      
      const response = await axios.post(`${REGISTRY_API_URL}/${regulationId}/start-server`);
      
      if (response.data.success) {
        toast.success(`MCP server for ${regulationId} started on port ${response.data.port}`);
        // Refresh regulations to show updated status
        fetchRegulations();
      } else {
        throw new Error('Failed to start server');
      }
    } catch (error) {
      console.error(`Error starting server for ${regulationId}:`, error);
      toast.error(`Failed to start MCP server: ${error.message}`);
    } finally {
      setServerActions(prev => ({ ...prev, [regulationId]: null }));
    }
  };
  
  const handleStopServer = async (regulationId) => {
    try {
      setServerActions(prev => ({ ...prev, [regulationId]: 'stopping' }));
      
      const response = await axios.post(`${REGISTRY_API_URL}/${regulationId}/stop-server`);
      
      if (response.data.success) {
        toast.success(`MCP server for ${regulationId} stopped`);
        // Refresh regulations to show updated status
        fetchRegulations();
      } else {
        throw new Error(response.data.message || 'Failed to stop server');
      }
    } catch (error) {
      console.error(`Error stopping server for ${regulationId}:`, error);
      toast.error(`Failed to stop MCP server: ${error.message}`);
    } finally {
      setServerActions(prev => ({ ...prev, [regulationId]: null }));
    }
  };
  
  const handleRegulationsUploaded = (uploadedRegulations, results) => {
    // Refresh regulations list after upload
    fetchRegulations();
  };
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };
  
  // Filter regulations based on search term
  const filteredRegulations = regulations.filter(reg => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      (reg.regulationId && reg.regulationId.toLowerCase().includes(search)) ||
      (reg.name && reg.name.toLowerCase().includes(search)) ||
      (reg.description && reg.description.toLowerCase().includes(search))
    );
  });
  
  return (
    <RegulationManagerContainer>
      <Title>MCP Regulation Manager</Title>
      
      <EnhancedRegulationUploader onUploadComplete={handleRegulationsUploaded} />
      
      <RefreshButton onClick={fetchRegulations}>
        🔄 Refresh Regulations
      </RefreshButton>
      
      <SearchContainer>
        <SearchInput 
          placeholder="Search regulations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchContainer>
      
      <h2>Registered Regulations ({regulations.length})</h2>
      
      {loading ? (
        <div>Loading regulations...</div>
      ) : regulations.length === 0 ? (
        <EmptyState>
          <p>No regulations found in the registry</p>
          <p>Upload an Excel file to add regulations</p>
        </EmptyState>
      ) : (
        <RegulationsTable>
          <TableHeader>
            <Cell>ID</Cell>
            <Cell>Name</Cell>
            <Cell>Description</Cell>
            <Cell>Version</Cell>
            <Cell>MCP Status</Cell>
            <Cell>Actions</Cell>
          </TableHeader>
          
          {filteredRegulations.map(regulation => (
            <TableRow key={regulation.regulationId}>
              <Cell>{regulation.regulationId}</Cell>
              <LinkCell as={Link} to={`/regulations/${regulation.regulationId}`}>
                {regulation.name}
              </LinkCell>
              <Cell>{regulation.description || 'No description'}</Cell>
              <Cell>{regulation.version || '1.0'}</Cell>
              <Cell>
                <StatusBadge status={regulation.serverRunning ? 'running' : 'stopped'}>
                  {regulation.serverRunning ? 'Running' : 'Stopped'}
                </StatusBadge>
              </Cell>
              <ActionsCell>
                {regulation.serverRunning ? (
                  <Button 
                    onClick={() => handleStopServer(regulation.regulationId)}
                    disabled={serverActions[regulation.regulationId] === 'stopping'}
                  >
                    {serverActions[regulation.regulationId] === 'stopping' 
                      ? 'Stopping...' 
                      : 'Stop MCP Server'}
                  </Button>
                ) : (
                  <Button 
                    primary
                    onClick={() => handleStartServer(regulation.regulationId)}
                    disabled={serverActions[regulation.regulationId] === 'starting'}
                  >
                    {serverActions[regulation.regulationId] === 'starting' 
                      ? 'Starting...' 
                      : 'Start MCP Server'}
                  </Button>
                )}
                <Button 
                  as={Link} 
                  to={`/regulations/${regulation.regulationId}`}
                >
                  View Details
                </Button>
              </ActionsCell>
            </TableRow>
          ))}
        </RegulationsTable>
      )}
    </RegulationManagerContainer>
  );
};

export default EnhancedRegulationManager; 