# Moravian University Compliance Management Platform - Reference Guide

## Project Overview
A sophisticated compliance management platform providing advanced system logging and administrative monitoring capabilities with enhanced security tracking.

## Current Tech Stack (as of March 05, 2025)

### Frontend
- React with TypeScript
- React-Quill for rich text editing (standard implementation)
- TanStack Query for data fetching
- Shadcn UI components
- Tailwind CSS for styling
- Wouter for routing

### Backend
- Express.js server
- PostgreSQL database with Drizzle ORM
- ETL capabilities for regulation imports

### Authentication & Security
- Role-based access control
- Advanced logging system
- IP and user agent tracking
- Session-based authentication

## Agent Behavior Rules

### 1. State Awareness (CRITICAL)
- ALWAYS check implementation details in component files before suggesting changes
- Review this reference file at the start of EVERY session
- Never assume library availability - verify current dependencies
- Maintain awareness of recent migrations and changes

### 2. Technology Tracking
- React-Quill is the CURRENT rich text editor (not TinyMCE)
- All components should use current tech stack only
- Verify technology choices against this reference before making changes

### 3. Change Management Process
- Document ALL significant changes in this file
- Include specific dates, descriptions, and reasons for changes
- Track technology migrations and version updates
- Update this reference file BEFORE implementing changes

### 4. Implementation Guidelines
- Start by reviewing current implementation
- Test changes using appropriate feedback tools
- Document new environment variables or configuration
- Follow established patterns in existing code

### 5. Error Resolution
- Document all errors encountered
- Track failed approaches to avoid repetition
- Maintain solutions in this reference

## Recent Changes

### Rich Text Implementation (March 05, 2025)
- CURRENT: React-Quill
- Previous: TinyMCE (retired)
- Location: client/src/components/regulations/note-section.tsx
- Configuration: Standard Quill toolbar with basic formatting

### System Logging Enhancement (March 04, 2025)
- Added CSV export functionality
- Enhanced log display formatting
- Added IP and user agent tracking
- Implemented severity level indicators

### Diary System Implementation (March 03, 2025)
- Replaced legacy comments with diary entries
- Added user attribution
- Implemented automated tracking

## Environment Configuration

### Required Environment Variables
- DATABASE_URL: PostgreSQL connection string
- Other credentials via Replit Secrets

## Next Steps
1. Enhance diary system based on user feedback
2. Add more export formats for system logs
3. Improve UI accessibility

## Change Tracking
Latest update: March 05, 2025
- Corrected rich text editor documentation (React-Quill)
- Enhanced agent behavior rules
- Added strict state awareness requirements