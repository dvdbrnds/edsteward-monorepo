# Regulatory Compliance Platform Tech Stack

This document outlines the technology stack used in our Regulatory Compliance Platform, a full-stack application for higher education accreditation management and compliance monitoring.

## System Architecture Overview

The application follows a modern full-stack JavaScript architecture pattern with:

- **Frontend:** React-based single-page application (SPA)  
- **Backend:** Node.js Express API server
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Session-based authentication with Passport.js
- **Deployment:** Replit-hosted application

## Frontend Technology Stack

### Core Technologies

- **React 18**: UI component library providing a robust foundation for building interactive user interfaces
- **TypeScript**: Type-safe JavaScript superset for better code quality and developer experience
- **Vite**: Modern, fast build tool for frontend development with efficient bundling

### UI Framework & Styling

- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Shadcn UI Components**: High-quality React component library built on Radix UI primitives
- **Radix UI**: Unstyled, accessible UI component primitives
- **Lucide React**: Clean, consistent icon library
- **Tailwind Merge**: Utility for merging Tailwind CSS classes without conflicts
- **Tailwind Animation**: Animation utilities for Tailwind CSS
- **Tailwind Typography**: Typography plugin for Tailwind CSS

### State Management & Data Fetching

- **TanStack React Query**: Data fetching, caching, and state management for asynchronous data
- **React Hook Form**: Form state management and validation library
- **Zod**: Schema validation library used with React Hook Form

### Routing

- **Wouter**: Minimalist routing library for React applications

### UI Components & Visualization

- **React Day Picker**: Date picker component
- **Recharts**: Composable charting library for data visualization
- **React Quill**: Rich text editor component
- **@tremor/react**: Dashboard UI components
- **Monaco Editor**: Code editor component (same as VS Code)
- **Embla Carousel**: Lightweight carousel/slider component
- **React Resizable Panels**: Resizable panel components
- **Framer Motion**: Animation library for React

## Backend Technology Stack

### Core Technologies

- **Node.js**: JavaScript runtime for server-side development
- **Express**: Web application framework for Node.js
- **TypeScript**: Type-safe JavaScript for backend development
- **tsx**: TypeScript execution environment with native ESM support

### Database & ORM

- **PostgreSQL**: Relational database for data storage
- **Drizzle ORM**: Lightweight ORM for TypeScript with PostgreSQL support
- **Drizzle Kit**: Schema migration tools for Drizzle ORM
- **Drizzle Zod**: Integration between Drizzle and Zod for schema validation
- **@neondatabase/serverless**: Serverless PostgreSQL client

### Authentication & Security

- **Passport.js**: Authentication middleware for Node.js
- **Express Session**: Session middleware for Express
- **bcrypt**: Password hashing library for secure password storage
- **connect-pg-simple**: PostgreSQL session store for Express

### API & Communication

- **Axios**: Promise-based HTTP client for API requests
- **nodemailer**: Email sending capabilities
- **Twilio**: SMS and messaging API

### File Processing & Utilities

- **Multer**: Middleware for handling multipart/form-data (file uploads)
- **Cheerio**: Server-side HTML parsing and manipulation
- **CSV Parse**: CSV parsing library
- **XLSX**: Excel file processing
- **PDF Parse**: PDF parsing capabilities
- **Puppeteer**: Headless browser automation for web scraping
- **Marked**: Markdown parser and compiler

### AI Services

- **OpenAI SDK**: Integration with OpenAI's API for AI-powered features
- **Anthropic SDK**: Integration with Claude AI models

## Development & Build Tools

- **esbuild**: Fast JavaScript bundler
- **TypeScript**: Static type checking
- **ESLint**: Code linting
- **drizzle-kit**: Database migration and management tools
- **tsconfig.json**: TypeScript configuration
- **Vite**: Build tool with plugin ecosystem

## Testing Tools

- **Mocha**: JavaScript test framework
- **Chai**: Assertion library for testing

## Deployment & Infrastructure

- **Replit**: Cloud development and hosting platform
- **Neon Database**: Serverless PostgreSQL service
- **Node.js Production Environment**: Server runtime for production deployment

## File Structure

The project is organized into the following main directories:

- **`/client`**: Frontend React application
  - **`/src`**: Source code for the frontend
    - **`/components`**: Reusable UI components
    - **`/hooks`**: Custom React hooks
    - **`/pages`**: Page components for routing
    - **`/lib`**: Utility functions and helpers
    - **`/types`**: TypeScript type definitions
    - **`/assets`**: Static assets like images
- **`/server`**: Backend Express application
  - **`/services`**: Service modules (email, web scraping, etc.)
  - **`index.ts`**: Main server entry point
  - **`routes.ts`**: API route definitions
  - **`auth.ts`**: Authentication logic
  - **`db.ts`**: Database connection setup
  - **`storage.ts`**: Database operations interface
- **`/shared`**: Shared code between frontend and backend
  - **`schema.ts`**: Database schema definitions and types
- **`/public`**: Static files served directly by the server
- **`/docs`**: Documentation files
- **`/uploads`**: Uploaded files storage

## Database Schema

The database schema includes tables for:

- **Users**: User accounts and authentication information
- **Regulations**: Compliance regulations and requirements
- **Notes**: User-created notes on regulations
- **Notifications**: System notifications for users
- **Deadlines**: Compliance deadlines tracking
- **Guides**: Compliance guidance documents
- **Evidence Files**: Supporting documentation for compliance
- **System Logs**: Application logging and audit trail

## Key Features Implemented with the Tech Stack

1. **User Authentication and Access Control**: Role-based access control using Passport.js and session management
2. **Regulation Management**: CRUD operations for compliance regulations
3. **Compliance Monitoring**: Deadline tracking and status reporting
4. **Document Management**: Upload and management of evidence files
5. **Notification System**: Email and in-app notifications for deadlines and updates
6. **Dashboard Analytics**: Visual reporting of compliance status
7. **AI-Enhanced Features**: Regulation data collection and analysis using OpenAI and Claude
8. **Data Import/Export**: CSV, Excel, and PDF processing capabilities
9. **Web Scraping**: Automated collection of regulatory information from agency websites

## Third-Party Service Integration

- **OpenAI API**: For AI-powered regulation data analysis
- **Anthropic (Claude) API**: Alternative AI service for content generation
- **Google APIs**: For document and calendar integration
- **Twilio**: For SMS notifications
- **Email Providers**: Via nodemailer for email notifications

## Development Workflow

The development workflow is managed with the following scripts:

- **`npm run dev`**: Start development server with hot reloading
- **`npm run build`**: Build for production
- **`npm run start`**: Run production server
- **`npm run db:push`**: Push schema changes to the database
- **`npm run db:setup`**: Initialize database tables

This tech stack provides a modern, scalable foundation for the Regulatory Compliance Platform, combining best-in-class libraries and tools for both frontend and backend development.