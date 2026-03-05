# Compliance Tracker App Overview

## Database Schema and Data

### Regulations Table Structure
The regulations table has an extensive schema with many fields. Here are the key columns:
- `id`: Primary key (integer)
- `item_id`: Unique identifier text string (e.g., "REG1982", "REG-1741205494332")
- `name`: Regulation name
- `topic`: The regulation topic
- `statute`: Legal statute reference
- `category`: Category classification
- `jurisdiction`: Federal or state (defaults to "federal")
- Various date fields: `origination_date`, `effective_date`, `last_updated`, `next_review_date`
- JSON fields like `filing_deadlines`, `notification_schedule`, `actions`

### Sample Regulation Records
The system contains regulations like:
1. "Higher Education Act: Institutional and Financial Assistance Information for Students" (REG1982)
   - Category: Academic Programs
   - Jurisdiction: federal
   - Last updated: March 6, 2025

2. "Regulation ID OSHA-2024-001" (REG-1741205494332)
   - Topic: Workplace Safety Standards
   - Category: Workplace Safety
   - Jurisdiction: federal
   - Last updated: March 5, 2025

## Database Connection
The database connection is configured in `server/db.ts` which:
- Uses the Neon serverless Postgres client
- Gets database URL from environment variables
- Creates a connection pool and Drizzle ORM instance
- Handles different environments (development/production/staging/test)

```typescript
// Key excerpt from db.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Environment-specific database URLs
const dbUrls = {
  production: process.env.DATABASE_URL,
  staging: currentEnv === 'staging' ? process.env.DATABASE_URL : null,
  development: process.env.DATABASE_URL,
  test: currentEnv === 'test' ? process.env.DATABASE_URL : null
};

// Create pool and db instances
export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle({ client: pool, schema });
```

## API Routes
The regulations are exposed via API endpoints in `server/routes.ts`:

1. `GET /api/regulations` - Fetches all regulations
   - Requires user authentication
   - Returns a JSON array of regulation objects
   - Logs access attempts and errors

```typescript
// Main regulations endpoint
app.get("/api/regulations", async (req, res) => {
  try {
    if (!req.user) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to regulations");
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Fetching regulations from storage");
      const regulations = await storage.getRegulations();
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${regulations.length} regulations`);

      return res.json(regulations);
    } catch (dbError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching regulations", {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      return res.status(500).json({ 
        error: "Database error fetching regulations",
        details: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch regulations", {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      error: "Failed to fetch regulations", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
```

2. `GET /api/regulations/:regulationId` - Fetches a specific regulation
   - Takes a regulation ID parameter
   - Returns a single regulation object or 404 if not found

## Database Queries
The database interaction is handled in `server/storage.ts`:

```typescript
async getRegulations(): Promise<Regulation[]> {
  try {
    console.log("Fetching regulations from database...");
    // Add more detailed logging
    const result = await db
      .select()
      .from(regulations)
      .orderBy(desc(regulations.lastUpdated));

    console.log(`Successfully fetched ${result.length} regulations from database`);
    return result;
  } catch (error) {
    console.error("Error in getRegulations:", error);
    // Return empty array instead of throwing to prevent frontend from getting stuck
    return [];
  }
}
```

## Frontend Component
The main component for displaying regulations is `client/src/components/regulations/regulation-list.tsx`:
- Uses React Query to fetch regulations from the API
- Provides sorting and filtering capabilities
- Handles loading and error states
- Supports category and jurisdiction filtering
- Renders regulations in a table format with clickable rows

```tsx
// Key excerpt from regulation-list.tsx
export default function RegulationList({ categoryFilter, jurisdictionFilter, deadlines = [] }: RegulationListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  const { data: regulations = [], isLoading: regulationsLoading, error: regulationsError } = useQuery<Regulation[]>({
    queryKey: ["/api/regulations"],
  });
  
  // ...filtering and rendering logic
}
```

## Troubleshooting Your Local Environment

Based on the information gathered, here are potential reasons why you can't see regulations in your local development environment:

1. **Authentication Issues**: All regulation API endpoints require authentication. The code checks for `req.user` and returns 401 if not authenticated.

2. **Database Connection**: Your local environment may not have the correct DATABASE_URL configured.

3. **Empty Database**: Your local database might not have any regulation records.

4. **API Error Handling**: The frontend handles API errors gracefully by showing an error message, so check your browser console for any API errors.

5. **CORS Issues**: If your frontend is hosted on a different domain than your API, you might face CORS issues.

## How to Fix

To fix these issues in your local environment, you should:

1. Ensure you have the correct DATABASE_URL in your environment variables
2. Verify user authentication is working
3. Check if your database has any regulation records
4. Look for any errors in the browser console or server logs
5. Make sure CORS is properly configured if needed