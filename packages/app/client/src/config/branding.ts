// Generic branding configuration - tenant-specific branding is loaded from API
const edstewardLogo = '/assets/es-white-on-purple-logo.png';

export const BRANDING = {
  name: 'Compliance Portal',
  title: 'Compliance Portal',
  logo: edstewardLogo,
  favicon: '/favicon.ico',
  primaryColor: '#3d1a5a', // EdSteward purple
  secondaryColor: '#2d1345',
  accentColor: '#6b3fa0',
} as const; 