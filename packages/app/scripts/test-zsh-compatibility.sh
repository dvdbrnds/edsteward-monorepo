#!/bin/zsh
# Test script to verify zsh compatibility and AWS CLI settings

set -e

# Fix AWS CLI pager issues on macOS
export AWS_PAGER=""

echo "🧪 Testing zsh compatibility and AWS CLI settings..."

# Test 1: Check shell
echo "Shell: $SHELL"
echo "ZSH Version: $ZSH_VERSION"

# Test 2: Test array syntax
echo "Testing zsh array syntax..."
TEST_STRING="subnet-1 subnet-2 subnet-3"
TEST_ARRAY=(${=TEST_STRING})
echo "Array elements: ${#TEST_ARRAY[@]}"
echo "First element: ${TEST_ARRAY[1]}"
echo "Second element: ${TEST_ARRAY[2]}"

# Test 3: Test AWS CLI (non-destructive)
echo "Testing AWS CLI..."
echo "AWS CLI Version:"
aws --version

echo "AWS Region:"
aws configure get region || echo "No default region set"

echo "Testing AWS CLI pager setting..."
export AWS_PAGER=""
echo "AWS_PAGER is set to: '$AWS_PAGER'"

# Test 4: Test AWS CLI command that might hang without pager fix
echo "Testing AWS CLI command (this should not hang)..."
timeout 10 aws sts get-caller-identity --output table 2>/dev/null || echo "AWS CLI test completed (may have timed out if not configured)"

echo "✅ zsh compatibility test completed!" 