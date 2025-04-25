import React, { useState } from 'react';
import '../styles/ValidationComponents.css';

const VALIDATION_LEVELS = [
  { id: 'level1', name: 'Basic (Level 1)', description: 'Simple pattern matching and text validation' },
  { id: 'level2', name: 'Semantic (Level 2)', description: 'NLP-based semantic understanding' },
  { id: 'level3', name: 'Structural (Level 3)', description: 'Complex document structure validation' },
  { id: 'level4', name: 'Advanced (Level 4)', description: 'Cross-document and temporal validation' }
];

const ValidationForm = ({ onSubmit, isLoading }) => {
  const [documentData, setDocumentData] = useState('');
  const [regulationId, setRegulationId] = useState('');
  const [selectedLevels, setSelectedLevels] = useState(['level1']);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState({
    confidenceThreshold: 0.8,
    maxFindings: 100,
    skipCrossReferences: false,
    skipHistoryValidation: false,
    maxTemporalThreshold: 90
  });
  const [error, setError] = useState('');

  const handleLevelToggle = (levelId) => {
    // If clicking on a selected level, keep at least one selected
    if (selectedLevels.includes(levelId) && selectedLevels.length === 1) {
      return;
    }
    
    setSelectedLevels(prev => 
      prev.includes(levelId) 
        ? prev.filter(id => id !== levelId) 
        : [...prev, levelId]
    );
  };

  const handleOptionsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOptions(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
    }));
  };

  const validateForm = () => {
    if (!documentData.trim()) {
      setError('Document data is required');
      return false;
    }
    
    try {
      // Attempt to parse if the document is JSON
      if (documentData.trim().startsWith('{') || documentData.trim().startsWith('[')) {
        JSON.parse(documentData);
      }
    } catch (e) {
      setError('Invalid JSON format in document data');
      return false;
    }
    
    if (!regulationId.trim()) {
      setError('Regulation ID is required');
      return false;
    }
    
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const payload = {
        documentData: documentData.trim().startsWith('{') || documentData.trim().startsWith('[') 
          ? JSON.parse(documentData) 
          : documentData,
        regulationId,
        validationLevels: selectedLevels,
        options
      };
      
      onSubmit(payload);
    } catch (err) {
      setError(`Error submitting form: ${err.message}`);
    }
  };

  return (
    <div className="validation-form">
      <h2>Document Validation</h2>
      
      {error && (
        <div className="error-container">
          <p className="error-title">Error</p>
          <p className="error-message">{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Document Information</h3>
          
          <div className="form-group">
            <label htmlFor="documentData">Document Data (JSON or Text)</label>
            <textarea 
              id="documentData"
              className="textarea-input"
              value={documentData}
              onChange={(e) => setDocumentData(e.target.value)}
              placeholder="Paste your document data here (JSON or text format)"
              rows={10}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="regulationId">Regulation ID</label>
            <input
              type="text"
              id="regulationId"
              className="text-input"
              value={regulationId}
              onChange={(e) => setRegulationId(e.target.value)}
              placeholder="Enter the regulation ID (e.g., GDPR-2016, HIPAA-2023)"
            />
          </div>
        </div>
        
        <div className="form-section">
          <h3>Validation Levels</h3>
          <div className="checkbox-group">
            {VALIDATION_LEVELS.map(level => (
              <div 
                key={level.id}
                className={`checkbox-item ${selectedLevels.includes(level.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  id={level.id}
                  checked={selectedLevels.includes(level.id)}
                  onChange={() => handleLevelToggle(level.id)}
                />
                <label htmlFor={level.id} title={level.description}>
                  {level.name}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <div className="form-section">
          <button 
            type="button" 
            className="toggle-advanced" 
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Options
          </button>
          
          {showAdvanced && (
            <div className="options-group">
              <div className="form-group">
                <label htmlFor="confidenceThreshold">
                  Confidence Threshold (0-1)
                </label>
                <input
                  type="number"
                  id="confidenceThreshold"
                  name="confidenceThreshold"
                  className="text-input"
                  min="0"
                  max="1"
                  step="0.05"
                  value={options.confidenceThreshold}
                  onChange={handleOptionsChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="maxFindings">
                  Maximum Findings
                </label>
                <input
                  type="number"
                  id="maxFindings"
                  name="maxFindings"
                  className="text-input"
                  min="1"
                  max="1000"
                  value={options.maxFindings}
                  onChange={handleOptionsChange}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="maxTemporalThreshold">
                  Max Temporal Threshold (days)
                </label>
                <input
                  type="number"
                  id="maxTemporalThreshold"
                  name="maxTemporalThreshold"
                  className="text-input"
                  min="1"
                  value={options.maxTemporalThreshold}
                  onChange={handleOptionsChange}
                />
              </div>
              
              <div className="checkbox-group">
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="skipCrossReferences"
                    name="skipCrossReferences"
                    checked={options.skipCrossReferences}
                    onChange={handleOptionsChange}
                  />
                  <label htmlFor="skipCrossReferences">
                    Skip Cross-References Validation
                  </label>
                </div>
                
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="skipHistoryValidation"
                    name="skipHistoryValidation"
                    checked={options.skipHistoryValidation}
                    onChange={handleOptionsChange}
                  />
                  <label htmlFor="skipHistoryValidation">
                    Skip History Validation
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="button-group">
          <button
            type="submit"
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Validating...' : 'Validate Document'}
            {isLoading && <span className="loading-spinner"></span>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ValidationForm;
