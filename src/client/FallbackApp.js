import React from 'react';

const FallbackApp = () => {
  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>MCP Engine Fallback Interface</h1>
      <p style={{ marginBottom: '20px' }}>
        This is a fallback interface for debugging. If you're seeing this, 
        the main DevClientApp failed to render properly.
      </p>
      
      <div style={{
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2>Troubleshooting Steps</h2>
        <ul style={{ marginLeft: '20px' }}>
          <li>Check browser console for JavaScript errors</li>
          <li>Verify all dependencies are installed correctly</li>
          <li>Ensure the React version is compatible with all components</li>
          <li>Check for missing style dependencies or theme issues</li>
        </ul>
      </div>
      
      <div style={{
        border: '1px solid #ddd',
        padding: '20px',
        borderRadius: '8px'
      }}>
        <h3>Basic Functionality Test</h3>
        <p>The following button tests basic React functionality:</p>
        <button
          onClick={() => alert('React event handling is working!')}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Click to Test React
        </button>
      </div>
    </div>
  );
};

export default FallbackApp; 