import React from 'react';
import styled from 'styled-components';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const SidebarContainer = styled.aside`
  width: ${props => props.isOpen ? '250px' : '0'};
  overflow: hidden;
  background-color: ${props => props.isDarkMode ? props.theme.colors.dark : '#222'};
  color: ${props => props.theme.colors.white};
  transition: width 0.3s ease;
  box-shadow: ${props => props.theme.shadows.lg};
  z-index: ${props => props.theme.zIndices[20]};
  display: flex;
  flex-direction: column;
`;

const Logo = styled.div`
  padding: ${props => props.theme.space[6]};
  border-bottom: 1px solid ${props => props.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)'};
  display: flex;
  align-items: center;
`;

const LogoText = styled.h1`
  font-size: ${props => props.theme.fontSizes.xl};
  font-weight: ${props => props.theme.fontWeights.bold};
  margin: 0;
  white-space: nowrap;
  color: white;
`;

const Nav = styled.nav`
  margin-top: ${props => props.theme.space[4]};
  flex: 1;
`;

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  padding: ${props => `${props.theme.space[3]} ${props.theme.space[6]}`};
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  white-space: nowrap;
  transition: ${props => props.theme.transitions.default};
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: ${props => props.theme.colors.white};
  }
  
  &.active {
    background-color: ${props => props.theme.colors.primary};
    color: white;
    font-weight: ${props => props.theme.fontWeights.medium};
  }
`;

const NavIcon = styled.span`
  margin-right: ${props => props.theme.space[3]};
  font-size: ${props => props.theme.fontSizes.lg};
`;

const NavLabel = styled.span`
  font-size: ${props => props.theme.fontSizes.md};
`;

const Footer = styled.div`
  padding: ${props => props.theme.space[4]} ${props => props.theme.space[6]};
  border-top: 1px solid ${props => props.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)'};
  font-size: ${props => props.theme.fontSizes.sm};
  color: rgba(255, 255, 255, 0.5);
`;

const Separator = styled.div`
  height: 1px;
  background-color: ${props => props.isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)'};
  margin: ${props => `${props.theme.space[2]} 0`};
`;

const SectionTitle = styled.h3`
  font-size: ${props => props.theme.fontSizes.xs};
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  padding: ${props => `${props.theme.space[4]} ${props.theme.space[6]} ${props.theme.space[2]}`};
  margin: 0;
  letter-spacing: 1px;
`;

const Sidebar = ({ isOpen }) => {
  const { isDarkMode } = useTheme();
  
  return (
    <SidebarContainer isOpen={isOpen} isDarkMode={isDarkMode}>
      <Logo isDarkMode={isDarkMode}>
        <LogoText>MCP Validator</LogoText>
      </Logo>
      
      <Nav>
        <NavItem to="/">
          <NavIcon>📊</NavIcon>
          <NavLabel>Dashboard</NavLabel>
        </NavItem>
        
        <NavItem to="/validate">
          <NavIcon>✓</NavIcon>
          <NavLabel>New Validation</NavLabel>
        </NavItem>
        
        <NavItem to="/regulations">
          <NavIcon>📋</NavIcon>
          <NavLabel>Regulations</NavLabel>
        </NavItem>
        
        <Separator isDarkMode={isDarkMode} />
        <SectionTitle>Recent</SectionTitle>
        
        <NavItem to="/results/recent1">
          <NavIcon>📄</NavIcon>
          <NavLabel>FERPA-2023-01</NavLabel>
        </NavItem>
        
        <NavItem to="/results/recent2">
          <NavIcon>📄</NavIcon>
          <NavLabel>HIPAA-2023-02</NavLabel>
        </NavItem>
        
        <Separator isDarkMode={isDarkMode} />
        <SectionTitle>Tools</SectionTitle>
        
        <NavItem to="/settings">
          <NavIcon>⚙️</NavIcon>
          <NavLabel>Settings</NavLabel>
        </NavItem>
      </Nav>
      
      <Footer isDarkMode={isDarkMode}>
        MCP Validation Engine v1.0
      </Footer>
    </SidebarContainer>
  );
};

export default Sidebar; 