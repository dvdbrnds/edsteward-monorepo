#!/bin/zsh

# EdSteward Test Regulations Cleanup Script
# Simple wrapper for the Node.js test regulations removal script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOVAL_SCRIPT="$SCRIPT_DIR/remove-test-regulations-production.cjs"

echo -e "${BLUE}🚀 EdSteward Test Regulations Cleanup${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if the removal script exists
if [ ! -f "$REMOVAL_SCRIPT" ]; then
    echo -e "${RED}❌ Error: Removal script not found at $REMOVAL_SCRIPT${NC}"
    exit 1
fi

# Script now uses hardcoded Neon tenant database URLs
echo -e "${GREEN}🏗️  Using Neon multi-tenant database architecture${NC}"

# Function to show usage
show_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo -e "  $0 preview    # Show what would be removed (safe)"
    echo -e "  $0 dry-run    # Test the logic without making changes"
    echo -e "  $0 execute    # Actually remove test regulations (requires confirmation)"
    echo -e "  $0 help       # Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  $0 preview    # Start with this to see what will be removed"
    echo -e "  $0 execute    # Run after confirming the preview looks correct"
}

# Function to confirm execution
confirm_execution() {
    echo -e "${RED}⚠️  WARNING: This will permanently delete test regulations from production!${NC}"
    echo -e "${YELLOW}📋 What will happen:${NC}"
    echo -e "   • Test regulations will be identified across all tenant databases"
    echo -e "   • Automatic backups will be created"
    echo -e "   • Related data (notes, deadlines, etc.) will be removed"
    echo -e "   • This action cannot be easily undone"
    echo ""
    echo -e "${BLUE}💡 Make sure you've run 'preview' mode first!${NC}"
    echo ""
    read -p "Are you absolutely sure you want to proceed? (type 'yes' to continue): " response
    
    if [ "$response" != "yes" ]; then
        echo -e "${YELLOW}❌ Operation cancelled${NC}"
        exit 0
    fi
}

# Main logic
case "${1:-help}" in
    "preview")
        echo -e "${GREEN}🔍 Running in PREVIEW mode (safe - no changes made)${NC}"
        echo -e "${BLUE}This will show you what test regulations would be removed.${NC}"
        echo ""
        cd "$PROJECT_ROOT"
        node "$REMOVAL_SCRIPT"
        ;;
        
    "dry-run")
        echo -e "${GREEN}🧪 Running in DRY-RUN mode (safe - creates backups but no deletion)${NC}"
        echo -e "${BLUE}This tests the logic and creates backups without making changes.${NC}"
        echo ""
        cd "$PROJECT_ROOT"
        node "$REMOVAL_SCRIPT" --dry-run
        ;;
        
    "execute")
        echo -e "${RED}🔥 Running in EXECUTION mode (DANGER - will delete test regulations)${NC}"
        confirm_execution
        echo -e "${GREEN}✅ Proceeding with test regulations removal...${NC}"
        echo ""
        cd "$PROJECT_ROOT"
        node "$REMOVAL_SCRIPT" --force
        echo ""
        echo -e "${GREEN}✅ Test regulations cleanup completed!${NC}"
        echo -e "${BLUE}💾 Check the backups directory for removed data${NC}"
        ;;
        
    "help"|"--help"|"-h")
        show_usage
        ;;
        
    *)
        echo -e "${RED}❌ Error: Unknown command '$1'${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac

echo -e "${BLUE}📚 For detailed documentation, see: scripts/README-test-regulations-removal.md${NC}" 