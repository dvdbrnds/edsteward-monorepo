# Moravian University Compliance Portal (Alpha v0.1.2)

A comprehensive compliance management platform designed for Moravian University to streamline regulation tracking and management across institutional departments.

## 🚧 Alpha Release Notice

This is an alpha release of the Compliance Portal. While the core functionality is implemented, you may encounter bugs or incomplete features. We appreciate your feedback to help improve the platform.

## Features

- 📊 Interactive dashboard with compliance overview
- 📝 Comprehensive regulation management
- ⏰ Deadline tracking and notifications
- 📈 Advanced reporting capabilities
- 🎯 Multi-category support (Academic, Accounting, Athletics, Admissions, Campus Safety)
- 🔐 Role-based access control
- 📄 Evidence file management with official document marking
- 📋 Notes system for tracking compliance activities
- 🏛️ Official government regulation source identification

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm 9.x or later

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file with the following:
   ```
   DATABASE_URL=your_database_url
   SESSION_SECRET=your_session_secret

   # For development
   GOOGLE_CLIENT_ID=your_development_client_id
   GOOGLE_CLIENT_SECRET=your_development_client_secret
   GOOGLE_SHEETS_SHEET_ID=your_sheet_id

   # For production, use different OAuth2 credentials
   # GOOGLE_CLIENT_ID=your_production_client_id
   # GOOGLE_CLIENT_SECRET=your_production_client_secret
   ```

4. Set up Google OAuth2 credentials:
   a. For Development:
      - Use the Google Cloud Console to create OAuth2 credentials
      - Set redirect URI to your development URL (e.g., https://your-repl-name.username.repl.co/api/auth/google/callback)

   b. For Production:
      - Create separate OAuth2 credentials
      - Set redirect URI to your production domain (e.g., https://compliance.moravian.edu/api/auth/google/callback)
      - Update environment variables with production credentials

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## Current Status

This alpha release includes:
- ✅ User authentication
- ✅ Regulation browsing and filtering
- ✅ Compliance status tracking
- ✅ Basic reporting
- ✅ Deadline management
- ✅ Evidence file management
- ✅ Official document identification
- ✅ Enhanced download capabilities

Upcoming features:
- 🚧 Advanced notification system
- 🚧 Bulk import/export
- 🚧 Custom reporting templates
- 🚧 Integration with external compliance databases

## Feedback and Issues

Please report any issues or provide feedback by:
1. Contacting the compliance office at compliance@moravian.edu
2. Creating an issue in our issue tracking system
3. Sending feedback through the application's feedback form

## Version History

- v0.1.1 (Alpha) - February 2025
  - Fixed OAuth2 configuration for Google Sheets integration
  - Improved setup wizard with optional OAuth2 configuration
  - Enhanced error handling for authentication flows

- v0.1.0 (Alpha) - February 2025
  - Initial alpha release
  - Core functionality implementation
  - Basic user interface and navigation
  - Fundamental compliance tracking features