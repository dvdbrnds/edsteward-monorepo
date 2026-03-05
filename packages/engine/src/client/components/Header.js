import React from 'react';
import styled from 'styled-components';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const HeaderContainer = styled.header`
  height: 64px;
  background-color: ${props => props.theme.colors.cardBackground};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  padding: 0 ${props => props.theme.space[6]};
  box-shadow: ${props => props.theme.shadows.sm};
  z-index: ${props => props.theme.zIndices[10]};
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.secondary};
  font-size: ${props => props.theme.fontSizes.xl};
  cursor: pointer;
  margin-right: ${props => props.theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: ${props => props.theme.transitions.default};
  
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${props => props.theme.fontSizes.xl};
  font-weight: ${props => props.theme.fontWeights.semibold};
  color: ${props => props.theme.colors.text};
  flex: 1;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${props => props.theme.space[4]};
`;

const Button = styled.button`
  background-color: ${props => props.primary ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.primary ? props.theme.colors.white : props.theme.colors.primary};
  border: 1px solid ${props => props.primary ? 'transparent' : props.theme.colors.primary};
  border-radius: ${props => props.theme.radii.default};
  padding: ${props => `${props.theme.space[2]} ${props.theme.space[4]}`};
  font-weight: ${props => props.theme.fontWeights.medium};
  cursor: pointer;
  transition: ${props => props.theme.transitions.default};
  
  &:hover {
    background-color: ${props => props.primary ? props.theme.colors.primaryDark : props.theme.colors.primaryLight};
    color: ${props => props.theme.colors.white};
  }
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  margin-left: ${props => props.theme.space[4]};
  cursor: pointer;
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: ${props => props.theme.radii.full};
  background-color: ${props => props.theme.colors.secondary};
  color: ${props => props.theme.colors.white};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${props => props.theme.fontWeights.bold};
  margin-right: ${props => props.theme.space[2]};
`;

const ThemeToggle = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.secondary};
  font-size: ${props => props.theme.fontSizes.xl};
  cursor: pointer;
  margin-right: ${props => props.theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: ${props => props.theme.transitions.default};
  
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const getPageTitle = (pathname) => {
  switch (pathname) {
    case '/':
      return 'Dashboard';
    case '/validate':
      return 'New Validation';
    case '/settings':
      return 'Settings';
    default:
      if (pathname.startsWith('/results/')) {
        return 'Validation Results';
      }
      return 'MCP Validation Engine';
  }
};

const Header = ({ toggleSidebar, sidebarOpen }) => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <HeaderContainer>
      <MenuButton onClick={toggleSidebar}>
        {sidebarOpen ? '◀' : '▶'}
      </MenuButton>
      <Title>{pageTitle}</Title>
      <ThemeToggle onClick={toggleTheme} title="Toggle dark/light mode">
        {isDarkMode ? '☀️' : '🌙'}
      </ThemeToggle>
      <ActionButtons>
        <Link to="/validate">
          <Button primary>New Validation</Button>
        </Link>
      </ActionButtons>
      <UserProfile>
        <Avatar>U</Avatar>
      </UserProfile>
    </HeaderContainer>
  );
};

export default Header; 