# Compliance LLM Gateway

A gateway service that processes compliance queries using Large Language Models (LLMs).

## Features

- RESTful API for processing compliance queries
- Integration with OpenAI's GPT models
- CSV-based compliance data loading
- Response formatting and regulation reference extraction
- Logging and error handling
- Caching for efficient data access

## Prerequisites

- Node.js 16.x or higher
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd compliance-llm-gateway
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables example file and update it with your settings:
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your OpenAI API key and other configurations.

## Configuration

The following environment variables can be configured:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `OPENAI_API_KEY`: Your OpenAI API key
- `LLM_MODEL`: The OpenAI model to use (default: gpt-4-turbo-preview)
- `MAX_TOKENS`: Maximum tokens for LLM responses
- `LLM_TEMPERATURE`: Temperature setting for LLM (0-1)

## Usage

### Starting the Server

```bash
# Start in production mode
npm start

# Start in development mode with hot reloading
npm run dev
```

### API Endpoints

#### Health Check
```
GET /health
```
Returns the status of the server.

#### Process Compliance Query
```
POST /compliance/query
```
Process a compliance-related query.

Request body:
```json
{
  "query": "What are the requirements for Title IX compliance?"
}
```

Response:
```json
{
  "query": "What are the requirements for Title IX compliance?",
  "response": {
    "fullResponse": "...",
    "relevantRegulations": ["REG-123", "REG-456"]
  },
  "timestamp": "2023-11-28T12:34:56Z"
}
```

## Project Structure

```
compliance-llm-gateway/
├── data/
│   └── compmat.csv         # Compliance data
├── logs/                   # Log files
├── src/
│   ├── llm-gateway/
│   │   ├── compliance-processor.js  # Compliance processing logic
│   │   └── start-llm-gateway.js     # Server entry point
│   └── utils/
│       ├── data-loader.js           # Data loading utility
│       ├── llm-connector.js         # LLM API integration
│       └── logger.js                # Logging utility
├── .env                    # Environment variables
├── package.json            # Project metadata and dependencies
└── README.md               # Project documentation
```

## License

[License Information]