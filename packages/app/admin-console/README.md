# EdSteward Admin Console

**Standalone administrative tool for managing EdSteward customer tenants**

This is a completely separate application from customer instances (like moravian.edsteward.ai). It allows EdSteward staff to manage all customer tenants from one centralized location.

## Architecture

- **Frontend**: React + Vite (Port 3001)
- **Backend**: Node.js + Express (Port 4000) 
- **Database**: Redis for sessions (Port 6381)
- **Deployment**: admin.edsteward.ai

## Development

### Option 1: Docker (Recommended)

```bash
# Start all services
npm run docker:dev

# View logs
npm run docker:logs

# Stop services  
npm run docker:stop
```

### Option 2: Manual Development

```bash
# Terminal 1: Start backend server
npm run dev:admin

# Terminal 2: Start frontend  
npm run dev
```

## Access

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:4000
- **Redis**: localhost:6381

## Login Credentials

- **Email**: admin@edsteward.ai
- **Password**: admin123

## Features

- ✅ Customer Management (view all tenants)
- ✅ System Dashboard with metrics
- ✅ User Authentication for EdSteward staff
- 🚧 Customer User Management 
- 🚧 Tenant Health Monitoring
- 🚧 Customer Onboarding Tools

## API Endpoints

- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin
- `GET /api/dashboard/stats` - System statistics
- `GET /api/customers` - List all customer tenants
- `GET /api/health` - Service health check

## Notes

This admin console is **completely isolated** from customer applications. It connects to customer databases/APIs to manage them but runs as its own separate service. 