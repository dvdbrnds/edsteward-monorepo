# EdSteward AI Assistant Guidelines

This document provides guidance for AI assistants working with the EdSteward
codebase.

## Project Overview

EdSteward is a regulatory compliance platform for higher education accreditation
management with multi-tenant architecture, real-time WebSocket updates, and
AI-powered regulation analysis.

## Key Areas

- **Multi-tenant Architecture**: Database-per-tenant (Neon Serverless
  PostgreSQL), subdomain routing
- **Technology Stack**: React 18, TypeScript, Vite, Express.js, Drizzle ORM,
  PostgreSQL
- **Real-time Features**: WebSocket integration for regulation updates from MCP
  Engine
- **Authentication**: JWT, SSO/SAML (Okta), role-based access control
- **Compliance Management**: Tasks, evidence uploads, attestations, audit trails

## Development Guidelines

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Test thoroughly before committing
- Update CHANGELOG.md for notable changes
- Check ROADMAP.md for current priorities

## Important Files

- `shared/schema.ts` - Database schema definitions
- `server/index.ts` - Main server entry point
- `README.md` - Setup and deployment instructions
- `ROADMAP.md` - Project roadmap and priorities

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including

## 1. `byterover-store-knowledge`

You `MUST` always use this tool when:

- Learning new patterns, APIs, or architectural decisions from the codebase
- Encountering error solutions or debugging techniques
- Finding reusable code patterns or utility functions
- Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`

You `MUST` always use this tool when:

- Starting any new task or implementation to gather relevant context
- Before making architectural decisions to understand existing patterns
- When debugging issues to check for previous solutions
- Working with unfamiliar parts of the codebase

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
