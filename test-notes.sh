
#!/bin/bash

echo "=== Starting Notes API Test ==="
echo "Building and running test script..."

# Compile TypeScript
echo "Compiling TypeScript..."
npx tsx server/test-notes-api.ts

echo "Test completed. See logs/api-tests.log for results."
echo "=== Test Complete ==="
