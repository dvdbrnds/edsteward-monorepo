import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const AppContainer = styled.div`
  display: flex;
  height: 100%;
`;

const MainContent = styled.main`
  flex: 1;
  overflow: auto;
  padding: ${props => props.theme.space[6]};
  background-color: ${props => props.theme.colors.background};
`;

const ContentWrapper = styled.div`
  max-width: ${props => props.theme.sizes.maxWidth};
  margin: 0 auto;
`;

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <AppContainer>
      <Sidebar isOpen={sidebarOpen} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
        <MainContent>
          <ContentWrapper>
            <Outlet />
          </ContentWrapper>
        </MainContent>
      </div>
    </AppContainer>
  );
};

export default App; 