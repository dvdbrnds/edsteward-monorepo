# Regulatory Compliance Platform Architecture Diagram

```mermaid
graph TD
    subgraph "Frontend - React SPA"
        UI[React UI Components]
        Pages[Page Components]
        Hooks[Custom React Hooks]
        ReactQuery[TanStack React Query]
        Forms[React Hook Form + Zod]
        Routing[Wouter Routing]
        State[Client State Management]
    end

    subgraph "API Layer"
        Express[Express.js API Server]
        Routes[Routes & Endpoints]
        Controllers[Request Handlers]
        Middleware[Auth & Validation Middleware]
        
        subgraph "Authentication"
            Passport[Passport.js]
            Sessions[Express Session]
            BCrypt[Password Hashing]
        end
    end

    subgraph "Services Layer"
        Storage[Database Storage Service]
        EmailService[Email Notification Service]
        SmsService[SMS Service - Twilio]
        ScraperService[Web Scraping Service]
        AIService[AI Analysis Service]
        ValidationService[Data Validation Service]
    end

    subgraph "Data Layer"
        Drizzle[Drizzle ORM]
        PostgreSQL[PostgreSQL Database]
        Schema[Database Schema]
        Migrations[Schema Migrations]
    end

    subgraph "External Services"
        OpenAI[OpenAI API]
        Claude[Anthropic Claude API]
        TwilioAPI[Twilio API]
        SMTP[Email Providers]
    end

    subgraph "File Storage"
        Uploads[Upload Directory]
        Static[Static Files]
    end

    %% Frontend internal connections
    UI --> Pages
    Pages --> Hooks
    Pages --> ReactQuery
    Pages --> Forms
    Pages --> Routing
    Hooks --> State
    ReactQuery --> State

    %% Frontend to Backend connections
    ReactQuery -->|API Requests| Express

    %% API Layer connections
    Express --> Routes
    Routes --> Controllers
    Controllers --> Middleware
    Middleware --> Passport
    Passport --> Sessions
    Passport --> BCrypt
    
    %% Services connections
    Controllers --> Storage
    Controllers --> EmailService
    Controllers --> SmsService
    Controllers --> ScraperService
    Controllers --> AIService
    Controllers --> ValidationService

    %% Data Layer connections
    Storage --> Drizzle
    Drizzle --> PostgreSQL
    Drizzle --> Schema
    Drizzle --> Migrations

    %% External Services connections
    AIService --> OpenAI
    AIService --> Claude
    SmsService --> TwilioAPI
    EmailService --> SMTP

    %% File Storage connections
    Controllers --> Uploads
    Express --> Static
```

## System Flow Overview

```mermaid
sequenceDiagram
    participant User
    participant React as React Frontend
    participant API as Express API
    participant Services
    participant DB as PostgreSQL Database
    participant External as External Services

    User->>React: Interacts with UI
    React->>API: Makes API Request
    API->>Services: Processes Request
    Services->>DB: Database Operations
    Services->>External: External API Calls (if needed)
    External-->>Services: Response from External APIs
    DB-->>Services: Database Query Results
    Services-->>API: Service Response
    API-->>React: API Response
    React->>User: Updated UI State
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant React as React Frontend
    participant API as Express API
    participant Auth as Passport.js
    participant DB as PostgreSQL Database

    User->>React: Submit Login Credentials
    React->>API: POST /api/login
    API->>Auth: Authenticate
    Auth->>DB: Validate Credentials
    DB-->>Auth: User Record
    Auth->>Auth: Verify Password with bcrypt
    
    alt Authentication Success
        Auth-->>API: Authentication Success
        API->>API: Create Session
        API-->>React: 200 OK + Session Cookie
        React->>User: Redirect to Dashboard
    else Authentication Failure
        Auth-->>API: Authentication Failed
        API-->>React: 401 Unauthorized
        React->>User: Show Error Message
    end
```

## Data Flow for Regulation Management

```mermaid
sequenceDiagram
    participant Admin as Administrator
    participant UI as React UI
    participant API as Express API
    participant Storage as Storage Service
    participant DB as PostgreSQL
    participant AI as AI Service
    participant OpenAI

    Admin->>UI: Create/Update Regulation
    UI->>API: POST/PATCH /api/regulations
    API->>Storage: Save Regulation Data
    Storage->>DB: Execute SQL Query

    alt AI Enhancement Requested
        API->>AI: Request Content Analysis
        AI->>OpenAI: API Request
        OpenAI-->>AI: AI Response
        AI-->>API: Enhanced Content
        API->>Storage: Save Enhanced Content
        Storage->>DB: Update Database
    end

    DB-->>Storage: Query Result
    Storage-->>API: Operation Result
    API-->>UI: API Response
    UI->>Admin: Confirmation/Error Message
```

## Deadline Notification Flow

```mermaid
sequenceDiagram
    participant System as System Scheduler
    participant Service as Notification Service
    participant DB as PostgreSQL Database
    participant Email as Email Service
    participant SMS as SMS Service
    participant User

    System->>Service: Check Deadlines
    Service->>DB: Query Upcoming Deadlines
    DB-->>Service: Deadline Records
    
    loop For Each Due Deadline
        Service->>DB: Get User Preferences
        DB-->>Service: User Contact Info
        
        alt Email Notification
            Service->>Email: Send Email Notification
            Email-->>User: Email Delivered
        end
        
        alt SMS Notification
            Service->>SMS: Send SMS Notification
            SMS-->>User: SMS Delivered
        end
        
        Service->>DB: Log Notification Sent
    end
```

These diagrams provide a visual representation of the system architecture and key workflows in the Regulatory Compliance Platform.