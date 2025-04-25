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

// ClientOnly wrapper component to prevent hydration mismatch
const ClientOnly = ({ children }) => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient ? children : null;
};

// Styled Components registry support
let StyledComponentsRegistry;
try {
  // Try to import our registry if we're in a Next.js environment
  StyledComponentsRegistry = require('./lib/registry').default;
} catch (error) {
  // If we're not in a Next.js environment, use a simple pass-through component
  StyledComponentsRegistry = ({ children }) => children;
}

// Get the root element
const container = document.getElementById('root');

if (!container) {
  // Create a fallback element if root is not found
  const fallbackElement = document.createElement('div');
  fallbackElement.id = 'root';
  document.body.appendChild(fallbackElement);
  console.error('Root element not found, created fallback');
}

const root = ReactDOM.createRoot(container || document.getElementById('root'));

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