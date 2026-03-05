## TransferIQ - Monorepo Structure (Updated)

**Repository**: https://github.com/dvdbrnds/TransferIQ

**Monorepo Structure**:
```
/Users/dvdbrnds/Desktop/XferIQ/
├── apps/
│   ├── web/                    # Next.js 14 (TypeScript) - Port 3000
│   │   ├── src/app/            # Pages, API routes
│   │   ├── prisma/schema.prisma
│   │   └── package.json
│   │
│   └── ocr-engine/             # FastAPI (Python) - Port 8000
│       ├── src/api/main.py     # FastAPI app
│       ├── src/ocr/            # OCR pipeline (PROPRIETARY)
│       │   ├── pipeline.py     # Main orchestrator
│       │   ├── preprocessor.py # Image preprocessing
│       │   ├── text_extractor.py # PaddleOCR integration
│       │   ├── layout_analyzer.py # Table/column detection
│       │   └── transcript_parser.py # Course extraction
│       ├── src/llm/fallback.py # Claude integration
│       └── requirements.txt
│
├── docker-compose.yml          # PostgreSQL, Redis, MinIO
├── turbo.json                  # Turborepo config
└── package.json                # Root scripts
```

**Key Commands**:
```zsh
npm run dev          # Start web app (Turborepo)
npm run dev:ocr      # Start OCR engine (uvicorn)
npm run docker:up    # Start PostgreSQL, Redis, MinIO
npm run db:push      # Push Prisma schema
```

**OCR Engine API**:
- POST /extract - Upload transcript, get structured courses
- GET /health - Health check