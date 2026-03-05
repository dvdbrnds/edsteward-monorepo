'use client';

import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  :root {
    /* Primary colors */
    --primary: ${props => props.theme.colors.primary};
    --primary-light: ${props => props.theme.colors.primaryLight};
    --primary-dark: ${props => props.theme.colors.primaryDark};
    
    /* Secondary colors */
    --secondary: ${props => props.theme.colors.secondary};
    --secondary-light: ${props => props.theme.colors.secondaryLight};
    --secondary-dark: ${props => props.theme.colors.secondaryDark};
    
    /* Feedback colors */
    --success: ${props => props.theme.colors.success};
    --error: ${props => props.theme.colors.error};
    --warning: ${props => props.theme.colors.warning};
    --info: ${props => props.theme.colors.info};
    
    /* Text colors */
    --text: ${props => props.theme.colors.text};
    --text-secondary: ${props => props.theme.colors.textSecondary};
    --text-disabled: ${props => props.theme.colors.textDisabled};
    --text-on-primary: ${props => props.theme.colors.textOnPrimary};
    --text-on-secondary: ${props => props.theme.colors.textOnSecondary};
    
    /* Background colors */
    --background: ${props => props.theme.colors.background};
    --paper: ${props => props.theme.colors.paper};
    --card-background: ${props => props.theme.colors.cardBackground};
    --divider: ${props => props.theme.colors.divider};
    --border: ${props => props.theme.colors.border};
    
    /* Interactive states */
    --hover: ${props => props.theme.colors.hover};
    --selected: ${props => props.theme.colors.selected};
    --focus: ${props => props.theme.colors.focus};
    --disabled: ${props => props.theme.colors.disabled};
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  }

  html, body {
    height: 100%;
    font-family: ${props => props.theme.fonts.body};
    font-size: 16px;
    line-height: ${props => props.theme.lineHeights.body};
    background-color: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.text};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${props => props.theme.fonts.heading};
    font-weight: ${props => props.theme.fontWeights.heading};
    line-height: ${props => props.theme.lineHeights.heading};
    margin-bottom: ${props => props.theme.space[4]}px;
    color: ${props => props.theme.colors.text};
  }

  h1 {
    font-size: ${props => props.theme.fontSizes[6]}px;
  }

  h2 {
    font-size: ${props => props.theme.fontSizes[5]}px;
  }

  h3 {
    font-size: ${props => props.theme.fontSizes[4]}px;
  }

  h4 {
    font-size: ${props => props.theme.fontSizes[3]}px;
  }

  h5 {
    font-size: ${props => props.theme.fontSizes[2]}px;
  }

  h6 {
    font-size: ${props => props.theme.fontSizes[1]}px;
  }

  a {
    color: ${props => props.theme.colors.primary};
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: ${props => props.theme.colors.primaryDark};
    }
  }

  button, input, select, textarea {
    font-family: inherit;
    font-size: 100%;
  }

  button {
    cursor: pointer;
  }

  code {
    font-family: ${props => props.theme.fonts.monospace};
    background-color: ${props => props.theme.colors.background === '#F5F5F5' 
      ? props.theme.colors.divider 
      : 'rgba(255, 255, 255, 0.1)'};
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 85%;
  }

  ul, ol {
    padding-left: ${props => props.theme.space[6]}px;
    margin-bottom: ${props => props.theme.space[4]}px;
  }

  img {
    max-width: 100%;
    height: auto;
  }
  
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.background};
  }
  
  ::-webkit-scrollbar-thumb {
    background-color: ${props => props.theme.colors.neutralLight};
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background-color: ${props => props.theme.colors.neutral};
  }
  
  /* Selection highlighting */
  ::selection {
    background-color: ${props => props.theme.colors.primary};
    color: ${props => props.theme.colors.textOnPrimary};
  }
`;

export default GlobalStyle; 