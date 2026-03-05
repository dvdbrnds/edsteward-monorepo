## TransferIQ - Project Structure & Files

**Directory Structure**:
```
/Users/dvdbrnds/Desktop/XferIQ/
├── prisma/schema.prisma     # Database models
├── src/app/
│   ├── layout.tsx           # Root layout (Geist fonts, dark theme)
│   ├── page.tsx             # Landing page with hero, features, CTA
│   └── globals.css          # Tailwind base + custom components
├── src/lib/utils.ts         # cn() helper, formatCredits, sleep, generateId
├── tailwind.config.ts       # Brand colors: brand-500 (#24a89e), accent-500 (#f96a3d)
├── package.json             # Dependencies and scripts
├── .env.example             # Environment template
└── TransferIQ_PRD.md        # Product requirements document
```

**CSS Classes** (globals.css):
- `.btn-primary` - Teal gradient button
- `.btn-accent` - Coral gradient button  
- `.btn-secondary` - Slate outlined button
- `.card` / `.card-hover` - Dark glass-morphism cards
- `.input` / `.label` - Form elements
- `.gradient-text` - Teal-to-coral text gradient
- `.mesh-bg` - Radial gradient background
- `.glass` - Frosted glass effect