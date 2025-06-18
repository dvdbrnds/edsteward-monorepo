
#!/bin/bash

echo "=== Starting Direct Notes API Test ==="
echo "Building and running test script..."

# Compile and run TypeScript
echo "Compiling and running TypeScript..."
npx tsx server/test-direct-notes.ts

echo "Test completed. See logs/notes-direct-test.log for results."
echo "=== Test Complete ==="
