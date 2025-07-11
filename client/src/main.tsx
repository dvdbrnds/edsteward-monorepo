import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Defensive error handling DISABLED for debugging MCP server
// All console errors will now show up normally

createRoot(document.getElementById("root")!).render(<App />);
