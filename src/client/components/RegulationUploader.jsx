import React, { useState } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const UploaderContainer = styled.div`
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  font-size: 20px;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.text};
`;

const Description = styled.p`
  margin-bottom: 20px;
  color: ${props => props.theme.colors.textSecondary};
`;

const UploadArea = styled.div`
  border: 2px dashed ${props => props.theme.colors.border};
  border-radius: 6px;
  padding: 30px;
  text-align: center;
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background-color: ${props => props.isDark ? 'rgba(0, 112, 243, 0.05)' : 'rgba(0, 112, 243, 0.05)'};
  }
`;

const UploadIcon = styled.div`
  font-size: 40px;
  margin-bottom: 10px;
  color: ${props => props.theme.colors.secondary};
`;

const UploadText = styled.div`
  margin-bottom: 10px;
  font-weight: 500;
`;

const UploadHint = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const FileInput = styled.input`
  display: none;
`;

const Button = styled.button`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
  
  &:disabled {
    background-color: ${props => props.theme.colors.secondary};
    cursor: not-allowed;
  }
`;

const FilePreview = styled.div`
  margin-top: 20px;
  padding: 15px;
  background-color: ${props => props.theme.colors.background};
  border-radius: 6px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const FileName = styled.div`
  font-weight: 500;
  margin-bottom: 5px;
`;

const DataPreview = styled.div`
  margin-top: 10px;
  max-height: 200px;
  overflow-y: auto;
  font-family: ${props => props.theme.fonts.monospace};
  font-size: 13px;
  background-color: ${props => props.isDark ? '#1e293b' : '#f8f9fa'};
  padding: 10px;
  border-radius: 4px;
  white-space: pre-wrap;
`;

// Utility function to convert excel column letter to number
const colToNum = (col) => {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
};

// Utility function to convert number to excel column letter
const numToCol = (num) => {
  let str = '';
  while (num > 0) {
    const modulo = (num - 1) % 26;
    str = String.fromCharCode(modulo + 65) + str;
    num = Math.floor((num - modulo) / 26);
  }
  return str;
};

// Utility function to try to infer the correct fields
const inferFields = (data, requiredFields) => {
  if (!data || !data[0]) return null;
  
  const availableFields = Object.keys(data[0]);
  const mapping = {};
  
  // Try to match required fields with available fields using fuzzy matching
  requiredFields.forEach(required => {
    const normalizedRequired = required.toLowerCase();
    
    // Look for exact match first
    let match = availableFields.find(field => 
      field.toLowerCase() === normalizedRequired);
    
    // If no exact match, look for partial match
    if (!match) {
      match = availableFields.find(field => 
        field.toLowerCase().includes(normalizedRequired) || 
        normalizedRequired.includes(field.toLowerCase()));
    }
    
    if (match) {
      mapping[required] = match;
    }
  });
  
  // If we didn't find all fields, return null
  if (Object.keys(mapping).length !== requiredFields.length) {
    return null;
  }
  
  // Apply mapping to create a properly formatted dataset
  return data.map(row => {
    const newRow = {};
    Object.keys(mapping).forEach(required => {
      newRow[required] = row[mapping[required]];
    });
    return newRow;
  });
};

const RegulationUploader = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [regulations, setRegulations] = useState([]);
  const fileInputRef = React.useRef();
  
  // Maximum file size (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    
    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE/1024/1024}MB`);
      return;
    }
    
    setFile(selectedFile);
    parseExcelFile(selectedFile);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    
    if (e.dataTransfer.files.length) {
      const droppedFile = e.dataTransfer.files[0];
      
      if (!droppedFile.name.endsWith('.xlsx') && !droppedFile.name.endsWith('.xls')) {
        toast.error('Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      
      // Check file size
      if (droppedFile.size > MAX_FILE_SIZE) {
        toast.error(`File is too large. Maximum size is ${MAX_FILE_SIZE/1024/1024}MB`);
        return;
      }
      
      setFile(droppedFile);
      parseExcelFile(droppedFile);
    }
  };
  
  const parseExcelFile = (file) => {
    console.log('Starting to parse Excel file:', file.name, 'size:', file.size, 'bytes', 'type:', file.type);
    toast.info('Parsing Excel file...');
    
    const parseExcelData = (data, type) => {
      try {
        console.log(`Parsing Excel data with type: ${type}`);
        
        // Configure parsing options for better reliability
        const workbookOptions = { 
          type: type,
          cellDates: true,
          cellNF: false,
          cellText: false,
          raw: true, 
          dense: true
        };
        
        // Parse the workbook
        const workbook = XLSX.read(data, workbookOptions);
        console.log('Workbook parsed successfully, sheets:', workbook.SheetNames);
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          console.error('No sheets found in workbook');
          toast.error('Excel file does not contain any sheets');
          return null;
        }
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        console.log('Using sheet:', firstSheetName);
        
        // Get data as array with headers
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: true,
          blankrows: false
        });
        
        console.log('Raw data rows:', rawData.length);
        
        if (!rawData || rawData.length < 2) {
          console.error('Not enough rows in data:', rawData);
          toast.error('No data found in the Excel file. Make sure it has headers and at least one row of data.');
          return null;
        }
        
        // Get headers from first row
        const headers = rawData[0].map(h => h ? String(h).trim() : '');
        console.log('Headers:', headers);
        
        // Check if any headers are empty or undefined
        if (headers.some(h => !h)) {
          console.error('Empty headers found:', headers);
          toast.error('Your Excel file contains empty column headers. All columns need headers.');
          return null;
        }
        
        // Create objects from rows
        const rows = rawData.slice(1);
        const jsonData = rows.map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            if (header && i < row.length) {
              obj[header] = row[i] !== undefined ? row[i] : '';
            }
          });
          return obj;
        });
        
        console.log('JSON data objects:', jsonData.length, 'Sample:', jsonData[0]);
        
        // Process the data for required fields
        return processJsonData(jsonData);
      } catch (error) {
        console.error(`Error parsing Excel with ${type}:`, error);
        return null;
      }
    };
    
    const processJsonData = (jsonData) => {
      if (!jsonData || jsonData.length === 0) {
        console.error('No JSON data to process');
        return null;
      }
      
      // Define required fields
      const requiredFields = ['name', 'description', 'version', 'regulationId'];
      
      // Check available fields
      const availableFields = Object.keys(jsonData[0]);
      console.log('Available fields:', availableFields);
      
      // Check for name field (case insensitive)
      const hasNameField = availableFields.some(f => 
        f.toLowerCase() === 'name'
      );
      
      if (!hasNameField) {
        console.error('No name field found in:', availableFields);
        toast.error('Excel file must contain a column named "Name" or "name"');
        return null;
      }
      
      // Map field names
      const fieldMap = {};
      requiredFields.forEach(reqField => {
        // Exact match (case insensitive)
        let match = availableFields.find(f => 
          f.toLowerCase() === reqField.toLowerCase());
        
        // Partial match if no exact match found
        if (!match) {
          match = availableFields.find(f => 
            f.toLowerCase().includes(reqField.toLowerCase()) || 
            reqField.toLowerCase().includes(f.toLowerCase()));
        }
        
        if (match) {
          fieldMap[reqField] = match;
          console.log(`Mapped ${reqField} to ${match}`);
        } else {
          console.log(`No match found for ${reqField}`);
        }
      });
      
      // Process data with mappings
      if (fieldMap.name) {
        const processedData = jsonData.map((item, index) => {
          const newItem = {};
          
          // Add mapped fields
          Object.keys(fieldMap).forEach(reqField => {
            newItem[reqField] = item[fieldMap[reqField]] || '';
          });
          
          // Add default values for missing fields
          if (!newItem.regulationId) {
            newItem.regulationId = `reg_${Date.now()}_${index}`;
          }
          
          if (!newItem.description) {
            newItem.description = `Description for ${newItem.name}`;
          }
          
          if (!newItem.version) {
            newItem.version = '1.0.0';
          }
          
          return newItem;
        });
        
        // Validate data (ensure name exists and is not empty)
        const validData = processedData.filter(item => {
          if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
            console.log('Skipping item with invalid name:', item);
            return false;
          }
          return true;
        });
        
        if (validData.length === 0) {
          console.error('No valid data after filtering');
          toast.error('No valid regulations found in the Excel file. Each regulation must have a name.');
          return null;
        }
        
        return validData;
      }
      
      return null;
    };
    
    // Try different methods in sequence
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // Try parsing as binary string first (most reliable method)
        const binaryReader = new FileReader();
        
        binaryReader.onload = (binaryEvent) => {
          const binaryString = binaryEvent.target.result;
          console.log('Binary string read, length:', binaryString.length);
          
          // Try to parse with binary string
          const binaryData = parseExcelData(binaryString, 'binary');
          
          if (binaryData) {
            // Success!
            console.log('Binary string parsing successful');
            setRegulations(binaryData);
            setPreview(JSON.stringify(binaryData.slice(0, 3), null, 2));
            toast.success(`Successfully parsed ${binaryData.length} regulations`);
            return;
          }
          
          // If binary string fails, try array buffer as last resort
          console.log('Binary string parsing failed, trying array buffer');
          const arrayBuffer = e.target.result;
          
          try {
            const arrayData = parseExcelData(new Uint8Array(arrayBuffer), 'array');
            
            if (arrayData) {
              // Success with array buffer
              console.log('Array buffer parsing successful');
              setRegulations(arrayData);
              setPreview(JSON.stringify(arrayData.slice(0, 3), null, 2));
              toast.success(`Successfully parsed ${arrayData.length} regulations`);
            } else {
              console.error('All parsing methods failed');
              toast.error('Could not parse this Excel file. Please check the file format and try again.');
            }
          } catch (arrayError) {
            console.error('Array buffer parsing error:', arrayError);
            toast.error('Failed to process the Excel file. Please try a simpler file format.');
          }
        };
        
        binaryReader.onerror = (error) => {
          console.error('Binary reader error:', error);
          toast.error('Could not read the Excel file');
        };
        
        // Read the file as binary string
        binaryReader.readAsBinaryString(file);
        
      } catch (error) {
        console.error('Top-level error during Excel parsing:', error);
        toast.error(`Could not process Excel file: ${error.message || 'Unknown error'}`);
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      toast.error('Error reading file. Please try a different file.');
    };
    
    // Initial read as array buffer (for later use if needed)
    reader.readAsArrayBuffer(file);
  };
  
  const handleUpload = async () => {
    if (!regulations.length) return;
    
    setIsUploading(true);
    
    try {
      // In a real implementation, you would call your API here
      // const response = await api.uploadRegulations(regulations);
      
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success(`Successfully uploaded ${regulations.length} regulations`);
      
      if (onUploadComplete) {
        onUploadComplete(regulations);
      }
      
      // Reset state after successful upload
      setFile(null);
      setPreview(null);
      setRegulations([]);
    } catch (error) {
      console.error('Error uploading regulations:', error);
      toast.error('Error uploading regulations');
    } finally {
      setIsUploading(false);
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };
  
  return (
    <UploaderContainer>
      <Title>Upload Regulations</Title>
      <Description>
        Upload an Excel file containing regulation data. Each row should represent a regulation with
        its required properties.
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
          <FileName>{file.name}</FileName>
          <div>{regulations.length} regulations found</div>
          <DataPreview>
            {preview}
          </DataPreview>
          
          <div style={{ marginTop: '15px', textAlign: 'right' }}>
            <Button 
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Process Regulations'}
            </Button>
          </div>
        </FilePreview>
      )}
    </UploaderContainer>
  );
};

export default RegulationUploader; 