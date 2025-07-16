#!/bin/zsh

# EdSteward Admin Console Development Manager
# Complete rebuild of admin.edsteward.ai with modern SaaS admin features

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
print_banner() {
    echo -e "${RED}"
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗██████╗ ███████╗████████╗███████╗██╗    ██╗        ║
║   ██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔════╝██║    ██║        ║
║   █████╗  ██║  ██║███████╗   ██║   █████╗  ██║ █╗ ██║        ║
║   ██╔══╝  ██║  ██║╚════██║   ██║   ██╔══╝  ██║███╗██║        ║
║   ███████╗██████╔╝███████║   ██║   ███████╗╚███╔███╔╝        ║
║   ╚══════╝╚═════╝ ╚══════╝   ╚═╝   ╚══════╝ ╚══╝╚══╝         ║
║                                                               ║
║           🚀 ADMIN CONSOLE DEVELOPMENT v2.0 🚀               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Help text
show_help() {
    print_banner
    echo -e "${CYAN}EdSteward Admin Console Development Manager${NC}"
    echo ""
    echo -e "${YELLOW}COMMANDS:${NC}"
    echo "  ${GREEN}start${NC}     - Start admin console development environment"
    echo "  ${GREEN}stop${NC}      - Stop admin console development environment"
    echo "  ${GREEN}restart${NC}   - Restart admin console development environment"
    echo "  ${GREEN}logs${NC}      - View live logs from admin console"
    echo "  ${GREEN}shell${NC}     - Access admin console container shell"
    echo "  ${GREEN}status${NC}    - Check admin console container status"
    echo "  ${GREEN}build${NC}     - Build admin console Docker image"
    echo "  ${GREEN}clean${NC}     - Clean up containers, images, and volumes"
    echo "  ${GREEN}install${NC}   - Install admin console dependencies"
    echo "  ${GREEN}test${NC}      - Run admin console tests"
    echo "  ${GREEN}lint${NC}      - Run linting and type checking"
    echo "  ${GREEN}setup${NC}     - Initial setup for admin console development"
    echo "  ${GREEN}health${NC}    - Check admin console health"
    echo "  ${GREEN}db${NC}        - Database operations (connect, migrate, seed)"
    echo ""
    echo -e "${YELLOW}FEATURES INCLUDED:${NC}"
    echo "  • User Management & Access Control (RBAC, SSO)"
    echo "  • Audit Logs & Activity Monitoring" 
    echo "  • Security & Compliance Management"
    echo "  • Real-time Dashboard & Analytics"
    echo "  • Usage Tracking & Resource Optimization"
    echo "  • Automated Workflows & Task Management"
    echo "  • Comprehensive Reporting & Data Export"
    echo "  • Integration Capabilities"
    echo "  • Alert & Notification System"
    echo "  • Customer Management"
    echo "  • Feature Flag Management"
    echo ""
    echo -e "${BLUE}ACCESS URLs:${NC}"
    echo "  Frontend: ${CYAN}http://localhost:3001${NC}"
    echo "  API:      ${CYAN}http://localhost:3000${NC}"
    echo "  MailHog:  ${CYAN}http://localhost:8025${NC}"
    echo "  Redis:    ${CYAN}localhost:6380${NC}"
    echo ""
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}✗ Missing dependencies: ${missing_deps[*]}${NC}"
        echo -e "${YELLOW}Please install the missing dependencies and try again.${NC}"
        exit 1
    fi
}

# Start admin console
start_admin() {
    echo -e "${BLUE}🚀 Starting EdSteward Admin Console Development Environment${NC}"
    echo -e "${YELLOW}📍 Building comprehensive SaaS administration platform...${NC}"
    echo ""
    
    # Stop customer dev if running to avoid conflicts
    echo -e "${YELLOW}🛑 Stopping customer development environment...${NC}"
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    
    # Start admin development
    echo -e "${YELLOW}🔧 Starting admin console development environment...${NC}"
    cd admin-console
    docker-compose -f docker-compose.admin.yml up -d --build
    
    echo ""
    echo -e "${GREEN}✅ Admin Console Development Environment Ready!${NC}"
    echo ""
    echo -e "${CYAN}🌐 Access your admin console at:${NC}"
    echo -e "  ${CYAN}http://localhost:3001${NC}"
    echo ""
    echo -e "${PURPLE}🎨 Admin Console Features:${NC}"
    echo -e "  • ${GREEN}Modern red-themed admin interface${NC}"
    echo -e "  • ${GREEN}User Management & RBAC${NC}"
    echo -e "  • ${GREEN}Real-time system monitoring${NC}"
    echo -e "  • ${GREEN}Customer deployment tools${NC}"
    echo -e "  • ${GREEN}Audit logging & security${NC}"
    echo -e "  • ${GREEN}Feature flag management${NC}"
    echo -e "  • ${GREEN}Automated workflows${NC}"
    echo -e "  • ${GREEN}Comprehensive reporting${NC}"
    echo ""
    echo -e "${BLUE}🔑 Login Credentials:${NC}"
    echo -e "  Username: ${CYAN}admin@edsteward.com${NC}"
    echo -e "  Password: ${CYAN}admin123${NC}"
    echo ""
    echo -e "${YELLOW}💡 Admin Development Commands:${NC}"
    echo -e "  ./admin-dev.sh logs     ${GREEN}# View live logs${NC}"
    echo -e "  ./admin-dev.sh stop     ${GREEN}# Stop admin dev${NC}"
    echo -e "  ./admin-dev.sh status   ${GREEN}# Check status${NC}"
    echo ""
}

# Stop admin console
stop_admin() {
    echo -e "${YELLOW}🛑 Stopping Admin Console Development Environment${NC}"
    cd admin-console
    docker-compose -f docker-compose.admin.yml down
    echo -e "${GREEN}✅ Admin development environment stopped${NC}"
}

# Show logs
show_logs() {
    echo -e "${BLUE}📋 Admin Console Live Logs${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit logs${NC}"
    echo ""
    cd admin-console
    docker-compose -f docker-compose.admin.yml logs -f
}

# Show status
show_status() {
    echo -e "${BLUE}📊 Admin Console Status${NC}"
    echo ""
    cd admin-console
    docker-compose -f docker-compose.admin.yml ps
    echo ""
    
    # Health checks
    echo -e "${BLUE}🏥 Health Checks${NC}"
    echo -n "Frontend: "
    if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
    
    echo -n "API: "
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
    
    echo -n "Redis: "
    if docker exec edsteward-admin-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${RED}❌ Disconnected${NC}"
    fi
}

# Access shell
access_shell() {
    echo -e "${BLUE}🐚 Accessing Admin Console Container Shell${NC}"
    docker exec -it edsteward-admin-console /bin/bash
}

# Build containers
build_admin() {
    echo -e "${BLUE}🔨 Building Admin Console Docker Images${NC}"
    cd admin-console
    docker-compose -f docker-compose.admin.yml build --no-cache
    echo -e "${GREEN}✅ Build completed${NC}"
}

# Clean up
clean_admin() {
    echo -e "${YELLOW}🧹 Cleaning Admin Console Development Environment${NC}"
    echo -e "${RED}This will remove all containers, images, and volumes. Continue? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        cd admin-console
        docker-compose -f docker-compose.admin.yml down -v --rmi all
        docker system prune -f
        echo -e "${GREEN}✅ Cleanup completed${NC}"
    else
        echo -e "${YELLOW}Cleanup cancelled${NC}"
    fi
}

# Install dependencies
install_deps() {
    echo -e "${BLUE}📦 Installing Admin Console Dependencies${NC}"
    cd admin-console
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Run tests
run_tests() {
    echo -e "${BLUE}🧪 Running Admin Console Tests${NC}"
    cd admin-console
    npm run test
}

# Run linting
run_lint() {
    echo -e "${BLUE}🔍 Running Linting and Type Checking${NC}"
    cd admin-console
    npm run lint
    npx tsc --noEmit
}

# Initial setup
setup_admin() {
    echo -e "${BLUE}⚙️ Setting Up Admin Console Development Environment${NC}"
    
    check_dependencies
    
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    cd admin-console
    npm install
    
    echo -e "${YELLOW}🔨 Building Docker images...${NC}"
    docker-compose -f docker-compose.admin.yml build
    
    echo -e "${GREEN}✅ Setup completed! Run './admin-dev.sh start' to begin development.${NC}"
}

# Health check
health_check() {
    echo -e "${BLUE}🏥 Admin Console Health Check${NC}"
    echo ""
    
    local healthy=true
    
    # Check if containers are running
    if ! docker ps | grep -q edsteward-admin-console; then
        echo -e "${RED}❌ Admin console container not running${NC}"
        healthy=false
    else
        echo -e "${GREEN}✅ Admin console container running${NC}"
    fi
    
    # Check frontend accessibility
    if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend accessible${NC}"
    else
        echo -e "${RED}❌ Frontend not accessible${NC}"
        healthy=false
    fi
    
    # Check API accessibility
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API accessible${NC}"
    else
        echo -e "${RED}❌ API not accessible${NC}"
        healthy=false
    fi
    
    if $healthy; then
        echo ""
        echo -e "${GREEN}🎉 All systems operational!${NC}"
        echo -e "${CYAN}Access admin console: http://localhost:3001${NC}"
    else
        echo ""
        echo -e "${RED}⚠️ Some issues detected. Run './admin-dev.sh logs' for details.${NC}"
    fi
}

# Database operations
db_operations() {
    echo -e "${BLUE}🗄️ Database Operations${NC}"
    echo "1. Connect to database"
    echo "2. Run migrations" 
    echo "3. Seed sample data"
    echo "4. Backup database"
    echo "5. Restore database"
    echo ""
    echo -n "Select operation (1-5): "
    read -r choice
    
    case $choice in
        1)
            echo -e "${BLUE}Connecting to database...${NC}"
            docker exec -it edsteward-admin-api npx drizzle-kit studio
            ;;
        2)
            echo -e "${BLUE}Running migrations...${NC}"
            docker exec -it edsteward-admin-api npm run db:migrate
            ;;
        3)
            echo -e "${BLUE}Seeding sample data...${NC}"
            docker exec -it edsteward-admin-api npm run db:seed
            ;;
        4)
            echo -e "${BLUE}Creating database backup...${NC}"
            # Implementation for backup
            ;;
        5)
            echo -e "${BLUE}Restoring database...${NC}"
            # Implementation for restore
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

# Main command handler
case "${1:-help}" in
    "start"|"up")
        check_dependencies
        start_admin
        ;;
    "stop"|"down")
        stop_admin
        ;;
    "restart")
        stop_admin
        sleep 2
        start_admin
        ;;
    "logs")
        show_logs
        ;;
    "shell"|"bash")
        access_shell
        ;;
    "status"|"ps")
        show_status
        ;;
    "build")
        build_admin
        ;;
    "clean")
        clean_admin
        ;;
    "install")
        install_deps
        ;;
    "test")
        run_tests
        ;;
    "lint")
        run_lint
        ;;
    "setup")
        setup_admin
        ;;
    "health")
        health_check
        ;;
    "db")
        db_operations
        ;;
    "help"|*)
        show_help
        ;;
esac 