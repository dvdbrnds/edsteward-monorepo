# Multi-State Regulations Architecture

## Problem Statement

Different customers need different state regulations based on their school's location:
- Pennsylvania schools → PA regulations (IDs 296-303)
- California schools → CA regulations (IDs 304-...)
- Texas schools → TX regulations (IDs ...)
- etc.

## Proposed Architecture

### 1. State Regulation Mapping System

```javascript
// State-to-Regulation Mapping
const STATE_REGULATIONS = {
  'PA': {
    name: 'Pennsylvania',
    edstewardIdRange: [296, 303], // 8 regulations
    regulations: [
      'pennsylvania-uniform-crime-reporting-act',
      'pennsylvania-sexual-violence-education-act-article-',
      'pennsylvania-higher-education-gift-disclosure-act',
      'pennsylvania-english-fluency-in-higher-education-a',
      'pennsylvania-graduation-rates-reporting-act-88-of-',
      'pa-paeducation-1741813075070',
      'pa-padeptEd-1741813075521',
      'pa-padeptEd-1741813212673'
    ]
  },
  'CA': {
    name: 'California',
    edstewardIdRange: [304, 320], // TBD
    regulations: [] // To be added
  },
  'TX': {
    name: 'Texas',
    edstewardIdRange: [321, 340], // TBD
    regulations: [] // To be added
  }
  // ... more states
};
```

### 2. Customer State Assignment

```javascript
// Customer Configuration
const CUSTOMERS = {
  'moravian-university': {
    name: 'Moravian University',
    state: 'PA',
    federalRegulations: true, // All 295
    stateRegulations: true    // PA only (8)
  },
  'stanford-university': {
    name: 'Stanford University',
    state: 'CA',
    federalRegulations: true,
    stateRegulations: true    // CA only
  }
};
```

### 3. Dynamic Regulation Loading

```javascript
function getRegulationsForCustomer(customerId) {
  const customer = CUSTOMERS[customerId];
  const regulations = [];
  
  // Always include federal regulations (1-295)
  if (customer.federalRegulations) {
    regulations.push(...FEDERAL_REGULATIONS); // IDs 1-295
  }
  
  // Add state-specific regulations
  if (customer.stateRegulations) {
    const stateRegs = STATE_REGULATIONS[customer.state];
    regulations.push(...stateRegs.regulations);
  }
  
  return regulations;
}
```

## Implementation Plan

### Phase 1: Database Schema Enhancement ✅ START HERE

**Add jurisdiction and state fields to regulations:**

```json
{
  "id": 296,
  "slug": "pennsylvania-uniform-crime-reporting-act",
  "name": "Pennsylvania Uniform Crime Reporting Act",
  "jurisdiction": "state",
  "state": "PA",
  "category": "Higher Education",
  "status": "active"
}
```

### Phase 2: Registry API Updates

**Add state filtering endpoint:**

```javascript
// GET /api/regulations?jurisdiction=state&state=PA
router.get('/regulations', (req, res) => {
  const { jurisdiction, state } = req.query;
  
  let regulations = allRegulations;
  
  if (jurisdiction === 'state' && state) {
    regulations = regulations.filter(r => 
      r.jurisdiction === 'state' && r.state === state
    );
  } else if (jurisdiction === 'federal') {
    regulations = regulations.filter(r => 
      r.jurisdiction === 'federal'
    );
  }
  
  res.json(regulations);
});
```

### Phase 3: Customer Configuration System

**Add customer profile management:**

```javascript
// Customer profiles with state assignments
const customerProfiles = {
  load: (customerId) => {
    // Load from database
    return {
      id: customerId,
      state: 'PA', // or 'CA', 'TX', etc.
      activeRegulations: {
        federal: true,
        state: true
      }
    };
  },
  
  getApplicableRegulations: (customerId) => {
    const profile = this.load(customerId);
    return {
      federal: profile.activeRegulations.federal ? 
        getFederalRegulations() : [],
      state: profile.activeRegulations.state ? 
        getStateRegulations(profile.state) : []
    };
  }
};
```

### Phase 4: EdSteward Integration Update

**Support state-specific delivery:**

```javascript
async function sendRegulationsToCustomer(customerId) {
  const profile = getCustomerProfile(customerId);
  const regulations = getApplicableRegulations(customerId);
  
  // Send federal regulations
  await sendBatch(regulations.federal, 'federal');
  
  // Send state-specific regulations
  if (profile.state) {
    await sendBatch(regulations.state, `state-${profile.state}`);
  }
}
```

## Database Schema

### regulations.json Structure

```json
[
  {
    "id": 1,
    "slug": "age-discrimination-act-of-1975",
    "name": "Age Discrimination Act of 1975",
    "jurisdiction": "federal",
    "state": null,
    "edstewardId": 1
  },
  {
    "id": 296,
    "slug": "pennsylvania-uniform-crime-reporting-act",
    "name": "Pennsylvania Uniform Crime Reporting Act",
    "jurisdiction": "state",
    "state": "PA",
    "edstewardId": 296,
    "citation": "18 Pa.C.S. § 9101",
    "agency": "Pennsylvania Department of Education"
  },
  {
    "id": 304,
    "slug": "california-education-code-section-66010",
    "name": "California Education Code Section 66010",
    "jurisdiction": "state",
    "state": "CA",
    "edstewardId": 304,
    "citation": "Cal. Ed. Code § 66010"
  }
]
```

### customer_configurations.json

```json
[
  {
    "customerId": "moravian-university",
    "name": "Moravian University",
    "state": "PA",
    "regulations": {
      "federal": true,
      "state": true
    },
    "edstewardEndpoint": "https://moravian.edsteward.com/api"
  },
  {
    "customerId": "stanford-university",
    "name": "Stanford University",
    "state": "CA",
    "regulations": {
      "federal": true,
      "state": true
    },
    "edstewardEndpoint": "https://stanford.edsteward.com/api"
  }
]
```

## EdSteward ID Allocation

### Current Allocation
- **1-295:** Federal regulations (COMPLETE)
- **296-303:** Pennsylvania regulations (8 regs) - IN PROGRESS
- **304-320:** California regulations (reserved)
- **321-340:** Texas regulations (reserved)
- **341-360:** New York regulations (reserved)
- **361-380:** Florida regulations (reserved)
- **381-500:** Other states (reserved)
- **501+:** Future expansion

### Dynamic ID Assignment
For scalability, consider:
```javascript
function getEdStewardIdForStateRegulation(state, index) {
  const stateOffset = {
    'PA': 296,
    'CA': 304,
    'TX': 321,
    'NY': 341,
    'FL': 361
  };
  
  return stateOffset[state] + index;
}
```

## Scalability Considerations

### 1. State Priority Matrix
Start with states with most customers:
1. Pennsylvania (Moravian)
2. California (many universities)
3. Texas (large state)
4. New York (many institutions)
5. Florida (growing market)

### 2. Regulation Discovery
For each state:
1. Identify key higher education regulations
2. Map to state education department sources
3. Validate with legal/compliance team
4. Add to database with proper citations

### 3. Automated State Addition
Create script: `add-state-regulations.js`
```bash
node add-state-regulations.js --state CA --regulations-file ca-regulations.json
```

## Testing Strategy

### Test Cases
1. **Single State Customer:** Moravian (PA only)
2. **Multi-State Customer:** University system across states
3. **Federal Only:** Customer without state regulations
4. **State Migration:** Customer moves to different state

### Validation
```javascript
// Test: Customer gets correct regulations
const moravianRegs = getRegulationsForCustomer('moravian-university');
assert(moravianRegs.length === 295 + 8); // Federal + PA

// Test: Different state
const stanfordRegs = getRegulationsForCustomer('stanford-university');
assert(stanfordRegs.state === 'CA');
```

## Migration Path

### Step 1: Add PA Regulations (IMMEDIATE)
- Add 8 PA regulations to Registry API
- Set jurisdiction='state', state='PA'
- Assign EdSteward IDs 296-303

### Step 2: Customer Configuration (NEXT)
- Add customer profile for Moravian
- Configure state='PA'
- Test filtering

### Step 3: Enhance & Transmit (THEN)
- Enhance 8 PA regulations with AI
- Transmit to EdSteward
- Verify Moravian receives PA regulations

### Step 4: Scale to Other States (FUTURE)
- Identify next priority state
- Add regulations to database
- Enhance and transmit
- Repeat

## API Endpoints

### For Customers
```
GET /api/regulations?customer=moravian-university
  → Returns 295 federal + 8 PA regulations

GET /api/regulations?customer=stanford-university  
  → Returns 295 federal + CA regulations
```

### For Admin
```
POST /api/states/PA/regulations
  → Add new PA regulation

GET /api/states
  → List all states with regulation counts

POST /api/customers/:id/state
  → Update customer's state assignment
```

## Implementation Scripts Needed

1. `add-pa-to-registry.js` - Add PA regulations to Registry API
2. `customer-config-manager.js` - Manage customer state assignments
3. `state-regulation-enhancer.js` - Enhance state regulations
4. `send-state-regulations.js` - Transmit to EdSteward with state context
5. `add-new-state.js` - Template for adding new states

## Next Steps

1. ✅ Create PA regulation entries for Registry API
2. ✅ Add jurisdiction/state fields
3. ✅ Enhance 8 PA regulations with AI
4. ✅ Transmit to EdSteward (IDs 296-303)
5. 📋 Create customer configuration system
6. 📋 Test with Moravian University
7. 📋 Document process for adding new states
8. 📋 Plan California regulations (next priority)

---

**Architecture Status:** Ready for Implementation  
**First Target:** Pennsylvania (8 regulations)  
**Scalability:** Designed for 50 states + territories  
**Customer Assignment:** State-based with override capability


