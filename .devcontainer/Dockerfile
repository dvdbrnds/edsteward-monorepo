# MCP Engine Development Container
FROM mcr.microsoft.com/devcontainers/javascript-node:18

# Install additional system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    vim \
    htop \
    tree \
    jq \
    postgresql-client \
    redis-tools \
    bc \
    netcat-openbsd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages for development
RUN npm install -g \
    nodemon \
    pm2 \
    eslint \
    prettier \
    parcel

# Create necessary directories with proper permissions
RUN mkdir -p /workspace/logs \
    && mkdir -p /workspace/data \
    && mkdir -p /home/vscode/.cursor \
    && chown -R vscode:vscode /home/vscode \
    && chown -R vscode:vscode /workspace

# Set environment variables
ENV NODE_ENV=development
ENV MCP_ENVIRONMENT=devcontainer
ENV PATH="/home/vscode/.local/bin:$PATH"

# Set workspace as working directory
WORKDIR /workspace

# Switch to vscode user
USER vscode


