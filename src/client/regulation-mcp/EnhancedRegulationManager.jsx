import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

import RegulationMCPClient from './RegulationMCPClient';
import RegulationUploader from '../components/RegulationUploader';

// Styled components
const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 20px;
`;

const Button = styled.button`
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  margin: 10px 5px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;

  &:hover {
    background-color: #45a049;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
`;

const Th = styled.th`
  padding: 12px 15px;
  text-align: left;
  background-color: #f2f2f2;
  color: #333;
  font-weight: bold;
  border-bottom: 2px solid #ddd;
`;

const Td = styled.td`
  padding: 12px 15px;
  border-bottom: 1px solid #ddd;
`;

const Tr = styled.tr`
  &:hover {
    background-color: #f5f5f5;
  }
`;

const Modal = styled.div`
  display: ${props => props.show ? 'block' : 'none'};
  position: fixed;
  z-index: 1;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
`;

const ModalContent = styled.div`
  background-color: white;
  margin: 10% auto;
  padding: 20px;
  border-radius: 5px;
  width: 60%;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #333;
`;

const CloseButton = styled.span`
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  
  &:hover {
    color: #000;
  }
`;

const ModalBody = styled.div`
  margin-bottom: 20px;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  height: 100px;
  resize: vertical;
  box-sizing: border-box;
`;

const QueryContainer = styled.div`
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  background-color: #f9f9f9;
`;

const QueryInput = styled.textarea`
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  height: 100px;
  resize: vertical;
  box-sizing: border-box;
`;

const ResponseDisplay = styled.div`
  margin-top: 15px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
`;

const JsonInput = styled.textarea`
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  height: 300px;
  resize: vertical;
  font-family: monospace;
  font-size: 14px;
`;

const ErrorMessage = styled.div`
  color: red;
  margin: 10px 0;
  padding: 10px;
  border: 1px solid red;
  border-radius: 4px;
  background-color: #fff0f0;
  display: ${props => props.show ? 'block' : 'none'};
`;

const InstructionText = styled.div`
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border-left: 4px solid #4CAF50;
`;

const EnhancedRegulationManager = () => {
  // State management
  const [regulations, setRegulations] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDataCollectionModal, setShowDataCollectionModal] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [sourceUrls, setSourceUrls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [queryResponse, setQueryResponse] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Fetch regulations on component mount
  useEffect(() => {
    fetchRegulations();
  }, []);

  // Fetch regulations from the MCP Registry
  const fetchRegulations = async () => {
    setIsLoading(true);
    try {
      const data = await RegulationMCPClient.getRegulations();
      setRegulations(data);
    } catch (error) {
      toast.error('Failed to fetch regulations');
      console.error('Error fetching regulations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle uploaded regulations
  const handleUploadedRegulations = async (regulationsData) => {
    setIsLoading(true);
    try {
      const response = await RegulationMCPClient.addRegulations(regulationsData);
      toast.success(`Successfully processed ${response.added} regulations`);
      fetchRegulations();
    } catch (error) {
      toast.error('Failed to upload regulations');
      console.error('Error uploading regulations:', error);
    } finally {
      setIsLoading(false);
      setShowUploadModal(false);
    }
  };

  // Handle data collection
  const handleDataCollection = async () => {
    if (!selectedRegulation || !sourceUrls.trim()) {
      toast.error('Please select a regulation and provide source URLs');
      return;
    }

    setIsLoading(true);
    try {
      // The URLs are split by newlines to create an array
      const urls = sourceUrls.split('\n').filter(url => url.trim() !== '');
      
      // Call the collectData method on the client
      await RegulationMCPClient.collectData(selectedRegulation.regulationId, urls);
      
      toast.success('Data collection initiated successfully');
      fetchRegulations();
    } catch (error) {
      toast.error('Failed to initiate data collection');
      console.error('Error initiating data collection:', error);
    } finally {
      setIsLoading(false);
      setShowDataCollectionModal(false);
      setSourceUrls('');
      setSelectedRegulation(null);
    }
  };

  // Handle regulation query
  const handleQuery = async () => {
    if (!selectedRegulation || !queryText.trim()) {
      toast.error('Please select a regulation and enter a query');
      return;
    }

    setIsLoading(true);
    try {
      const response = await RegulationMCPClient.queryRegulation(
        selectedRegulation.regulationId, 
        queryText
      );
      setQueryResponse(response);
      toast.success('Query completed successfully');
    } catch (error) {
      toast.error('Failed to execute query');
      console.error('Error executing query:', error);
      setQueryResponse({ error: 'Failed to execute query' });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a regulation
  const handleDeleteRegulation = async (regulationId) => {
    if (window.confirm('Are you sure you want to delete this regulation?')) {
      setIsLoading(true);
      try {
        await RegulationMCPClient.deleteRegulation(regulationId);
        toast.success('Regulation deleted successfully');
        fetchRegulations();
      } catch (error) {
        toast.error('Failed to delete regulation');
        console.error('Error deleting regulation:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Open query interface for a regulation
  const openQueryInterface = (regulation) => {
    setSelectedRegulation(regulation);
    setQueryText('');
    setQueryResponse(null);
    setShowQueryModal(true);
  };

  // Open data collection modal for a regulation
  const openDataCollectionModal = (regulation) => {
    setSelectedRegulation(regulation);
    setSourceUrls('');
    setShowDataCollectionModal(true);
  };

  // Handle JSON input for adding regulations
  const handleJsonSubmit = async () => {
    setJsonError('');
    
    try {
      // Try to parse the JSON
      let regulationsData;
      try {
        regulationsData = JSON.parse(jsonInput);
      } catch (error) {
        setJsonError('Invalid JSON format: ' + error.message);
        return;
      }
      
      // Validate that it's an object or array with required fields
      if (!regulationsData) {
        setJsonError('Empty JSON data');
        return;
      }
      
      // Convert to array if it's a single object
      if (!Array.isArray(regulationsData)) {
        regulationsData = [regulationsData];
      }
      
      // Validate each regulation has at least a name
      if (!regulationsData.every(reg => reg && reg.name)) {
        setJsonError('Each regulation must have at least a name field');
        return;
      }
      
      // Add default fields if missing
      const processedData = regulationsData.map((reg, index) => ({
        regulationId: reg.regulationId || `reg_${Date.now()}_${index}`,
        version: reg.version || '1.0.0',
        description: reg.description || `Description for ${reg.name}`,
        ...reg
      }));
      
      setIsLoading(true);
      
      // Submit the data
      try {
        const response = await RegulationMCPClient.addRegulations(processedData);
        toast.success(`Successfully added ${response.added} regulations`);
        fetchRegulations();
        setShowJsonModal(false);
        setJsonInput('');
      } catch (error) {
        console.error('Error adding regulations:', error);
        setJsonError('Failed to add regulations: ' + (error.message || 'Server error'));
      } finally {
        setIsLoading(false);
      }
      
    } catch (error) {
      console.error('Error processing JSON:', error);
      setJsonError('Error processing JSON: ' + error.message);
    }
  };
  
  // Create a sample JSON template
  const createSampleJson = () => {
    const sample = [
      {
        "name": "GDPR",
        "description": "General Data Protection Regulation",
        "version": "2018",
        "enactedDate": "2018-05-25"
      },
      {
        "name": "HIPAA",
        "description": "Health Insurance Portability and Accountability Act",
        "version": "1996",
        "enactedDate": "1996-08-21"
      }
    ];
    
    setJsonInput(JSON.stringify(sample, null, 2));
  };

  // Render the component
  return (
    <Container>
      <ToastContainer position="top-right" autoClose={5000} />
      <Title>Regulation MCP Manager</Title>
      
      <Button onClick={() => setShowUploadModal(true)} style={{ marginRight: '10px' }}>
        Upload Regulations (Excel)
      </Button>
      
      <Button onClick={() => setShowJsonModal(true)}>
        Add Regulations (JSON)
      </Button>
      
      <Table>
        <thead>
          <Tr>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Version</Th>
            <Th>Enacted Date</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </thead>
        <tbody>
          {regulations.map(regulation => (
            <Tr key={regulation.regulationId}>
              <Td>{regulation.regulationId}</Td>
              <Td>{regulation.name}</Td>
              <Td>{regulation.version || 'N/A'}</Td>
              <Td>{regulation.enactedDate || 'N/A'}</Td>
              <Td>{regulation.status || 'Pending'}</Td>
              <Td>
                <Button onClick={() => openQueryInterface(regulation)}>
                  Query
                </Button>
                <Button onClick={() => openDataCollectionModal(regulation)}>
                  Collect Data
                </Button>
                <Button onClick={() => handleDeleteRegulation(regulation.regulationId)}>
                  Delete
                </Button>
              </Td>
            </Tr>
          ))}
          {regulations.length === 0 && !isLoading && (
            <Tr>
              <Td colSpan="6" style={{ textAlign: 'center' }}>
                No regulations found. Upload some regulations to get started.
              </Td>
            </Tr>
          )}
          {isLoading && (
            <Tr>
              <Td colSpan="6" style={{ textAlign: 'center' }}>
                Loading...
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>

      {/* Upload Modal */}
      <Modal show={showUploadModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Upload Regulations</ModalTitle>
            <CloseButton onClick={() => setShowUploadModal(false)}>&times;</CloseButton>
          </ModalHeader>
          <ModalBody>
            <RegulationUploader onUploaded={handleUploadedRegulations} />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Data Collection Modal */}
      <Modal show={showDataCollectionModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              Collect Data for {selectedRegulation?.name}
            </ModalTitle>
            <CloseButton onClick={() => setShowDataCollectionModal(false)}>&times;</CloseButton>
          </ModalHeader>
          <ModalBody>
            <p>
              Enter URLs to collect data from. Each URL should be on a new line.
              The MCP orchestrator will process these URLs to gather information about the regulation.
            </p>
            <TextArea
              value={sourceUrls}
              onChange={(e) => setSourceUrls(e.target.value)}
              placeholder="https://example.com/regulation-data&#10;https://another-example.com/more-data"
            />
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowDataCollectionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleDataCollection} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Start Collection'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Query Modal */}
      <Modal show={showQueryModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              Query {selectedRegulation?.name}
            </ModalTitle>
            <CloseButton onClick={() => setShowQueryModal(false)}>&times;</CloseButton>
          </ModalHeader>
          <ModalBody>
            <QueryContainer>
              <h3>Enter your query:</h3>
              <QueryInput
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="E.g., What are the data subject rights under this regulation?"
              />
              <Button onClick={handleQuery} disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Execute Query'}
              </Button>

              {queryResponse && (
                <>
                  <h3>Response:</h3>
                  <ResponseDisplay>
                    {typeof queryResponse === 'object' 
                      ? JSON.stringify(queryResponse, null, 2)
                      : queryResponse}
                  </ResponseDisplay>
                </>
              )}
            </QueryContainer>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowQueryModal(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* JSON Input Modal */}
      <Modal show={showJsonModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Regulations via JSON</ModalTitle>
            <CloseButton onClick={() => setShowJsonModal(false)}>&times;</CloseButton>
          </ModalHeader>
          <ModalBody>
            <InstructionText>
              Enter JSON data for regulations. Each regulation should have at least a "name" field.
              Other fields like "description", "version", and "regulationId" are optional.
            </InstructionText>
            
            <Button onClick={createSampleJson} style={{ marginBottom: '10px' }}>
              Insert Sample JSON
            </Button>
            
            <JsonInput 
              value={jsonInput} 
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[
  {
    "name": "Regulation Name",
    "description": "Description",
    "version": "1.0"
  }
]'
            />
            
            <ErrorMessage show={!!jsonError}>
              {jsonError}
            </ErrorMessage>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowJsonModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleJsonSubmit} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Add Regulations'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default EnhancedRegulationManager; 