import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import axios from 'axios';

const UploaderContainer = styled.div`
  margin-bottom: 30px;
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const Title = styled.h2`
  font-size: 20px;
  margin-bottom: 8px;
  color: ${props => props.theme.colors.text};
`;

const Description = styled.p`
  margin-bottom: 20px;
  color: ${props => props.theme.colors.textSecondary};
`;

const UploadArea = styled.div`
  border: 2px dashed ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background-color: ${props => props.theme.colors.hover};
  }
`;

const UploadIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const UploadText = styled.div`
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
  color: ${props => props.theme.colors.text};
`;

const UploadHint = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const FileInput = styled.input`
  display: none;
`;

const FilePreview = styled.div`
  margin-top: 24px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  background-color: ${props => props.theme.colors.backgroundAlt};
`;

const FileName = styled.div`
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DataPreview = styled.pre`
  background-color: ${props => props.theme.colors.codeBackground};
  color: ${props => props.theme.colors.codeText};
  padding: 12px;
  border-radius: 4px;
  overflow: auto;
  font-family: monospace;
  font-size: 12px;
  max-height: 200px;
`;

const Button = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const ProgressContainer = styled.div`
  margin-top: 20px;
`;

const ProgressBar = styled.div`
  height: 8px;
  background-color: ${props => props.theme.colors.backgroundAlt};
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${props => props.progress}%;
  background-color: ${props => props.theme.colors.primary};
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const UploadSummary = styled.div`
  margin-top: 20px;
  padding: 16px;
  border-radius: 8px;
  background-color: ${props => props.theme.colors.success}10;
  border: 1px solid ${props => props.theme.colors.success};
`;

const SummaryList = styled.ul`
  margin: 10px 0;
  padding-left: 20px;
`;

// Registry API endpoint
const REGISTRY_API_URL = 'http://localhost:3010/api/regulations';

// Normalize field names to camelCase
const normalizeFieldName = (name) => {
  if (!name) return '';
  
  // Remove special characters and spaces
  const cleanName = name.toString().replace(/[^\w\s]/gi, '').trim();
  
  // Convert to camelCase
  return cleanName
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
};

// Map Excel column names to expected regulation properties
const FIELD_MAPPINGS = {
  regulationId: ['regulationId', 'regulation_id', 'id', 'code'],
  name: ['name', 'regulation_name', 'title'],
  description: ['description', 'desc', 'summary'],
  version: ['version', 'versionNumber', 'version_number'],
  enactedDate: ['enacted', 'enactedDate', 'enacted_date', 'effectiveDate'],
  publicLaw: ['publicLaw', 'public_law', 'lawNumber', 'law_number'],
  category: ['category', 'type', 'regulationType'],
  status: ['status', 'state', 'activeStatus']
};

// Check if a field corresponds to a known property
const mapFieldToProperty = (fieldName) => {
  const normalized = normalizeFieldName(fieldName);
  
  for (const [propName, aliases] of Object.entries(FIELD_MAPPINGS)) {
    if (aliases.some(alias => 
      normalized === normalizeFieldName(alias) || 
      normalized.includes(normalizeFieldName(alias))
    )) {
      return propName;
    }
  }
  
  return normalized; // Return original if no mapping found
};

const EnhancedRegulationUploader = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [regulations, setRegulations] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSummary, setUploadSummary] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Check file extension
      if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
        toast.error('Please select an Excel file (.xlsx or .xls)');
        return;
      }
      
      setFile(selectedFile);
      parseExcelFile(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Check file extension
      if (!droppedFile.name.match(/\.(xlsx|xls)$/i)) {
        toast.error('Please drop an Excel file (.xlsx or .xls)');
        return;
      }
      
      setFile(droppedFile);
      parseExcelFile(droppedFile);
    }
  };

  const parseExcelFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // Parse the file
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          toast.error('No data found in the Excel file');
          return;
        }
        
        // Process the data
        const processedData = processRegulationData(jsonData);
        
        if (processedData.length === 0) {
          toast.error('Could not process any valid regulations from the file');
          return;
        }
        
        // Set regulations and preview
        setRegulations(processedData);
        setPreview(JSON.stringify(processedData.slice(0, 3), null, 2));
        toast.success(`Successfully parsed ${processedData.length} regulations`);
        
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        toast.error('Failed to parse Excel file. Please check the file format.');
      }
    };
    
    reader.onerror = () => {
      toast.error('Error reading file');
    };
    
    reader.readAsArrayBuffer(file);
  };
  
  // Process regulation data from Excel
  const processRegulationData = (jsonData) => {
    // First, determine which columns map to which properties
    const fieldMap = {};
    
    if (jsonData.length > 0) {
      const sampleRow = jsonData[0];
      const fields = Object.keys(sampleRow);
      
      fields.forEach(field => {
        const propName = mapFieldToProperty(field);
        fieldMap[field] = propName;
      });
    }
    
    // Process each row
    return jsonData.map(row => {
      const regulation = {};
      
      // Map fields according to field map
      Object.entries(row).forEach(([field, value]) => {
        const propName = fieldMap[field];
        if (propName) {
          regulation[propName] = value;
        }
      });
      
      // Ensure required fields
      if (!regulation.regulationId && regulation.name) {
        // Generate an ID from name if missing
        regulation.regulationId = regulation.name
          .replace(/[^a-zA-Z0-9]/g, '-')
          .toLowerCase()
          .substring(0, 50);
      }
      
      return regulation;
    }).filter(reg => reg.regulationId && reg.name); // Filter out invalid entries
  };

  const handleUpload = async () => {
    if (!regulations.length) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadSummary(null);
    
    try {
      // Submit regulations to the registry API
      const response = await axios.post(REGISTRY_API_URL, regulations);
      
      const { added, duplicates, errors } = response.data;
      
      // Update progress as we go
      setUploadProgress(100);
      
      // Set upload summary
      setUploadSummary({
        total: regulations.length,
        added: added.length,
        duplicates: duplicates.length,
        errors: errors.length
      });
      
      // Show toast with summary
      toast.success(`Added ${added.length} regulations to the registry`);
      
      if (duplicates.length > 0) {
        toast.info(`${duplicates.length} regulations were already in the registry`);
      }
      
      if (errors.length > 0) {
        toast.warning(`${errors.length} regulations could not be added due to errors`);
      }
      
      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(regulations, response.data);
      }
      
    } catch (error) {
      console.error('Error uploading regulations:', error);
      toast.error('Failed to upload regulations to the registry');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <UploaderContainer>
      <Title>Upload Regulations for MCP</Title>
      <Description>
        Upload an Excel file containing regulation data. Each regulation will be registered with MCP
        and can have its own dedicated MCP server.
      </Description>
      
      <UploadArea 
        onClick={triggerFileInput}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <UploadIcon>📄</UploadIcon>
        <UploadText>Drag and drop your Excel file here</UploadText>
        <UploadHint>or click to browse files</UploadHint>
        <FileInput 
          type="file" 
          accept=".xlsx,.xls" 
          onChange={handleFileSelect}
          ref={fileInputRef}
        />
      </UploadArea>
      
      {file && preview && (
        <FilePreview>
          <FileName>
            <span>{file.name}</span>
            <span>{regulations.length} regulations found</span>
          </FileName>
          
          <DataPreview>
            {preview}
          </DataPreview>
          
          {isUploading && (
            <ProgressContainer>
              <ProgressBar>
                <ProgressFill progress={uploadProgress} />
              </ProgressBar>
              <ProgressText>
                <span>Processing regulations...</span>
                <span>{uploadProgress}%</span>
              </ProgressText>
            </ProgressContainer>
          )}
          
          {uploadSummary && (
            <UploadSummary>
              <strong>Upload Complete</strong>
              <SummaryList>
                <li>Added {uploadSummary.added} new regulations</li>
                <li>Skipped {uploadSummary.duplicates} duplicate regulations</li>
                {uploadSummary.errors > 0 && (
                  <li>Failed to add {uploadSummary.errors} regulations due to errors</li>
                )}
              </SummaryList>
            </UploadSummary>
          )}
          
          <div style={{ marginTop: '15px', textAlign: 'right' }}>
            <Button 
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Register Regulations with MCP'}
            </Button>
          </div>
        </FilePreview>
      )}
    </UploaderContainer>
  );
};

export default EnhancedRegulationUploader; 