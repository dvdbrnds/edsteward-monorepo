import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
`;

const NotFoundCode = styled.div`
  font-size: 120px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 24px;
  line-height: 1;
`;

const NotFoundTitle = styled.h1`
  font-size: 32px;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.text};
`;

const NotFoundDescription = styled.p`
  font-size: 18px;
  margin-bottom: 32px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.5;
`;

const HomeButton = styled(Link)`
  display: inline-block;
  background-color: ${props => props.theme.colors.primary};
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.theme.colors.primaryDark};
  }
`;

const NotFound = () => {
  return (
    <NotFoundContainer>
      <NotFoundCode>404</NotFoundCode>
      <NotFoundTitle>Page Not Found</NotFoundTitle>
      <NotFoundDescription>
        The page you are looking for might have been removed, had its name changed,
        or is temporarily unavailable.
      </NotFoundDescription>
      <HomeButton to="/">Back to Dashboard</HomeButton>
    </NotFoundContainer>
  );
};

export default NotFound; 