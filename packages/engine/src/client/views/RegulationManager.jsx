import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import api from '../api/api';
import RegulationUploader from '../components/RegulationUploader';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

// MCP Server configuration
const CIVIL_SERVICE_ACT_MCP_SERVER_URL = 'http://localhost:3005/mcp';

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
  grid-template-columns: 1fr 2fr 3fr 1fr 1fr;
  padding: 16px;
  background-color: ${props => props.theme.colors.primary};
  color: white;
  font-weight: 600;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr 3fr 1fr 1fr;
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

const SourcesModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const ModalContent = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: ${props => props.theme.colors.secondary};
  
  &:hover {
    color: ${props => props.theme.colors.text};
  }
`;

const SourceInput = styled.div`
  margin-bottom: 16px;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 150px;
  padding: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-family: ${props => props.theme.fonts.body};
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
`;

// Add new styled components for the clickable row
const StyledLink = styled(Link)`
  text-decoration: none;
  color: inherit;
  display: contents;
`;

const LinkCell = styled(Cell)`
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

const RegulationManager = () => {
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [sources, setSources] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mcpStatus, setMcpStatus] = useState({});
  
  useEffect(() => {
    fetchRegulations();
    checkMcpServers();
  }, []);
  
  const checkMcpServers = async () => {
    try {
      // Check the Civil Service Act MCP server status
      const civilServiceResponse = await axios.get('http://localhost:3005/health');
      if (civilServiceResponse.data.status === 'ok') {
        setMcpStatus(prev => ({ ...prev, civilServiceAct: true }));
        toast.success('Civil Service Reform Act MCP server is online');
      }
    } catch (error) {
      console.error('Error checking MCP server status:', error);
      setMcpStatus(prev => ({ ...prev, civilServiceAct: false }));
      toast.warning('Civil Service Reform Act MCP server is offline');
    }
  };
  
  const fetchRegulations = async () => {
    try {
      setLoading(true);
      // In a real implementation, you would fetch from your API
      // const response = await api.getRegulations();
      
      // For now, use mock data
      const mockRegulations = [
        {
          regulationId: 'GDPR-2018',
          name: 'General Data Protection Regulation',
          description: 'EU data protection and privacy regulation',
          version: '1.0',
          lastCollected: null
        },
        {
          regulationId: 'HIPAA-2022',
          name: 'Health Insurance Portability and Accountability Act',
          description: 'US healthcare privacy regulation',
          version: '2.1',
          lastCollected: '2023-01-15T10:30:00Z'
        },
        {
          regulationId: 'CSRA-1978',
          name: 'Civil Service Reform Act of 1978',
          description: 'Federal civil service system reform that established OPM, MSPB, and FLRA',
          version: '1.0',
          lastCollected: null,
          mcpServer: CIVIL_SERVICE_ACT_MCP_SERVER_URL
        }
      ];
      
      setRegulations(mockRegulations);
    } catch (error) {
      console.error('Error fetching regulations:', error);
      toast.error('Error loading regulations');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegulationsUploaded = (newRegulations) => {
    setRegulations(prev => [...prev, ...newRegulations]);
  };
  
  const handleCollectData = (regulation) => {
    setSelectedRegulation(regulation);
    setSources('');
    setShowModal(true);
  };
  
  const startDataCollection = async () => {
    if (!selectedRegulation) {
      toast.error('No regulation selected');
      return;
    }
    
    setIsCollecting(true);
    
    try {
      // Check if this is the Civil Service Reform Act
      if (selectedRegulation.regulationId === 'CSRA-1978') {
        // For the Civil Service Act, use the MCP server directly instead of source URLs
        if (!mcpStatus.civilServiceAct) {
          toast.error('Civil Service Reform Act MCP server is offline');
          return;
        }
        
        // First initialize connection with the MCP server
        const initResponse = await axios.post(CIVIL_SERVICE_ACT_MCP_SERVER_URL, {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        });
        
        if (initResponse.data.error) {
          throw new Error(`MCP error: ${initResponse.data.error.message}`);
        }
        
        // Now get comprehensive information about the Act
        const infoResponse = await axios.post(CIVIL_SERVICE_ACT_MCP_SERVER_URL, {
          jsonrpc: '2.0',
          id: 2,
          method: 'getActInfo',
          params: {}
        });
        
        if (infoResponse.data.error) {
          throw new Error(`MCP error: ${infoResponse.data.error.message}`);
        }
        
        toast.success(`Successfully collected data for ${selectedRegulation.name}`);
        toast.info(`Public Law: ${infoResponse.data.result.public_law}`);
        
        // Update the regulation with collection date
        setRegulations(prev => 
          prev.map(reg => 
            reg.regulationId === selectedRegulation.regulationId 
              ? { ...reg, lastCollected: new Date().toISOString() } 
              : reg
          )
        );
      } else {
        // For other regulations, use the provided source URLs
        if (!sources.trim()) {
          toast.error('Please provide at least one data source URL');
          return;
        }
        
        const sourceUrls = sources
          .split('\n')
          .map(url => url.trim())
          .filter(url => url);
          
        if (sourceUrls.length === 0) {
          toast.error('Please provide at least one valid URL');
          return;
        }
        
        // In a real implementation, you would call your API
        // const response = await api.collectData(selectedRegulation.regulationId, sourceUrls);
        
        // For now, simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast.success(`Data collection initiated for ${selectedRegulation.name}`);
        
        // Update the regulation with collection date
        setRegulations(prev => 
          prev.map(reg => 
            reg.regulationId === selectedRegulation.regulationId 
              ? { ...reg, lastCollected: new Date().toISOString() } 
              : reg
          )
        );
      }
      
      setShowModal(false);
    } catch (error) {
      console.error('Error initiating data collection:', error);
      toast.error(`Error: ${error.message || 'Error initiating data collection'}`);
    } finally {
      setIsCollecting(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <RegulationManagerContainer>
      <Title>Regulation Manager</Title>
      
      <RegulationUploader onUploadComplete={handleRegulationsUploaded} />
      
      <h2>Existing Regulations</h2>
      
      {loading ? (
        <div>Loading regulations...</div>
      ) : regulations.length === 0 ? (
        <EmptyState>
          <p>No regulations found</p>
          <p>Upload an Excel file to add regulations</p>
        </EmptyState>
      ) : (
        <RegulationsTable>
          <TableHeader>
            <Cell>ID</Cell>
            <Cell>Name</Cell>
            <Cell>Description</Cell>
            <Cell>Last Collected</Cell>
            <Cell>Actions</Cell>
          </TableHeader>
          
          {regulations.map(regulation => (
            <TableRow key={regulation.regulationId}>
              <Cell>{regulation.regulationId}</Cell>
              <LinkCell as={Link} to={`/regulations/${regulation.regulationId}`}>
                {regulation.name}
              </LinkCell>
              <Cell>{regulation.description}</Cell>
              <Cell>{formatDate(regulation.lastCollected)}</Cell>
              <Cell>
                <Button 
                  as={Link} 
                  to={`/regulations/${regulation.regulationId}`}
                  primary
                >
                  View Details
                </Button>
                {regulation.regulationId === 'CSRA-1978' && (
                  <Button 
                    onClick={() => handleCollectData(regulation)}
                    disabled={!mcpStatus.civilServiceAct}
                    style={{ marginLeft: '8px' }}
                  >
                    {mcpStatus.civilServiceAct ? 'Run MCP Server' : 'MCP Server Offline'}
                  </Button>
                )}
                {regulation.regulationId !== 'CSRA-1978' && (
                  <Button 
                    onClick={() => handleCollectData(regulation)}
                    style={{ marginLeft: '8px' }}
                  >
                    Collect Data
                  </Button>
                )}
              </Cell>
            </TableRow>
          ))}
        </RegulationsTable>
      )}
      
      {showModal && (
        <SourcesModal>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Collect Data for {selectedRegulation.name}</ModalTitle>
              <CloseButton onClick={() => setShowModal(false)}>×</CloseButton>
            </ModalHeader>
            
            {selectedRegulation.regulationId === 'CSRA-1978' ? (
              <>
                <p>The Civil Service Reform Act data is provided by a dedicated MCP server.</p>
                <p>Clicking "Run MCP Server" will collect data about:</p>
                <ul>
                  <li>Basic Act information</li>
                  <li>Key provisions</li>
                  <li>Agencies created</li>
                  <li>Legal requirements</li>
                  <li>Related case law</li>
                </ul>
              </>
            ) : (
              <>
                <p>Enter the source URLs to collect data from (one per line):</p>
                <SourceInput>
                  <TextArea 
                    value={sources}
                    onChange={(e) => setSources(e.target.value)}
                    placeholder="https://example.com/regulation-page
https://example.com/another-page"
                  />
                </SourceInput>
                <p>The MCP orchestrator will process these URLs to create a baseline for {selectedRegulation.regulationId}.</p>
              </>
            )}
            
            <ButtonGroup>
              <Button onClick={() => setShowModal(false)}>Cancel</Button>
              <Button 
                primary 
                onClick={startDataCollection}
                disabled={isCollecting}
              >
                {isCollecting ? 'Processing...' : (selectedRegulation.regulationId === 'CSRA-1978' ? 'Run MCP Server' : 'Start Collection')}
              </Button>
            </ButtonGroup>
          </ModalContent>
        </SourcesModal>
      )}
    </RegulationManagerContainer>
  );
};

export default RegulationManager; 