## AI-Powered Discovery System Implementation

### Core Technology Stack
- **OpenAI GPT-4o-mini**: For intelligent query generation and data analysis
- **Google Custom Search API**: For executing generated queries
- **Node-geocoder with OpenStreetMap**: For zipcode-to-location conversion

### Backend Architecture

**AI Service (`aiService.ts`)**:
```typescript
import OpenAI from 'openai';

// Generate intelligent search queries
export const generateSearchQueries = async (request: AIDiscoveryRequest) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Expert at finding local youth sports organizations...
        Return JSON array with: query, reasoning, priority (high/medium/low)`
      },
      { role: 'user', content: buildPrompt(request) }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });
  return JSON.parse(response.choices[0].message.content);
};

// Extract city/state from zipcodes
export const extractLocationsFromZipcodes = async (zipcodes: string[]) => {
  // AI identifies geographic locations from zipcodes
};

// Analyze scraped data quality
export const analyzeDataQuality = async (scrapedData: any[]) => {
  // Returns quality score, issues, and improvement suggestions
};
```

**AI Discovery Controller (`aiDiscoveryController.ts`)**:
```typescript
// POST /api/v1/discover/ai/zipcode
export const discoverByZipcode = async (req, res) => {
  const { zipcodes, organizationTypes, maxResults } = req.body;
  
  // 1. Extract cities from zipcodes using AI
  const locations = await extractLocationsFromZipcodes(zipcodes);
  
  // 2. Generate intelligent search queries
  const searchQueries = await generateSearchQueries({ zipcodes, organizationTypes });
  
  // 3. Execute high-priority queries first
  const priorityQueries = searchQueries.filter(q => q.priority === 'high');
  
  // 4. Search Google for URLs
  const discoveredUrls = [];
  for (const query of priorityQueries) {
    const results = await searchGoogleForUrls(query, 5);
    discoveredUrls.push(...results);
    await sleep(500); // Rate limiting
  }
  
  res.json({ locations, queries: searchQueries, urls: uniqueUrls });
};

// POST /api/v1/discover/ai/region
export const discoverByRegion = async (req, res) => {
  // Similar to zipcode but uses city/state directly
};
```

### Frontend Implementation

**Discovery Component with AI Tabs**:
```typescript
const Discovery = () => {
  const [tabValue, setTabValue] = useState(0);
  const [zipcodes, setZipcodes] = useState('');
  const [aiQueries, setAiQueries] = useState([]);
  const [discoveredUrls, setDiscoveredUrls] = useState([]);

  const handleAiZipcodeDiscovery = async () => {
    const zipList = zipcodes.split(',').map(z => z.trim());
    
    const response = await apiClient.post('/discover/ai/zipcode', {
      zipcodes: zipList,
      maxResults: 50
    });
    
    setDiscoveredUrls(response.data.urls);
    setAiQueries(response.data.queries); // Show AI reasoning
  };

  // 4 tabs: By State, Custom Search, AI by Zipcode, AI by Region
  return (
    <Tabs>
      <Tab label="AI by Zipcode">
        <TextField 
          label="Zipcodes" 
          placeholder="90210, 10001, 60601"
          multiline
        />
        <Button onClick={handleAiZipcodeDiscovery}>
          Discover with AI
        </Button>
      </Tab>
    </Tabs>
  );
};
```

### AI System Prompt Design

**Key Instructions for GPT**:
- Target LOCAL city-level organizations (NOT state/national)
- Focus: Little League, youth soccer/football, school athletics, recreation depts
- Find: Board Presidents, Athletic Directors, Coordinators, Treasurers
- Generate 10-15 diverse queries with priority levels
- Include reasoning for each query

**Example Prompt**:
```
Given zipcodes: 90210, 10001
Generate search queries to find local athletic board members.
Focus on: Little League, youth sports, school athletics
Return JSON: [{ query, reasoning, priority }]
```

**Example AI Response**:
```json
[
  {
    "query": "Beverly Hills CA little league board members",
    "reasoning": "Targets local Little League in 90210 area, likely has board directory",
    "priority": "high"
  },
  {
    "query": "Manhattan NY youth soccer president contact",
    "reasoning": "10001 is Manhattan, youth soccer popular, president contact likely",
    "priority": "high"
  }
]
```

### Complete Discovery Flow

1. **User Input**: Enter zipcodes (e.g., "90210, 10001") or city/state
2. **AI Analysis**: GPT converts zipcodes to cities, generates targeted queries
3. **Query Execution**: Execute high-priority queries via Google CSE
4. **Results Display**: Show URLs with AI reasoning and priority
5. **Scraping**: User clicks "Scrape These URLs" → creates scrape job
6. **Quality Analysis**: AI analyzes scraped data, suggests improvements
7. **Import**: User reviews and imports contacts to database

### API Endpoints

```typescript
POST /api/v1/discover/ai/zipcode
Body: { zipcodes: string[], maxResults?: number }
Response: { locations, queries, urls, totalUrls }

POST /api/v1/discover/ai/region
Body: { city?: string, state: string, maxResults?: number }
Response: { location, queries, urls, totalUrls }

GET /api/v1/discover/analyze/:scrapeJobId
Response: { score, issues, suggestions }
```

### Environment Configuration

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Cost-effective, fast
GOOGLE_API_KEY=...
GOOGLE_SEARCH_ENGINE_ID=...
```

### Cost Optimization

- **Model Choice**: gpt-4o-mini (~$0.15 per 1M tokens) vs gpt-4 (~$30 per 1M)
- **Token Usage**: ~5K tokens per discovery = ~$0.001 per search
- **Caching**: Store AI queries for similar zipcodes
- **Batching**: Process multiple zipcodes in one API call
- **Rate Limiting**: 500ms delay between Google searches

### Error Handling

```typescript
try {
  const response = await openai.chat.completions.create({...});
  const parsed = JSON.parse(response.choices[0].message.content);
  return Array.isArray(parsed) ? parsed : parsed.queries || [];
} catch (error) {
  logger.error('AI query generation error:', error);
  throw new Error('Failed to generate AI search queries');
}
```

### Key Learnings

1. **Structured Output**: Use `response_format: { type: 'json_object' }` for reliable JSON
2. **Prompt Engineering**: Detailed system prompts produce better results
3. **Priority Levels**: AI-assigned priorities help focus on best queries first
4. **Reasoning Display**: Show AI's reasoning to users for transparency
5. **Temperature**: 0.7 for creative queries, 0.1 for factual data (zipcodes)
6. **Fallback Handling**: Parse both array and object-with-array formats
