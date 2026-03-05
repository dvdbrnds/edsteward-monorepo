// Light and dark theme configurations
const lightTheme = {
  colors: {
    primary: '#0070f3',
    primaryLight: '#339af0',
    primaryDark: '#0051a8',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40',
    white: '#ffffff',
    background: '#f9fafb',
    cardBackground: '#ffffff',
    text: '#212529',
    textSecondary: '#6c757d',
    border: '#dee2e6',
    hover: '#f5f5f5',
    // Validation status colors
    pass: '#00c853',
    fail: '#f44336',
    error: '#ff9800',
    pending: '#2196f3'
  },
  fonts: {
    body: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    heading: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    monospace: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '4rem'
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeights: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2
  },
  space: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem'
  },
  sizes: {
    0: '0',
    full: '100%',
    screen: '100vh',
    maxWidth: '1200px'
  },
  radii: {
    none: '0',
    sm: '0.125rem',
    default: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px'
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    outline: '0 0 0 3px rgba(66, 153, 225, 0.5)',
    none: 'none'
  },
  zIndices: {
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    auto: 'auto'
  },
  transitions: {
    default: 'all 0.2s ease-in-out',
    fast: 'all 0.1s ease-in-out',
    slow: 'all 0.3s ease-in-out'
  }
};

const darkTheme = {
  colors: {
    primary: '#0070f3',
    primaryLight: '#339af0',
    primaryDark: '#0051a8',
    secondary: '#a0aec0',
    success: '#48bb78',
    danger: '#f56565',
    warning: '#ecc94b',
    info: '#4299e1',
    light: '#2d3748',
    dark: '#1a202c',
    white: '#2d3748',
    background: '#1a202c',
    cardBackground: '#2d3748',
    text: '#e2e8f0',
    textSecondary: '#a0aec0',
    border: '#4a5568',
    hover: '#2d3748',
    // Validation status colors
    pass: '#48bb78',
    fail: '#f56565',
    error: '#ed8936',
    pending: '#4299e1'
  },
  // Keep the same fonts, fontSizes, fontWeights, lineHeights, space, sizes, radii from light theme
  fonts: lightTheme.fonts,
  fontSizes: lightTheme.fontSizes,
  fontWeights: lightTheme.fontWeights,
  lineHeights: lightTheme.lineHeights,
  space: lightTheme.space,
  sizes: lightTheme.sizes,
  radii: lightTheme.radii,
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
    outline: '0 0 0 3px rgba(66, 153, 225, 0.5)',
    none: 'none'
  },
  zIndices: lightTheme.zIndices,
  transitions: lightTheme.transitions
};

// Export both themes
export { lightTheme, darkTheme };

// Default export is light theme for backward compatibility
export default lightTheme; 