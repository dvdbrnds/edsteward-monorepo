# Changelog

## [1.2.0] - 2025-04-16

### Added
- "isOfficial" flag for evidence files to identify official government source documents
- Official badges for government regulation files in both list and detail views
- Enhanced file upload form with checkbox for marking official government documents
- Dedicated endpoint for regulation file downloads with proper content-type handling
- Improved file server for both user-uploaded and system regulation files

### Fixed
- File download content-type handling for various document formats
- File path resolution for documents from different storage locations
- Evidence file metadata display and attribution

### Improved
- Evidence files now display uploader's full name instead of username
- Enhanced user interface for file identification and downloading
- Better handling of file downloads with correct headers and disposition
- Official government documents are now clearly distinguished in the interface

## [1.1.0] - 2025-03-13

### Added
- New endpoint for creating deadlines via POST /api/deadlines
- Dedicated endpoint for updating regulation categories via PATCH /api/regulations/:regulationId/category
- Enhanced error logging throughout the application
- Improved form validation for deadline creation
- Web publishing dialog with support for both Drupal and Universal HTML formats
- Community communication statement generator for compliance announcements
- Streamlined compliance action workflow with single-button actions
- Automatic formatting for regulation publication content
- One-click compliance communication generation
- Responsive dialog interface for copying generated content

### Fixed
- JSON parsing errors in category update functionality
- Deadline creation form validation and submission
- Proper error handling and user feedback for API responses
- Validation of regulation IDs before making API calls
- HTML content overflow in dialog boxes
- Action button layout and responsiveness
- Pre-formatted text wrapping in dialogs
- Copy-to-clipboard functionality in modals

### Improved
- Enhanced error messages for better debugging
- Added detailed logging for API endpoints
- Better handling of edge cases in form submissions
- More robust error handling in mutation functions
- Simplified compliance action interface
- Dialog content formatting and readability
- User experience for compliance action workflows
- Content generation templates and formatting

### Security
- Added authentication checks for deadline creation and category updates
- Improved input validation for all API endpoints

### Technical Debt
- Refactored mutation functions to handle errors more gracefully
- Added proper TypeScript types for all API responses
- Improved consistency in API error responses
- Standardized dialog component implementations