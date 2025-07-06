#!/bin/zsh

# Documentation Verification Script
# Verifies documentation integrity and structure following Context7 best practices

set -e

echo "🔍 EdSteward Documentation Verification"
echo "======================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0

check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $1"
        ((CHECKS_FAILED++))
    fi
}

# 1. Verify references folder exists
echo "\n📁 Checking references folder structure..."
test -d "references"
check_status "References folder exists"

# 2. Verify critical documentation files
echo "\n📄 Checking critical documentation files..."
critical_files=(
    "references/ARCHITECTURE.md"
    "references/DEPLOYMENT_PIPELINE_DOCUMENTATION.md"
    "references/MULTI_TENANT_ARCHITECTURE.md"
    "references/AUTHENTICATION_FIX_SUCCESS_SUMMARY.md"
)

for file in "${critical_files[@]}"; do
    test -f "$file"
    check_status "Critical file: $file"
done

# 3. Count total documentation files
echo "\n📊 Documentation Statistics..."
md_count=$(find references/ -name "*.md" | wc -l | tr -d ' ')
echo "   Total Markdown files: $md_count"

if [ $md_count -ge 100 ]; then
    echo -e "${GREEN}✓${NC} Documentation count is healthy ($md_count files)"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Documentation count seems low ($md_count files, expected 100+)"
    ((CHECKS_FAILED++))
fi

# 4. Verify deprecated folder isolation
echo "\n🗂️  Checking deprecated documentation isolation..."
test -d "references/deprecated"
check_status "Deprecated folder exists"

deprecated_count=$(find references/deprecated/ -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "   Deprecated files: $deprecated_count"

# 5. Check for empty or broken documentation
echo "\n🔍 Checking documentation integrity..."
empty_files=$(find references/ -name "*.md" -empty)
if [ -z "$empty_files" ]; then
    echo -e "${GREEN}✓${NC} No empty documentation files found"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} Found empty documentation files:"
    echo "$empty_files"
    ((CHECKS_FAILED++))
fi

# 6. Verify mkdocs.yml exists (if we have mkdocs setup)
echo "\n⚙️  Checking documentation tooling..."
test -f "mkdocs.yml"
check_status "MkDocs configuration exists"

# 7. Check for documentation links integrity (basic)
echo "\n🔗 Checking internal documentation links..."
broken_links=$(grep -r "](references/" references/ | grep -v "references/.*\.md" | head -5)
if [ -z "$broken_links" ]; then
    echo -e "${GREEN}✓${NC} No obvious broken internal links found"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Potential broken internal links found (sample):"
    echo "$broken_links"
    ((CHECKS_FAILED++))
fi

# 8. Verify git tracking of documentation
echo "\n📋 Checking git tracking..."
untracked_docs=$(git ls-files --others --exclude-standard references/ | head -5)
if [ -z "$untracked_docs" ]; then
    echo -e "${GREEN}✓${NC} All documentation files are tracked by git"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Found untracked documentation files:"
    echo "$untracked_docs"
    ((CHECKS_FAILED++))
fi

# Summary
echo "\n📈 Verification Summary"
echo "======================"
echo "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
echo "Checks failed: ${RED}$CHECKS_FAILED${NC}"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All documentation verification checks passed!${NC}"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}Some documentation issues found. Please review above.${NC}"
    exit 1
fi 