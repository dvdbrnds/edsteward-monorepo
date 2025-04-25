import React from 'react';
import ReactDOM from 'react-dom/client';
import { ValidationProvider } from './context/ValidationContext';
import DevClientApp from './DevClientApp';
import './index.css';
import 'react-toastify/dist/ReactToastify.css';

// Add debugging message to confirm JavaScript is running
console.log('JavaScript loaded and running');
document.title = 'MCP Client - Debug Mode';

// Add visual confirmation that JS is running
const debugElement = document.createElement('div');
debugElement.style.position = 'fixed';
debugElement.style.bottom = '10px';
debugElement.style.right = '10px';
debugElement.style.backgroundColor = 'green';
debugElement.style.color = 'white';
debugElement.style.padding = '5px 10px';
debugElement.style.borderRadius = '4px';
debugElement.style.fontSize = '12px';
debugElement.style.zIndex = '9999';
debugElement.textContent = 'JS Running';
document.body.appendChild(debugElement);

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
      <ValidationProvider>
        <DevClientApp />
      </ValidationProvider>
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