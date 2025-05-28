'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ValidationProvider } from './context/ValidationContext';
import DevClientApp from './DevClientApp';
import './index.css';
import 'react-toastify/dist/ReactToastify.css';

// Add debugging message to confirm JavaScript is running
console.log('JavaScript loaded and running');
document.title = 'MCP Client - Debug Mode';

// Add debugging to the React entry point
console.log('React client initializing...');

// ClientOnly wrapper component to prevent hydration mismatch
const ClientOnly = ({ children }) => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient ? children : null;
};

// Styled Components registry support
import StyledComponentsRegistry from './lib/registry.jsx';

// Get the root element
const container = document.getElementById('root');

const root = ReactDOM.createRoot(container || document.getElementById('root'));

// Don't set innerHTML on the root element - this will cause problems with ReactDOM
// Instead, use a fallback div if there's an issue
const fallbackElement = document.createElement('div');
fallbackElement.innerHTML = '<div style="padding: 20px; font-family: sans-serif;">' +
  '<h2>Loading MCP Engine DevClient...</h2>' +
  '<p>If the application does not load within a few seconds, please check the browser console for errors.</p>' +
  '</div>';

// Only show fallback if needed
if (!container) {
  document.body.appendChild(fallbackElement);
}

// Render the application
try {
  root.render(
    <React.StrictMode>
      <ClientOnly>
        <StyledComponentsRegistry>
          <ValidationProvider>
            <DevClientApp />
          </ValidationProvider>
        </StyledComponentsRegistry>
      </ClientOnly>
    </React.StrictMode>
  );
  console.log('React rendering completed');
} catch (error) {
  console.error('Error during render:', error);
  // Display fallback content if React rendering completely fails
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h2>Failed to start MCP Client</h2>
      <p>Error: ${error?.message || 'Unknown error'}</p>
      <p>Check the console for more details.</p>
    </div>
  `;
} 