#!/bin/zsh

# ============================================================================
# EdSteward Release Tagging Script
# ============================================================================
# Create semantic version tags for releases.
#
# Usage:
#   ./scripts/tag-release.sh <major|minor|patch>  # Auto-increment
#   ./scripts/tag-release.sh v1.2.3               # Specific version
#
# Examples:
#   ./scripts/tag-release.sh patch   # v1.2.3 -> v1.2.4
#   ./scripts/tag-release.sh minor   # v1.2.3 -> v1.3.0
#   ./scripts/tag-release.sh major   # v1.2.3 -> v2.0.0
#   ./scripts/tag-release.sh v2.0.0  # Set specific version
#
# This script will:
#   1. Determine the next version number
#   2. Create a git tag
#   3. Optionally build and push the Docker image
# ============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# Parse arguments
VERSION_TYPE="${1:-}"

if [[ -z "$VERSION_TYPE" ]]; then
    echo -e "${RED}Error: Version type or tag required${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/tag-release.sh <major|minor|patch>  # Auto-increment"
    echo "  ./scripts/tag-release.sh v1.2.3               # Specific version"
    echo ""
    echo "Examples:"
    echo "  ./scripts/tag-release.sh patch   # v1.2.3 -> v1.2.4 (bug fixes)"
    echo "  ./scripts/tag-release.sh minor   # v1.2.3 -> v1.3.0 (new features)"
    echo "  ./scripts/tag-release.sh major   # v1.2.3 -> v2.0.0 (breaking changes)"
    exit 1
fi

print_banner "EdSteward Release Tagging"

# Get the latest version tag
get_latest_version() {
    git tag -l 'v*.*.*' | sort -V | tail -n 1 || echo "v0.0.0"
}

# Increment version
increment_version() {
    local version="$1"
    local type="$2"
    
    # Remove 'v' prefix
    version="${version#v}"
    
    # Parse version parts
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    local patch=$(echo "$version" | cut -d. -f3 | cut -d- -f1)  # Remove any suffix
    
    case "$type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            error "Invalid version type: $type"
            ;;
    esac
    
    echo "v${major}.${minor}.${patch}"
}

# Determine new version
LATEST_VERSION=$(get_latest_version)
log "Latest version tag: $LATEST_VERSION"

case "$VERSION_TYPE" in
    major|minor|patch)
        NEW_VERSION=$(increment_version "$LATEST_VERSION" "$VERSION_TYPE")
        log "Incrementing $VERSION_TYPE: $LATEST_VERSION -> $NEW_VERSION"
        ;;
    v*)
        # Specific version provided
        if [[ ! "$VERSION_TYPE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            error "Invalid version format: $VERSION_TYPE. Use: v{major}.{minor}.{patch}"
        fi
        NEW_VERSION="$VERSION_TYPE"
        log "Using specified version: $NEW_VERSION"
        ;;
    *)
        error "Invalid argument: $VERSION_TYPE. Use: major, minor, patch, or v{major}.{minor}.{patch}"
        ;;
esac

# Check if tag already exists
if git tag -l "$NEW_VERSION" | grep -q "$NEW_VERSION"; then
    error "Tag $NEW_VERSION already exists!"
fi

# Check for uncommitted changes
if has_uncommitted_changes; then
    echo ""
    warn "You have uncommitted changes:"
    git status --short
    echo ""
    read "?Commit these changes before tagging? (Y/n): " confirm
    if [[ "$confirm" != "n" && "$confirm" != "N" ]]; then
        echo ""
        read "?Enter commit message: " commit_message
        if [[ -z "$commit_message" ]]; then
            commit_message="Prepare release $NEW_VERSION"
        fi
        git add -A
        git commit -m "$commit_message"
        success "Changes committed"
    else
        warn "Proceeding with uncommitted changes (they won't be in this tag)"
    fi
fi

# Show what will be tagged
echo ""
echo -e "${CYAN}Release Summary:${NC}"
echo -e "  ${BLUE}Version:${NC}     $NEW_VERSION"
echo -e "  ${BLUE}Previous:${NC}    $LATEST_VERSION"
echo -e "  ${BLUE}Branch:${NC}      $(get_git_branch)"
echo -e "  ${BLUE}Commit:${NC}      $(get_commit_sha)"
echo ""

# Show recent commits since last tag
if [[ "$LATEST_VERSION" != "v0.0.0" ]]; then
    echo -e "${CYAN}Changes since $LATEST_VERSION:${NC}"
    git log --oneline "${LATEST_VERSION}..HEAD" 2>/dev/null | head -15 || echo "  (no commits since last tag)"
    echo ""
fi

# Confirm
read "?Create tag $NEW_VERSION? (Y/n): " confirm
if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
    echo "Cancelled."
    exit 0
fi

# Create the tag
log "Creating git tag: $NEW_VERSION"
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"
success "Tag created: $NEW_VERSION"

# Optionally push the tag
echo ""
read "?Push tag to remote? (Y/n): " push_confirm
if [[ "$push_confirm" != "n" && "$push_confirm" != "N" ]]; then
    log "Pushing tag to remote..."
    git push origin "$NEW_VERSION"
    success "Tag pushed to remote"
fi

# Optionally build and push Docker image
echo ""
read "?Build and push Docker image now? (Y/n): " build_confirm
if [[ "$build_confirm" != "n" && "$build_confirm" != "N" ]]; then
    echo ""
    step "Building Docker image..."
    
    # Pre-flight checks
    run_preflight_checks
    
    # Build frontend
    clear_port 3000
    build_frontend
    
    # Build Docker image
    build_docker_image "$NEW_VERSION"
    
    # Login and push
    ecr_login
    push_docker_image "$NEW_VERSION"
    
    success "Docker image $NEW_VERSION built and pushed to ECR"
fi

# Update CHANGELOG if it exists
CHANGELOG="$(get_project_root)/CHANGELOG.md"
if [[ -f "$CHANGELOG" ]]; then
    echo ""
    read "?Update CHANGELOG.md? (Y/n): " changelog_confirm
    if [[ "$changelog_confirm" != "n" && "$changelog_confirm" != "N" ]]; then
        # Create changelog entry template
        CHANGELOG_ENTRY="## [$NEW_VERSION] - $(date +%Y-%m-%d)

### Added
- 

### Changed
- 

### Fixed
- 

"
        # Prepend to changelog (after the header)
        if grep -q "^## \[" "$CHANGELOG"; then
            # Insert after first line that starts with ##
            sed -i '' "/^## \[/i\\
$CHANGELOG_ENTRY
" "$CHANGELOG" 2>/dev/null || warn "Could not auto-update CHANGELOG"
        fi
        
        echo ""
        warn "Please update CHANGELOG.md with release notes for $NEW_VERSION"
        echo "  File: $CHANGELOG"
    fi
fi

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    RELEASE TAG CREATED!                                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Version:${NC}  $NEW_VERSION"
echo -e "  ${CYAN}Commit:${NC}   $(git rev-parse --short HEAD)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Deploy to staging:"
echo ""
echo -e "     ${CYAN}./scripts/deploy-staging.sh $NEW_VERSION${NC}"
echo ""
echo "  2. Test on staging.edsteward.ai"
echo ""
echo "  3. Deploy to production:"
echo ""
echo -e "     ${CYAN}./scripts/deploy-production.sh $NEW_VERSION${NC}"
echo ""
