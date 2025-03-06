import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Constants
const API_URL = 'http://localhost:5000';
const LOG_DIR = path.join(process.cwd(), 'logs');
const TEST_LOG_FILE = path.join(LOG_DIR, 'api-tests.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Helper functions
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? ` - ${JSON.stringify(data, null, 2)}` : ''}\n`;
  console.log(logEntry);
  fs.appendFileSync(TEST_LOG_FILE, logEntry);
};

const testLogin = async () => {
  log('Testing login...');

  const credentials = {
    username: 'admin',
    password: 'password',
  };

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(credentials),
      credentials: 'include',
      redirect: 'manual',
    });

    log('Login response status: -', response.status);

    // Check content type before trying to parse as JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await response.json();
        log('Login response data: -', data);
      } catch (err) {
        log('Failed to parse login response as JSON');
      }
    } else {
      // Log the text response for debugging
      const textResponse = await response.text();
      log('Non-JSON response received:', textResponse.substring(0, 100) + '...');
    }

    if (!response.ok) {
      log('Login failed');
      return null;
    }

    const cookies = response.headers.get('set-cookie');
    log('Login cookies:', cookies);

    if (!cookies) {
      log('No cookies received from login, but will try to use session cookie');
      return 'connect.sid=test-session';
    }

    return cookies;
  } catch (error) {
    log('Login error: -', error);
    return null;
  }
};

const testCreateNote = async (cookies: string | null) => {
  log('Testing note creation...');

  if (!cookies) {
    log('No cookies available, skipping note creation');
    return;
  }

  const noteData = {
    regulationId: 3869,
    title: 'Test Note',
    content: 'This is a test note created via API',
    category: 'general',
    status: 'active',
    isPrivate: false,
  };

  try {
    const response = await fetch(`${API_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
      body: JSON.stringify(noteData),
    });

    log('Create note response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log('Create note error:', errorText);
      return;
    }

    const data = await response.json();
    log('Note created successfully', data);
    return data.id;
  } catch (error) {
    log('Create note error:', error);
  }
};

const testGetNotes = async (cookies: string | null, regulationId: number) => {
  log(`Testing getting notes for regulation ${regulationId}...`);

  if (!cookies) {
    log('No cookies available, skipping get notes');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/regulation/${regulationId}`, {
      headers: {
        'Cookie': cookies,
      },
    });

    log('Get notes response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log('Get notes error:', errorText);
      return;
    }

    const data = await response.json();
    log(`Found ${data.length} notes`, data);
  } catch (error) {
    log('Get notes error:', error);
  }
};

// Run tests
const runTests = async () => {
  log('=== Starting API tests ===');

  const cookies = await testLogin();
  const noteId = await testCreateNote(cookies);
  await testGetNotes(cookies, 3869);

  log('=== Tests completed ===');
};

runTests().catch(error => {
  log('Test error:', error);
});