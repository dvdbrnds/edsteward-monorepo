import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import styled from 'styled-components';

const theme = { 
  colors: { 
    primary: '#1976D2', 
    textOnPrimary: '#fff', 
    background: '#f5f5f5', 
    primaryDark: '#0D47A1' 
  }, 
  shadows: { medium: '0 3px 6px rgba(0, 0, 0, 0.15)' }, 
  sizes: { maxWidth: '1200px' } 
};

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
`;

const SimpleDashboard = () => <div><h1>Simple Dashboard Works!</h1></div>;

const DevClientApp = () => (
  <ThemeProvider theme={theme}>
    <BrowserRouter>
      <AppContainer>
        <Header><h1>MCP Engine Dashboard</h1></Header>
        <Main>
          <Routes>
            <Route path="/" element={<SimpleDashboard />} />
            <Route path="*" element={<SimpleDashboard />} />
          </Routes>
        </Main>
        <Footer>MCP Editor Tool v1.0.0</Footer>
      </AppContainer>
    </BrowserRouter>
  </ThemeProvider>
);

export default DevClientApp;
