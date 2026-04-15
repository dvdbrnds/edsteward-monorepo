import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { ThemeProvider } from "./hooks/use-theme";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: `edsteward@${import.meta.env.VITE_APP_VERSION || '1.5.15'}`,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
