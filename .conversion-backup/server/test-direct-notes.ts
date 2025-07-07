import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { z } from 'zod';

// Setup logging
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'notes-direct-test.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Start fresh log
fs.writeFileSync(LOG_FILE, `=== NOTES DIRECT TEST (${new Date().toISOString()}) ===\n\n`);

function log(message: string) {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  console.log(entry.trim());
  fs.appendFileSync(LOG_FILE, entry);
}

// Simple test schema validation
async function testSchemaValidation() {
  log("Testing schema validation");

  try {
    // Create a test schema
    const testSchema = z.object({
      regulationId: z.number().positive(),
      userId: z.number().positive(),
      title: z.string().min(1),
      content: z.string().min(1)
    });

    const validData = {
      regulationId: 3869,
      userId: 1,
      title: "Test Note",
      content: "This is a test note"
    };

    const invalidData = {
      regulationId: -1,
      userId: 1,
      title: "",
      content: "This is a test note"
    };

    // Test valid data
    const validResult = testSchema.safeParse(validData);
    log(`Valid data test: ${validResult.success ? 'PASSED' : 'FAILED'}`);

    // Test invalid data
    const invalidResult = testSchema.safeParse(invalidData);
    log(`Invalid data test: ${!invalidResult.success ? 'PASSED' : 'FAILED'}`);
    if (!invalidResult.success) {
      log(`Validation errors: ${JSON.stringify(invalidResult.error.errors)}`);
    }

    return true;
  } catch (error) {
    log(`Schema validation test error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Test direct database operations
async function testDatabaseOperations() {
  log("Testing direct database operations");

  try {
    // Test data
    const testNote = {
      regulationId: 3869,
      userId: 1,
      title: "Direct DB Test Note",
      content: "This is a test note created via direct DB access",
      isPrivate: false
    };

    // Create a note
    log("Creating test note...");
    const createdNote = await storage.createNote(testNote);
    log(`Note created with response: ${JSON.stringify(createdNote, null, 2)}`);

    // Retrieve the note
    if (createdNote && createdNote.id) {
      log(`Retrieving note with ID ${createdNote.id}...`);
      const retrievedNote = await storage.getNote(createdNote.id);
      log(`Note retrieved: ${JSON.stringify(retrievedNote, null, 2)}`);

      // Update the note
      log("Updating note...");
      const updatedNote = await storage.updateNote(createdNote.id, {
        title: "Updated Test Note",
        content: "This note has been updated"
      });
      log(`Note updated: ${JSON.stringify(updatedNote, null, 2)}`);

      // Delete the note
      log("Deleting note...");
      await storage.deleteNote(createdNote.id);
      log("Note deleted");

      // Verify deletion
      const noteAfterDeletion = await storage.getNote(createdNote.id);
      log(`Note after deletion: ${JSON.stringify(noteAfterDeletion, null, 2)}`);
      log(`Deletion verification: ${noteAfterDeletion === null ? 'PASSED' : 'FAILED'}`);
    }

    return true;
  } catch (error) {
    log(`Database operations test error: ${error instanceof Error ? error.message : String(error)}`);
    log(`Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  log("Starting Notes API direct tests");

  const schemaTestResult = await testSchemaValidation();
  log(`Schema validation tests: ${schemaTestResult ? 'PASSED' : 'FAILED'}`);

  const dbTestResult = await testDatabaseOperations();
  log(`Database operations tests: ${dbTestResult ? 'PASSED' : 'FAILED'}`);

  log("Tests completed");
}

// Self-executing async function
(async () => {
  try {
    await runTests();
  } catch (error) {
    log(`Test runner error: ${error instanceof Error ? error.message : String(error)}`);
  }
})();