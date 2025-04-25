import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import styled from 'styled-components';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Dashboard from './pages/Dashboard';
import ValidationForm from './components/ValidationForm';
import ValidationResults from './components/ValidationResults';
import MCPServerControl from './components/MCPServerControl';
import BatchTestingPanel from './components/BatchTestingPanel';
import RequestInspector from './components/RequestInspector';
import GlobalStyle from './GlobalStyle';

// Theme configuration
const theme = {
  colors: {
    primary: '#2196F3',
    primaryDark: '#1976D2',
    secondary: '#FF4081',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    neutral: '#9E9E9E',
    text: '#333333',
    textSecondary: '#757575',
    border: '#E0E0E0',
    cardBackground: '#FFFFFF',
    background: '#F5F5F5',
    hover: 'rgba(0, 0, 0, 0.05)',
  },
  space: [0, 4, 8, 16, 24, 32, 48, 64, 96],
  sizes: {
    maxWidth: '1200px',
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    medium: '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
    large: '0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)',
  },
  fonts: {
    body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    heading: 'inherit',
    monospace: 'Menlo, monospace',
  },
  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64],
  fontWeights: {
    body: 400,
    heading: 700,
    bold: 700,
  },
  lineHeights: {
    body: 1.5,
    heading: 1.25,
  },
  radii: [0, 4, 8, 16, 32],
};

// Main app layout
const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${props => props.theme.colors.background};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background-color: ${props => props.theme.colors.primary};
  color: white;
  box-shadow: ${props => props.theme.shadows.medium};
`;

const AppTitle = styled.h1`
  margin: 0;
  font-size: 20px;
  font-weight: 500;
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
`;

const NavLink = styled.a`
  color: white;
  text-decoration: none;
  margin-left: 24px;
  opacity: 0.9;
  
  &:hover {
    opacity: 1;
  }
`;

const Main = styled.main`
  flex: 1;
  padding: 24px;
  max-width: ${props => props.theme.sizes.maxWidth};
  margin: 0 auto;
  width: 100%;
`;

const Footer = styled.footer`
  text-align: center;
  padding: 16px;
  background-color: ${props => props.theme.colors.primaryDark};
  color: white;
  font-size: 14px;
`;

// DevClient App Component
const DevClientApp = () => {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Router>
        <AppContainer>
          <Header>
            <AppTitle>MCP Engine DevClient</AppTitle>
            <Nav>
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/servers">Servers</NavLink>
              <NavLink href="/batch">Batch Testing</NavLink>
              <NavLink href="/debug">Debug</NavLink>
            </Nav>
          </Header>
          
          <Main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/servers" element={<MCPServerControl />} />
              <Route path="/batch" element={<BatchTestingPanel />} />
              <Route path="/debug" element={<RequestInspector />} />
              <Route path="/validate" element={<ValidationForm />} />
              <Route path="/results/:id" element={<ValidationResults />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </Main>
          
          <Footer>
            MCP Engine DevClient v1.0.0 — Developer Internal Use Only
          </Footer>
        </AppContainer>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} />
    </ThemeProvider>
  );
};

export default DevClientApp; 