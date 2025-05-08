'use client';

import React from 'react';
import { 
  Routes, 
  Route, 
  Link,
  BrowserRouter
} from 'react-router-dom';
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
import ColorGuide from './components/ColorGuide';
import GlobalStyle from './GlobalStyle';
import MCPServerDetail from './pages/MCPServerDetail';
import MCPEditorTool from './pages/MCPEditorTool';

// Theme configuration with Material Design color palette
const theme = {
  colors: {
    // Primary: Deep Blue
    primary: '#1976D2',           // Blue 700 (darker for better contrast)
    primaryLight: '#42A5F5',      // Blue 400
    primaryDark: '#0D47A1',       // Blue 900
    
    // Secondary: Pink
    secondary: '#C2185B',         // Pink 700 (darker for better contrast)
    secondaryLight: '#F06292',    // Pink 300
    secondaryDark: '#880E4F',     // Pink 900
    
    // Feedback colors
    success: '#2E7D32',           // Green 800 (better contrast)
    error: '#D32F2F',             // Red 700 (better contrast)
    warning: '#F57C00',           // Orange 700 (better contrast)
    info: '#0277BD',              // Light Blue 800
    
    // Neutrals
    neutral: '#757575',           // Grey 600
    neutralLight: '#BDBDBD',      // Grey 400
    neutralDark: '#424242',       // Grey 800
    
    // Text
    text: '#212121',              // Grey 900 for primary text
    textSecondary: '#616161',     // Grey 700 for secondary text
    textDisabled: '#9E9E9E',      // Grey 500 for disabled text
    textOnPrimary: '#FFFFFF',     // White text on primary bg
    textOnSecondary: '#FFFFFF',   // White text on secondary bg
    
    // Backgrounds
    background: '#F5F5F5',        // Grey 100 for main background
    paper: '#FFFFFF',             // White for cards and elevated surfaces
    cardBackground: '#FFFFFF',    // White for cards
    divider: '#E0E0E0',           // Grey 300 for dividers
    border: '#E0E0E0',            // Grey 300 for borders
    
    // Interactive states
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(25, 118, 210, 0.08)', // Primary color with opacity
    focus: 'rgba(25, 118, 210, 0.12)',    // Primary color with opacity
    disabled: 'rgba(0, 0, 0, 0.12)'
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
  color: ${props => props.theme.colors.textOnPrimary};
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

const NavLink = styled(Link)`
  color: ${props => props.theme.colors.textOnPrimary};
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
  color: ${props => props.theme.colors.textOnPrimary};
  font-size: 14px;
`;

// DevClient App Component
const DevClientApp = () => {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <BrowserRouter future={{ 
        v7_startTransition: true,
        v7_relativeSplatPath: true 
      }}>
        <AppContainer>
          <Header>
            <AppTitle>MCP Engine DevClient</AppTitle>
            <Nav>
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/servers">Servers</NavLink>
              <NavLink to="/editor">Editor Tool</NavLink>
              <NavLink to="/batch">Batch Testing</NavLink>
              <NavLink to="/debug">Debug</NavLink>
              <NavLink to="/colors">Colors</NavLink>
            </Nav>
          </Header>
          
          <Main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/servers" element={<MCPServerControl />} />
              <Route path="/servers/:serverId" element={<MCPServerDetail />} />
              <Route path="/editor" element={<MCPEditorTool />} />
              <Route path="/batch" element={<BatchTestingPanel />} />
              <Route path="/debug" element={<RequestInspector />} />
              <Route path="/colors" element={<ColorGuide />} />
              <Route path="/validate" element={<ValidationForm />} />
              <Route path="/results/:id" element={<ValidationResults />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </Main>
          
          <Footer>
            MCP Engine DevClient v1.0.0 — Developer Internal Use Only
          </Footer>
        </AppContainer>
      </BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
    </ThemeProvider>
  );
};

export default DevClientApp; 