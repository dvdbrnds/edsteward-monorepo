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
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install global npm packages for development
RUN npm install -g \
    nodemon \
    pm2 \
    @parcel/bundler \
    eslint \
    prettier

# Set up workspace
WORKDIR /workspace

# Copy package files for dependency installation
COPY package*.json ./

# Install project dependencies
RUN npm install

# Create necessary directories
RUN mkdir -p /home/vscode/.cursor \
    && mkdir -p /workspace/logs \
    && mkdir -p /workspace/data \
    && chown -R vscode:vscode /home/vscode/.cursor \
    && chown -R vscode:vscode /workspace

# Switch to vscode user
USER vscode

# Set environment variables
ENV NODE_ENV=development
ENV MCP_ENVIRONMENT=devcontainer
ENV PATH="/home/vscode/.local/bin:$PATH"
