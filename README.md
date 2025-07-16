# EdSteward - Regulatory Compliance Platform

An advanced AI-powered regulatory compliance platform for higher education accreditation management, delivering intelligent insights across multiple jurisdictions through innovative technology.

> **🐳 CRITICAL:** EdSteward uses Docker-first development. Always use `./dev.sh up` for local development. **NEVER** use `npm run dev` on macOS due to architecture conflicts.

## 🚀 Features

- **JWT Authentication** with automatic token refresh
- **Real-time Updates** via WebSocket connections
- **Rate Limiting** with intelligent retry mechanisms
- **Multi-tenant Architecture** with tenant isolation
- **Delta Sync** for efficient data updates
- **Responsive Design** with modern UI components

## 🛠 Technology Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for development and building
- **TanStack Query** for server state management
- **Wouter** for client-side routing
- **Tailwind CSS** + **Radix UI** for styling
- **WebSocket** for real-time communication

### Backend

- **Express.js** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **JWT** authentication with refresh tokens
- **Row-Level Security (RLS)** for data isolation
- **Rate limiting** and request throttling

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# API Configuration
VITE_API_URL=https://your-api-domain.com
VITE_TENANT_ID=your-tenant-id
VITE_WS_URL=wss://your-websocket-domain.com

# Optional: Error Monitoring
VITE_SENTRY_DSN=your-sentry-dsn

# Development Environment
VITE_APP_ENV=development
```

### Required Environment Variables

- `VITE_API_URL` - Base URL for your API server
- `VITE_TENANT_ID` - Your tenant identifier for multi-tenant isolation

### Optional Environment Variables

- `VITE_WS_URL` - WebSocket server URL (defaults to API_URL with ws protocol)
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking
- `VITE_APP_ENV` - Application environment (development, staging, production)

## 📦 Installation & Development

### 🐳 Docker Development (REQUIRED)

**This is the ONLY supported development method for EdSteward:**

1. **Prerequisites**

   ```bash
   # Install Docker Desktop for your platform
   # Ensure Docker is running
   docker --version && docker-compose --version
   ```

2. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd EdSteward
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Docker development environment**

   ```bash
   ./dev.sh up
   # Application will be available at http://localhost:3000
   ```

### 📋 Docker Development Commands

```bash
./dev.sh up       # Start development environment
./dev.sh down     # Stop development environment
./dev.sh logs     # View application logs
./dev.sh shell    # Access container shell for debugging
./dev.sh status   # Check container status
./dev.sh help     # View all available commands
```

### ⚠️ Important Notes

- **NEVER use `npm run dev` on macOS** - causes architecture conflicts
- **ALWAYS use Docker development** - ensures consistent environment
- **Hot reload enabled** - code changes reflect automatically
- See `DOCKER_DEVELOPMENT_GUIDE.md` for comprehensive documentation

## 🏃‍♂️ Available Scripts

### 🐳 Docker Development (Primary)

- `./dev.sh up` - Start Docker development environment with hot reload
- `./dev.sh down` - Stop Docker development environment
- `./dev.sh logs` - View real-time application logs
- `./dev.sh shell` - Access container shell for debugging
- `./dev.sh build` - Rebuild Docker containers
- `./dev.sh status` - Check container status

### 📦 Package Scripts (Secondary)

- `npm run build` - Build for production
- `npm run check` - Run TypeScript type checking
- `npm run test` - Run unit tests with Vitest
- `npm run test:e2e` - Run end-to-end tests with Cypress
- `npm run db:push` - Push database schema changes
- `npm run db:setup` - Set up database tables

### 🚫 Deprecated Commands

- ~~`npm run dev`~~ - **DEPRECATED:** Use `./dev.sh up` instead
- ~~`npm run start`~~ - **DEPRECATED:** Production deployment only

## 🔐 Authentication

The platform uses JWT-based authentication with the following features:

- **Access tokens** with configurable expiration
- **Refresh tokens** for seamless session management
- **Automatic token refresh** before expiration
- **Secure storage** in localStorage with encryption
- **Session management** with proper cleanup

### Login Flow

1. User submits credentials
2. Server validates and returns JWT tokens
3. Client stores tokens securely
4. Subsequent requests include Bearer token
5. Automatic refresh before token expiration

## 🌐 Real-time Features

### WebSocket Connection

The platform maintains a persistent WebSocket connection for real-time updates:

- **Auto-reconnection** with exponential backoff
- **Heartbeat monitoring** to detect connection health
- **Event-driven updates** for regulations and compliance data
- **Graceful degradation** when WebSocket is unavailable

### Supported Events

- `reg_version_advanced` - Regulation version updates
- `compliance_status_changed` - Compliance status changes
- `deadline_approaching` - Upcoming deadline notifications

## 📊 Data Management

### Delta Synchronization

Efficient data updates using cursor-based pagination:

```typescript
// Fetch updates since last cursor
GET /v1/regs?since_version=12345

// Response includes new data and latest cursor
{
  "data": [...],
  "latest_version": 12346,
  "has_more": false
}
```

### Rate Limiting

The platform implements intelligent rate limiting:

- **100 requests/minute** for general API calls
- **10 bulk refreshes/day** for complete data synchronization
- **Automatic retry** with exponential backoff
- **User-friendly notifications** for rate limit events

## 🧪 Testing

### Unit Tests

Run unit tests for hooks and utilities:

```bash
npm run test
```

### End-to-End Tests

Run complete user workflow tests:

```bash
npm run test:e2e
```

### Test Coverage

- Authentication flows
- API error handling
- WebSocket connectivity
- Rate limiting behavior
- Data synchronization

## 🚀 Deployment

### Production Build

```bash
npm run build
```

### Environment Setup

Ensure all required environment variables are configured for your target environment:

- Production API endpoints
- Tenant configuration
- Security certificates
- Monitoring services

## 🔍 Monitoring & Observability

### Error Tracking

Configure Sentry for comprehensive error monitoring:

```env
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Performance Monitoring

- WebSocket connection health
- API response times
- Authentication success rates
- Data synchronization metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Check the documentation
- Review existing issues
- Create a new issue with detailed information
- Contact the development team

---

**Built with ❤️ for higher education compliance management**
