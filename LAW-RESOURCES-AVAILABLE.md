# Available Law Library Resources for MCP Engine

## Currently Integrated ✅

### 1. CourtListener (Free Law Project)
**Status:** ✅ Active with Token
**Token:** `565c36d7324c6eb78a37a0d92d91dd2caded9269`
**Rate Limit:** 5,000 queries/hour

**Currently Using:**
- `/search/` - Full text search for opinions

**Available Endpoints NOT YET USED:**
- `/dockets/` - Court dockets
- `/recap-documents/` - PACER documents (FREE via RECAP!)
- `/courts/` - 400+ court information
- `/audio/` - Oral argument recordings
- `/opinions/` - Individual opinions
- `/opinions-cited/` - Citation network data
- `/people/` - Judge profiles
- `/attorneys/` - Attorney information
- `/parties/` - Case party information
- `/fjc-integrated-database/` - Federal Judicial Center data
- `/financial-disclosures/` - Judge financial disclosures
- `/visualizations/` - Citation graphs

### 2. Cornell LII
**Status:** ✅ Active (no auth needed)
**Coverage:** USC, CFR, legal encyclopedias, Wex definitions

### 3. Government APIs (Already Integrated)
- **eCFR API** - Code of Federal Regulations
- **Federal Register API** - New rules and notices  
- **Congress.gov** - Bills and legislation
- **GovInfo API (GPO)** - Official government documents
- **Library of Congress** - Historical legal materials

---

## FREE APIs to Add 🆕

### 4. RECAP Archive (via CourtListener)
**What:** Free PACER documents
**Why:** PACER normally costs $0.10/page. RECAP has 200M+ free documents!
**Endpoint:** `https://www.courtlistener.com/api/rest/v4/recap-documents/`
**Auth:** Same CourtListener token

### 5. State Decoded
**What:** State law databases in machine-readable format
**URL:** https://www.statedecoded.com/
**Coverage:** Many US states
**Cost:** FREE / Open Source

### 6. OpenStates API
**What:** State legislation tracking
**URL:** https://openstates.org/api/
**Coverage:** All 50 states + DC + Puerto Rico
**Cost:** FREE with API key

### 7. Regulations.gov API
**What:** Federal regulatory dockets and comments
**URL:** https://api.regulations.gov/
**Cost:** FREE with API key
**Great for:** Tracking pending regulations

### 8. USAspending.gov API
**What:** Federal contract and grant data
**URL:** https://api.usaspending.gov/
**Cost:** FREE
**Great for:** Financial compliance

---

## PAID APIs (Future Consideration) 💰

### 9. OpenLaws API
**What:** Comprehensive statutes + regulations + case law
**Coverage:** All 50 states, federal
**Cost:** Paid subscription (pricing varies)
**Contact:** https://openlaws.us/api/

### 10. Fastcase/vLex API  
**What:** Case law, statutes, regulations
**Cost:** Subscription required
**Note:** Some free bar association access

### 11. LexisNexis API
**What:** Comprehensive legal database
**Cost:** Enterprise pricing
**Note:** User already has credentials (future integration)

### 12. Westlaw (Thomson Reuters)
**What:** Comprehensive legal database
**Cost:** Enterprise pricing

---

## Recommended Next Steps

1. **Quick Win - Add RECAP:** Use existing CourtListener token
2. **Quick Win - Regulations.gov:** Free API key registration
3. **Medium - OpenStates:** State legislation for all 50 states
4. **Future - LexisNexis:** When ready for enterprise features
