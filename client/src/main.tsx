import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Defensive error handling for Chrome extension errors
// These errors are caused by third-party browser extensions and are harmless
window.addEventListener('error', (event) => {
  const errorMessage = event.error?.message || event.message || '';
  
  // Suppress Chrome extension-related errors
  if (
    errorMessage.includes('Could not establish connection') ||
    errorMessage.includes('Receiving end does not exist') ||
    errorMessage.includes('Extension context invalidated') ||
    errorMessage.includes('chrome-extension://') ||
    event.filename?.includes('chrome-extension://')
  ) {
    console.debug('[Chrome Extension Error - Suppressed]:', errorMessage);
    event.preventDefault();
    return;
  }
  
  // Let other errors bubble up normally
  console.error('[Application Error]:', errorMessage);
});

// Also handle unhandled promise rejections for Chrome extensions
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || event.reason || '';
  
  if (
    typeof reason === 'string' && (
      reason.includes('Could not establish connection') ||
      reason.includes('Receiving end does not exist') ||
      reason.includes('Extension context invalidated') ||
      reason.includes('chrome-extension://')
    )
  ) {
    console.debug('[Chrome Extension Promise Rejection - Suppressed]:', reason);
    event.preventDefault();
    return;
  }
  
  // Let other rejections bubble up normally
  console.error('[Unhandled Promise Rejection]:', reason);
});

createRoot(document.getElementById("root")!).render(<App />);
