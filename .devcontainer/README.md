# EdSteward Dev Containers Setup

This directory contains multiple Dev Container configurations for different development workflows in EdSteward. These configurations integrate seamlessly with your existing Docker Compose setup and colima environment.

## Prerequisites

1. **VS Code with Dev Containers Extension**: Install the Dev Containers extension (`ms-vscode-remote.remote-containers`)
2. **colima and Docker**: Your existing setup is perfect! The dev containers will work with colima just like your current Docker workflow
3. **Running Services**: Make sure colima is running (`colima status`)

## Available Dev Container Configurations

### 1. 📱 Customer Development (Default)

**File**: `.devcontainer/devcontainer.json`

- **Purpose**: Work on the main EdSteward customer-facing application
- **Services**: Customer app on port 3000
- **Database**: Uses production Neon database
- **Best for**: Customer feature development, UI/UX work, customer-facing bug fixes

### 2. 🔧 Admin Console Development  

**File**: `.devcontainer/admin/devcontainer.json`

- **Purpose**: Work on the admin console application
- **Services**: Admin console (port 3001) + Redis (port 6380)
- **Best for**: Admin features, dashboard development, user management

### 3. 🌟 Full-Stack Development

**File**: `.devcontainer/fullstack/devcontainer.json`

- **Purpose**: Work on both customer and admin applications simultaneously
- **Services**: Customer app (3000) + Admin console (3001) + Redis (6380)
- **Best for**: Cross-platform features, integration testing, comprehensive development

## How to Use

### Quick Start

1. **Open Command Palette**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P`
2. **Run**: `Dev Containers: Reopen in Container`
3. **Choose Configuration**: Select the appropriate dev container for your work

### Switching Between Configurations

```bash
# For customer development (default)
Dev Containers: Reopen in Container → EdSteward Customer Development

# For admin development  
Dev Containers: Reopen in Container → EdSteward Admin Console Development

# For full-stack development
Dev Containers: Reopen in Container → EdSteward Full-Stack Development
```

### Working with Multiple Configurations

You can open multiple VS Code windows, each with different dev containers:

- **Window 1**: Customer development container (port 3000)
- **Window 2**: Admin development container (port 3001)

## Integration with Existing Workflow

These dev containers work alongside your existing setup:

### 🔄 Compatibility with Current Setup

- **Uses your existing Docker Compose files**: No changes needed to `docker-compose.dev.yml` or `docker-compose.admin.yml`
- **Works with colima**: Dev containers use the same Docker daemon as your current workflow
- **Preserves your scripts**: Your `./dev.sh` and `./admin-dev.sh` scripts continue to work normally

### 🚀 Parallel Development

You can mix and match approaches:

```bash
# Traditional approach (continues to work)
./dev.sh up          # Customer app via script
./admin-dev.sh up    # Admin console via script

# Dev Container approach (new option)
# Use VS Code Dev Containers extension
```

## Features Included in All Containers

### 🛠 Development Tools

- **Node.js 18**: Consistent with your production environment
- **Git**: For version control
- **GitHub CLI**: For GitHub operations
- **ESLint + Prettier**: Code formatting and linting
- **TypeScript**: Full TypeScript support

### 📦 VS Code Extensions (Auto-installed)

- Tailwind CSS IntelliSense
- ESLint
- Prettier
- TypeScript
- Code Spell Checker
- YAML/JSON support
- Docker extension

### ⚡ Performance Optimizations

- Volume mounts for `node_modules` (faster installs)
- Health checks for all services
- Memory limits and reservations
- Automatic dependency installation

## Port Mapping

| Service | Port | Dev Container |
|---------|------|---------------|
| Customer App | 3000 | All configurations |
| Admin Console | 3001 | Admin & Full-Stack |
| Redis | 6380 | Admin & Full-Stack |

## Environment Variables

All containers automatically configure:

- **NODE_ENV**: `development`
- **Database connections**: Your existing Neon PostgreSQL setup
- **Session secrets**: Development keys
- **Admin-specific vars**: `VITE_ADMIN_MODE=true` for admin containers

## Troubleshooting

### Dev Container Won't Start

1. **Check colima**: `colima status` and `colima start` if needed
2. **Check Docker**: `docker ps` to see running containers
3. **Rebuild container**: `Dev Containers: Rebuild Container`

### Port Conflicts

If you get port conflicts:

1. Stop existing containers: `./dev.sh down` and `./admin-dev.sh down`
2. Or use dev containers exclusively
3. Check what's using ports: `lsof -i :3000 -i :3001 -i :6380`

### Performance Issues

- Dev containers include volume optimizations for `node_modules`
- Use `Dev Containers: Rebuild Container` if dependencies are stale
- colima provides better performance than Docker Desktop on macOS

## Advanced Usage

### Custom Configuration

You can modify the `devcontainer.json` files to:

- Add more VS Code extensions
- Configure additional environment variables  
- Mount additional volumes
- Add more development tools

### Multi-Root Workspaces

For full-stack development, you can create a VS Code workspace file:

```json
{
  "folders": [
    { "path": "." },
    { "path": "./admin-console" }
  ]
}
```

## Integration with Your Deployment Pipeline

These dev containers are purely for development and don't affect:

- Your production deployments to AWS ECS
- Your existing GitHub Actions workflows  
- Your current Docker build processes
- Your staging/beta environments

The containers use your same source code and database connections, ensuring development-production parity.

## Next Steps

1. **Try the default configuration**: Start with customer development
2. **Experiment with full-stack**: Use the full-stack container for comprehensive work
3. **Customize as needed**: Modify `devcontainer.json` files for your preferences
4. **Mix approaches**: Use dev containers for some work, traditional scripts for others

The beauty of this setup is flexibility - you can use whatever approach works best for each task! 🚀
