import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';

// Styled Components
const Container = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  margin-bottom: 2rem;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: ${props => props.theme.colors.primary};
  color: white;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  
  &:hover {
    opacity: 0.8;
  }
`;

const Body = styled.div`
  max-height: ${props => (props.isOpen ? '1500px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
  padding: ${props => (props.isOpen ? '1.5rem' : '0')};
`;

const DropZone = styled.div`
  border: 2px dashed ${props => props.isDragActive ? props.theme.colors.primary : props.theme.colors.border};
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background-color: ${props => props.isDragActive ? 'rgba(99, 102, 241, 0.05)' : props.theme.colors.backgroundDark};
  transition: all 0.2s;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background-color: rgba(99, 102, 241, 0.05);
  }
`;

const DropzoneText = styled.p`
  margin-bottom: 1rem;
  font-size: 1.1rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const BrowseButton = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
`;

const FileList = styled.div`
  margin-top: 1.5rem;
`;

const FileListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const FileCount = styled.div`
  font-weight: 500;
  color: ${props => props.theme.colors.text};
`;

const ClearButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    text-decoration: underline;
  }
`;

const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: ${props => props.theme.colors.backgroundDark};
  border-radius: 4px;
  margin-bottom: 0.5rem;
  
  &:hover {
    background-color: ${props => props.theme.colors.backgroundLight};
  }
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  max-width: 70%;
`;

const FileIcon = styled.div`
  margin-right: 0.75rem;
  color: ${props => props.theme.colors.primary};
  flex-shrink: 0;
`;

const FileName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSize = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.85rem;
  margin-top: 0.25rem;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.error};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  
  &:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }
`;

const ControlsSection = styled.div`
  margin-top: 1.5rem;
  border-top: 1px solid ${props => props.theme.colors.border};
  padding-top: 1.5rem;
`;

const RegulationSelect = styled.div`
  margin-bottom: 1.5rem;
`;

const SelectLabel = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text};
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 0.9rem;
  background-color: white;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
`;

const ActionButton = styled.button`
  flex: 1;
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
  }
`;

const ProgressSection = styled.div`
  margin-top: 1.5rem;
  display: ${props => props.isVisible ? 'block' : 'none'};
`;

const ProgressHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const ProgressText = styled.div`
  font-weight: 500;
`;

const ProgressBar = styled.div`
  height: 8px;
  background-color: ${props => props.theme.colors.backgroundDark};
  border-radius: 4px;
  margin-bottom: 1rem;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${props => props.progress}%;
  background-color: ${props => props.theme.colors.primary};
  transition: width 0.3s ease;
`;

const ResultsSection = styled.div`
  margin-top: 1.5rem;
  border-top: 1px solid ${props => props.theme.colors.border};
  padding-top: 1.5rem;
  display: ${props => props.isVisible ? 'block' : 'none'};
`;

const ResultsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ResultsTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
`;

const ResultsActions = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const ResultsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHead = styled.thead`
  background-color: ${props => props.theme.colors.backgroundDark};
`;

const TableHeader = styled.th`
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 500;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const TableBody = styled.tbody`
  background-color: white;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:hover {
    background-color: ${props => props.theme.colors.backgroundLight};
  }
`;

const TableCell = styled.td`
  padding: 0.75rem 1rem;
  vertical-align: middle;
`;

const ComplianceStatus = styled.span`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  background-color: ${props => {
    switch (props.status) {
      case 'compliant':
        return 'rgba(16, 185, 129, 0.1)';
      case 'partial':
        return 'rgba(245, 158, 11, 0.1)';
      case 'non-compliant':
        return 'rgba(239, 68, 68, 0.1)';
      default:
        return 'rgba(107, 114, 128, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'compliant':
        return '#10b981';
      case 'partial':
        return '#f59e0b';
      case 'non-compliant':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }};
`;

const ActionLink = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  
  &:hover {
    text-decoration: underline;
  }
`;

// Mock regulations for testing
const mockRegulations = [
  { id: 'gdpr', name: 'GDPR', description: 'General Data Protection Regulation' },
  { id: 'hipaa', name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
  { id: 'ccpa', name: 'CCPA', description: 'California Consumer Privacy Act' },
  { id: 'pci-dss', name: 'PCI DSS', description: 'Payment Card Industry Data Security Standard' },
  { id: 'iso27001', name: 'ISO 27001', description: 'Information Security Management' },
];

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const BatchTestingPanel = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [files, setFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedRegulation, setSelectedRegulation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);
  
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);
  
  const handleFiles = (newFiles) => {
    // Convert FileList to array and add unique IDs
    const filesWithIds = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    
    setFiles(prevFiles => [...prevFiles, ...filesWithIds]);
    toast.success(`Added ${filesWithIds.length} file(s)`);
  };
  
  const handleFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    // Reset the input
    e.target.value = '';
  };
  
  const openFileDialog = () => {
    fileInputRef.current.click();
  };
  
  const handleRemoveFile = (id) => {
    setFiles(files.filter(file => file.id !== id));
  };
  
  const handleClearFiles = () => {
    setFiles([]);
    setResults([]);
    setShowResults(false);
  };
  
  const handleRegulationChange = (e) => {
    setSelectedRegulation(e.target.value);
  };
  
  const generateRandomStatus = () => {
    const statuses = ['compliant', 'partial', 'non-compliant'];
    const randomIndex = Math.floor(Math.random() * statuses.length);
    return statuses[randomIndex];
  };
  
  const handleStartProcessing = () => {
    if (files.length === 0 || !selectedRegulation) {
      toast.error('Please select files and a regulation');
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    setShowResults(false);
    
    // Mock processing
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          generateResults();
          return 100;
        }
        return prev + 5;
      });
    }, 200);
  };
  
  const generateResults = () => {
    const newResults = files.map(file => ({
      id: file.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      status: generateRandomStatus(),
      regulation: selectedRegulation,
      timestamp: new Date().toISOString(),
      details: {
        issues: Math.floor(Math.random() * 10),
        warnings: Math.floor(Math.random() * 5),
        passedRules: Math.floor(Math.random() * 20) + 10,
      }
    }));
    
    setResults(newResults);
    setIsProcessing(false);
    setShowResults(true);
    
    const summary = {
      total: newResults.length,
      compliant: newResults.filter(r => r.status === 'compliant').length,
      partial: newResults.filter(r => r.status === 'partial').length,
      nonCompliant: newResults.filter(r => r.status === 'non-compliant').length,
    };
    
    toast.success(`Processed ${summary.total} files: ${summary.compliant} compliant, ${summary.partial} partially compliant, ${summary.nonCompliant} non-compliant`);
  };
  
  const handleViewDetails = (id) => {
    const result = results.find(r => r.id === id);
    console.log('View details for:', result);
    // In a real app, this would open a modal with detailed results
    toast.info(`Viewing details for ${result.fileName}`);
  };
  
  const handleExportResults = () => {
    // Create a JSON blob and download it
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-results-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Results exported successfully');
  };
  
  return (
    <Container>
      <Header>
        <Title>Batch Testing Panel</Title>
        <ToggleButton onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? 'Collapse' : 'Expand'}
        </ToggleButton>
      </Header>
      
      <Body isOpen={isOpen}>
        <DropZone 
          isDragActive={isDragActive}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <DropzoneText>
            Drag & drop files here, or click to select
          </DropzoneText>
          <BrowseButton onClick={openFileDialog}>
            Browse Files
          </BrowseButton>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
            multiple
          />
        </DropZone>
        
        {files.length > 0 && (
          <FileList>
            <FileListHeader>
              <FileCount>{files.length} file(s) selected</FileCount>
              <ClearButton onClick={handleClearFiles}>Clear All</ClearButton>
            </FileListHeader>
            
            {files.map(file => (
              <FileItem key={file.id}>
                <FileInfo>
                  <FileIcon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
                    </svg>
                  </FileIcon>
                  <div>
                    <FileName>{file.name}</FileName>
                    <FileSize>{formatFileSize(file.size)}</FileSize>
                  </div>
                </FileInfo>
                <RemoveButton onClick={() => handleRemoveFile(file.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                  </svg>
                </RemoveButton>
              </FileItem>
            ))}
          </FileList>
        )}
        
        <ControlsSection>
          <RegulationSelect>
            <SelectLabel>Select Regulation for Testing</SelectLabel>
            <Select 
              value={selectedRegulation} 
              onChange={handleRegulationChange}
              disabled={isProcessing}
            >
              <option value="">Select a regulation...</option>
              {mockRegulations.map(reg => (
                <option key={reg.id} value={reg.id}>
                  {reg.name} - {reg.description}
                </option>
              ))}
            </Select>
          </RegulationSelect>
          
          <ButtonGroup>
            <ActionButton 
              onClick={handleStartProcessing} 
              disabled={files.length === 0 || !selectedRegulation || isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Start Batch Processing'}
            </ActionButton>
          </ButtonGroup>
        </ControlsSection>
        
        <ProgressSection isVisible={isProcessing}>
          <ProgressHeader>
            <ProgressText>Processing files...</ProgressText>
            <div>{progress}%</div>
          </ProgressHeader>
          <ProgressBar>
            <ProgressFill progress={progress} />
          </ProgressBar>
        </ProgressSection>
        
        <ResultsSection isVisible={showResults}>
          <ResultsHeader>
            <ResultsTitle>Processing Results</ResultsTitle>
            <ResultsActions>
              <ActionButton onClick={handleExportResults}>
                Export Results
              </ActionButton>
            </ResultsActions>
          </ResultsHeader>
          
          <ResultsTable>
            <TableHead>
              <tr>
                <TableHeader>File Name</TableHeader>
                <TableHeader>Size</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {results.map(result => (
                <TableRow key={result.id}>
                  <TableCell>{result.fileName}</TableCell>
                  <TableCell>{formatFileSize(result.fileSize)}</TableCell>
                  <TableCell>
                    <ComplianceStatus status={result.status}>
                      {result.status === 'compliant' && 'Compliant'}
                      {result.status === 'partial' && 'Partially Compliant'}
                      {result.status === 'non-compliant' && 'Non-Compliant'}
                    </ComplianceStatus>
                  </TableCell>
                  <TableCell>
                    <ActionLink onClick={() => handleViewDetails(result.id)}>
                      View Details
                    </ActionLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResultsTable>
        </ResultsSection>
      </Body>
    </Container>
  );
};

export default BatchTestingPanel; 