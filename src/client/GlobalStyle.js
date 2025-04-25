import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
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
    line-height: ${props => props.theme.lineHeights.normal};
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
    font-weight: ${props => props.theme.fontWeights.semibold};
    line-height: ${props => props.theme.lineHeights.tight};
    margin-bottom: ${props => props.theme.space[4]};
    color: ${props => props.theme.colors.text};
  }

  h1 {
    font-size: ${props => props.theme.fontSizes['4xl']};
  }

  h2 {
    font-size: ${props => props.theme.fontSizes['3xl']};
  }

  h3 {
    font-size: ${props => props.theme.fontSizes['2xl']};
  }

  h4 {
    font-size: ${props => props.theme.fontSizes.xl};
  }

  h5 {
    font-size: ${props => props.theme.fontSizes.lg};
  }

  h6 {
    font-size: ${props => props.theme.fontSizes.md};
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
    background-color: ${props => props.theme.colors.background === '#f9fafb' 
      ? '#f1f3f5' 
      : 'rgba(255, 255, 255, 0.1)'};
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 85%;
  }

  ul, ol {
    padding-left: ${props => props.theme.space[6]};
    margin-bottom: ${props => props.theme.space[4]};
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
    background-color: ${props => props.theme.colors.border};
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background-color: ${props => props.theme.colors.secondary};
  }
  
  /* Selection highlighting */
  ::selection {
    background-color: ${props => props.theme.colors.primary};
    color: white;
  }
`;

export default GlobalStyle; 