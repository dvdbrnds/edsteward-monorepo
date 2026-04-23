// Generic branding configuration - tenant-specific branding is loaded from API
const edstewardLogo = '/assets/es-logo-pdf.png';

export const BRANDING = {
  name: 'Compliance Portal',
  title: 'Compliance Portal',
  logo: edstewardLogo,
  favicon: '/favicon.ico',
  primaryColor: '#2e1b68', // EdSteward purple
  secondaryColor: '#1a0f3d',
  accentColor: '#6b3fa0',
} as const; 