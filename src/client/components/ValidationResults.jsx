'use client';

import React, { useState } from 'react';
import StatusIndicator from './StatusIndicator';
import './ValidationResults.css';

const ValidationResults = ({ results }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedFindings, setExpandedFindings] = useState({});

  if (!results) {
    return null;
  }

  const { status, confidence, findings, validationLevels } = results;

  const toggleFinding = (findingId) => {
    setExpandedFindings(prev => ({
      ...prev,
      [findingId]: !prev[findingId]
    }));
  };

  const renderSummary = () => {
    const totalFindings = findings ? findings.length : 0;
    const criticalFindings = findings ? findings.filter(f => f.severity === 'critical').length : 0;
    const highFindings = findings ? findings.filter(f => f.severity === 'high').length : 0;
    const mediumFindings = findings ? findings.filter(f => f.severity === 'medium').length : 0;
    const lowFindings = findings ? findings.filter(f => f.severity === 'low').length : 0;

    return (
      <div className="results-summary">
        <div className="result-status">
          <span className="status-label">Status:</span>{' '}
          <StatusIndicator 
            status={status} 
            bold={true}
            uppercase={true}
          />
        </div>
        
        <div className="result-confidence">
          <span className="confidence-label">Confidence:</span>
          <div className="confidence-bar-container">
            <div 
              className="confidence-bar" 
              style={{ width: `${Math.round(confidence * 100)}%` }}
            ></div>
            <span className="confidence-value">{Math.round(confidence * 100)}%</span>
          </div>
        </div>

        <div className="validation-levels-summary">
          <h4>Validation Levels Used:</h4>
          <ul className="levels-list">
            {validationLevels && validationLevels.map(level => (
              <li key={level}>{`Level ${level}`}</li>
            ))}
          </ul>
        </div>

        <div className="findings-overview">
          <h4>Findings Overview:</h4>
          <div className="findings-counts">
            <div className="finding-count total">
              <span className="count">{totalFindings}</span>
              <span className="label">Total</span>
            </div>
            {criticalFindings > 0 && (
              <div className="finding-count critical">
                <span className="count">{criticalFindings}</span>
                <span className="label">Critical</span>
              </div>
            )}
            {highFindings > 0 && (
              <div className="finding-count high">
                <span className="count">{highFindings}</span>
                <span className="label">High</span>
              </div>
            )}
            {mediumFindings > 0 && (
              <div className="finding-count medium">
                <span className="count">{mediumFindings}</span>
                <span className="label">Medium</span>
              </div>
            )}
            {lowFindings > 0 && (
              <div className="finding-count low">
                <span className="count">{lowFindings}</span>
                <span className="label">Low</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDetails = () => {
    if (!findings || findings.length === 0) {
      return <div className="no-findings">No findings to display</div>;
    }

    return (
      <div className="findings-list">
        {findings.map((finding, index) => (
          <div 
            key={index} 
            className={`finding-item`}
          >
            <div 
              className="finding-header"
              onClick={() => toggleFinding(index)}
            >
              <div className="finding-title">
                <StatusIndicator status={finding.severity || 'info'} />
                {finding.message}
              </div>
              <div className="finding-meta">
                <div className="finding-location">
                  {finding.path && `Path: ${finding.path}`}
                </div>
                <div className="finding-validator">
                  {finding.validatorLevel && `Level ${finding.validatorLevel}`}
                </div>
                <div className="finding-toggle">
                  {expandedFindings[index] ? '▼' : '▶'}
                </div>
              </div>
            </div>
            
            {expandedFindings[index] && (
              <div className="finding-details">
                {finding.description && (
                  <div className="finding-description">
                    {finding.description}
                  </div>
                )}
                
                {finding.expected && (
                  <div className="finding-expected">
                    <span className="label">Expected:</span> {finding.expected}
                  </div>
                )}
                
                {finding.actual && (
                  <div className="finding-actual">
                    <span className="label">Actual:</span> {finding.actual}
                  </div>
                )}
                
                {finding.recommendation && (
                  <div className="finding-recommendation">
                    <span className="label">Recommendation:</span> {finding.recommendation}
                  </div>
                )}
                
                {finding.confidence && (
                  <div className="finding-confidence">
                    <span className="label">Confidence:</span> {Math.round(finding.confidence * 100)}%
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderRaw = () => {
    return (
      <div className="raw-results">
        <pre>{JSON.stringify(results, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="validation-results">
      <h2>Validation Results</h2>
      
      <div className="results-tabs">
        <button 
          className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button 
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Findings Details
        </button>
        <button 
          className={`tab-button ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          Raw JSON
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'details' && renderDetails()}
        {activeTab === 'raw' && renderRaw()}
      </div>
    </div>
  );
};

export default ValidationResults; 