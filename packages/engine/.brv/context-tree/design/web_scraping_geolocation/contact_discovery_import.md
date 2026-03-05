## Athletic Association Platform - Web Scraping Feature Complete

Successfully implemented a comprehensive web scraping system with geolocation capabilities to automatically discover and import athletic association contacts.

### Backend Implementation

**Scraping Service** (`backend/src/services/scrapingService.ts`):
```typescript
// Core scraping functionality
- scrapeWebsite(url): Scrapes individual website for contact info
- Extracts: emails, phones, addresses, zipcodes, states using regex
- Uses Cheerio for HTML parsing
- Automatic content cleaning and normalization
- Extracts association names from page titles and headers
- Identifies contact names from specific selectors
- Returns structured contact data

// Pattern extraction functions
- extractEmails(): Finds all email addresses
- extractPhones(): Finds phone numbers (multiple formats)
- extractZipCodes(): Finds 5 or 9-digit zipcodes
- extractStates(): Finds 2-letter state codes
```

**Geolocation Service** (`backend/src/services/geocodingService.ts`):
```typescript
// Uses OpenStreetMap Nominatim (no API key required)
- geocodeAddress(address): Convert address to lat/long
- geocodeZipCode(zipcode): Lookup coordinates by zipcode
- reverseGeocode(lat, long): Convert coordinates to address
- Returns: latitude, longitude, city, state, zipcode, formatted address
```

**Database Models** (Prisma):
```typescript
model ScrapeJob {
  id, jobName, searchQuery, targetUrl
  status: PENDING | RUNNING | COMPLETED | FAILED | CANCELLED
  totalUrls, processedUrls, successCount, errorCount
  startedAt, completedAt, errorMessage
  scrapedData: ScrapedData[]
}

model ScrapedData {
  id, sourceUrl, associationName, contactName
  email, phone, address, city, state, zipCode
  latitude, longitude  // Geolocation coordinates
  rawData: Json  // Full scraped data
  isImported: boolean
  importedContactId: string?
}
```

**API Endpoints** (`/api/v1/scrape`):
```typescript
POST /scrape/jobs
- Create new scrape job
- Body: { jobName, searchQuery?, targetUrls? }
- Starts background scraping immediately
- Returns job ID and status

GET /scrape/jobs
- List all scrape jobs with progress
- Includes scraped data count

GET /scrape/jobs/:id
- Get job details with all scraped data
- Includes progress, errors, results

GET /scrape/data
- Get scraped data with filtering
- Query params: page, limit, jobId, isImported

POST /scrape/import
- Bulk import scraped data to contacts
- Body: { scrapedDataIds: string[] }
- Creates Contact records
- Marks scraped data as imported
- Prevents duplicates
```

**Scraping Controller Features**:
- Background async processing (no blocking)
- Progress tracking during scraping
- Error handling per URL
- Automatic geocoding of addresses/zipcodes
- Duplicate email detection
- Bulk import with validation
- Status updates: PENDING → RUNNING → COMPLETED/FAILED

### Frontend Implementation

**Web Scraper Dashboard** (`/scraper`):
- Create new scrape jobs dialog
- Input methods:
  * Search query (e.g., "California athletic associations")
  * Direct URL list (one per line)
- Job list table with:
  * Status chips with color coding
  * Progress bars showing URL processing
  * Success/error counts
  * View results button

**Scraped Data Viewer** (`/scraper/:id`):
- Detailed job view with all scraped records
- Table columns: Association, Contact, Email, Phone, Location, URL, Status
- Geolocation indicators (LocationIcon) for mapped contacts
- Bulk select functionality
- "Import to Contacts" button for selected items
- Status chips: Imported (green), No Email (warning), Ready (blue)
- Real-time refresh

**Navigation Update**:
- Added "Web Scraper" menu item with LanguageIcon
- Routes integrated in App.tsx
- Protected by authentication

### Key Features

**Intelligent Data Extraction**:
- Regex-based extraction of contact info
- Multiple phone number formats supported
- Email validation
- Address parsing
- State code identification
- Zipcode detection (5 and 9 digit)

**Automatic Geolocation**:
- Zipcode → coordinates lookup
- Address → coordinates geocoding
- City and state extraction
- No API key required (OpenStreetMap)
- Enriches contact data with location

**Progress Tracking**:
- Real-time job status updates
- URLs processed / total count
- Success and error counts
- Visual progress bars
- Completion timestamps

**Bulk Import**:
- Select multiple scraped records
- One-click import to contacts
- Automatic duplicate checking
- Name parsing (first/last)
- Default election cycle date
- Marks imported records
- Returns import summary with errors

**Error Handling**:
- Per-URL error tracking
- Failed scrapes don't stop job
- Error messages stored
- Job status reflects failures
- Detailed error reporting

### Usage Flow

1. **Create Job**: Navigate to Web Scraper
2. **Configure**: Enter job name and URLs or search query
3. **Monitor**: Watch progress in real-time
4. **Review**: Click "View" to see scraped data
5. **Geolocation**: System automatically maps contacts by zipcode
6. **Select**: Check items to import
7. **Import**: Click "Import X to Contacts" button
8. **Done**: Contacts created and marked as imported

### Technical Stack

**Libraries Added**:
- `cheerio`: HTML parsing and DOM traversal
- `axios`: HTTP requests for fetching websites
- `node-geocoder`: Geolocation and geocoding

**Features**:
- Background async processing
- No blocking operations
- Scalable to thousands of URLs
- Graceful error handling
- Progress persistence
- Duplicate prevention

### Database Schema

**New Tables**:
- `scrape_jobs`: Job tracking and metadata
- `scraped_data`: Extracted contact information with geolocation

**Indexes**:
- scrapeJobId for fast data lookup
- email for duplicate checking
- zipCode for location queries
- isImported for filtering

### Security & Performance

- Authentication required for all endpoints
- Role-based access (USER, MANAGER, ADMIN)
- Rate limiting on external requests
- Timeout protection (10s per URL)
- Graceful failure handling
- Memory-efficient streaming
- Background processing prevents blocking

### Future Enhancements (Not Yet Implemented)

- Google Custom Search API integration
- Proxy rotation for large-scale scraping
- Bull queue for distributed job processing
- Retry logic for failed URLs
- Scheduled recurring scrapes
- Email validation service integration
- Machine learning for better data extraction
- Export scraped data to CSV