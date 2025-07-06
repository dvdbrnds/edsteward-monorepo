# EdSteward.ai Brand Color Guide

## Brand Overview
EdSteward.ai is a premium compliance tracker platform that combines sophisticated regulatory expertise with innovative technology. Our color palette reflects our commitment to wisdom, trust, and excellence in educational compliance.

## Primary Color Palette

### Primary - EdSteward Purple
**Hex:** `#5b2c87`  
**RGB:** `91, 44, 135`  
**HSL:** `271°, 51%, 35%`  
**Usage:** Primary branding, headers, navigation, main CTAs  
**Psychology:** Authority, wisdom, premium quality, innovation  
**Accessibility:** WCAG AA compliant on white backgrounds

### Secondary - Sage Green  
**Hex:** `#059669`  
**RGB:** `5, 150, 105`  
**HSL:** `160°, 94%, 30%`  
**Usage:** Success states, validation indicators, growth metrics  
**Psychology:** Growth, stability, positive validation, trust  
**Accessibility:** WCAG AA compliant on white backgrounds

### Accent - Warm Gold
**Hex:** `#d97706`  
**RGB:** `217, 119, 6`  
**HSL:** `32°, 95%, 44%`  
**Usage:** Achievement badges, premium features, important CTAs  
**Psychology:** Excellence, achievement, premium value, energy  
**Accessibility:** WCAG AA compliant on white backgrounds

### Neutral - Charcoal
**Hex:** `#374151`  
**RGB:** `55, 65, 81`  
**HSL:** `217°, 19%, 27%`  
**Usage:** Body text, secondary navigation, subtle elements  
**Psychology:** Sophistication, professionalism, readability  
**Accessibility:** WCAG AAA compliant on white backgrounds

## Supporting System Colors

### Success Green
**Hex:** `#16a34a`  
**RGB:** `22, 163, 74`  
**Usage:** Success messages, completed tasks, positive status indicators

### Warning Amber  
**Hex:** `#f59e0b`  
**RGB:** `245, 158, 11`  
**Usage:** Warning messages, pending items, attention needed

### Error Red
**Hex:** `#dc2626`  
**RGB:** `220, 38, 38`  
**Usage:** Error messages, failed validations, critical issues

### Information Blue
**Hex:** `#2563eb`  
**RGB:** `37, 99, 235`  
**Usage:** Informational messages, tips, neutral notifications

## Background & Surface Colors

### Primary Background
**Hex:** `#ffffff`  
**RGB:** `255, 255, 255`  
**Usage:** Main background, cards, forms

### Secondary Background  
**Hex:** `#f8fafc`  
**RGB:** `248, 250, 252`  
**Usage:** Page backgrounds, subtle sections

### Border Gray
**Hex:** `#e2e8f0`  
**RGB:** `226, 232, 240`  
**Usage:** Borders, dividers, subtle separations

### Text Gray
**Hex:** `#64748b`  
**RGB:** `100, 116, 139`  
**Usage:** Secondary text, captions, metadata

## Color Application Rules

### 60-30-10 Rule
- **60%** Primary Purple + White/Light Gray backgrounds
- **30%** Sage Green for positive elements and validation
- **10%** Warm Gold for accents and premium features

### Hierarchy Guidelines
1. **Primary Purple** - Main brand elements, primary actions
2. **Sage Green** - Secondary actions, success states  
3. **Warm Gold** - Accent elements, achievements
4. **Charcoal** - Text and subtle elements

### Accessibility Standards
All color combinations meet or exceed WCAG 2.1 AA standards:
- **Minimum contrast ratio:** 4.5:1 for normal text
- **Enhanced contrast ratio:** 7:1 for small text
- **Non-text elements:** 3:1 minimum contrast

## Usage Examples

### Primary Navigation
- Background: Primary Purple (`#5b2c87`)
- Text: White (`#ffffff`)
- Hover: Darker Purple (`#4c2373`)

### Success Indicators
- Background: Success Green (`#16a34a`)
- Text: White (`#ffffff`)
- Icon: White (`#ffffff`)

### Call-to-Action Buttons
- **Primary CTA:** Purple background (`#5b2c87`) with white text
- **Secondary CTA:** Gold background (`#d97706`) with white text
- **Tertiary CTA:** Green background (`#059669`) with white text

### Status Indicators
- ✅ **Validated:** Sage Green (`#059669`)
- ⚠️ **Pending:** Warning Amber (`#f59e0b`)
- ❌ **Failed:** Error Red (`#dc2626`)
- ℹ️ **Info:** Information Blue (`#2563eb`)

## Color Combinations

### High-Impact Combinations
- **Purple + Gold:** Premium, prestigious
- **Purple + Green:** Balanced, trustworthy
- **Green + Gold:** Achievement, success

### Avoid These Combinations
- Purple + Red (too aggressive)
- Gold + Green (can appear muddy)
- Multiple bright colors together

## Brand Personality Expression

### Primary Purple Conveys:
- Regulatory expertise and wisdom
- Premium, sophisticated solutions
- Innovation in compliance technology
- Trustworthy authority

### Supporting Colors Enhance:
- **Green:** Positive outcomes, growth, sustainability
- **Gold:** Achievement, excellence, premium value
- **Charcoal:** Professional reliability, clarity

## Implementation Guidelines

### Digital Applications
- Use Primary Purple for all major brand touchpoints
- Sage Green for positive feedback and validation states
- Gold sparingly for premium features and achievements
- Maintain proper contrast ratios across all applications

### Print Applications
- Specify PMS colors for consistent reproduction
- Test color combinations on various paper stocks
- Provide RGB and CMYK alternatives

### Logo Applications
- Primary logo on white: Purple (`#5b2c87`)
- Reversed logo on dark: White (`#ffffff`)
- Single color: Charcoal (`#374151`)

## Technical Specifications

### CSS Variables
```css
:root {
  --primary-purple: #5b2c87;
  --secondary-green: #059669;
  --accent-gold: #d97706;
  --neutral-charcoal: #374151;
  --success: #16a34a;
  --warning: #f59e0b;
  --error: #dc2626;
  --info: #2563eb;
  --background: #ffffff;
  --surface: #f8fafc;
  --border: #e2e8f0;
  --text-secondary: #64748b;
}
```

### Tailwind CSS Configuration
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#5b2c87',
        secondary: '#059669',
        accent: '#d97706',
        neutral: '#374151',
        success: '#16a34a',
        warning: '#f59e0b',
        error: '#dc2626',
        info: '#2563eb'
      }
    }
  }
}
```

## Brand Color Psychology Summary

Our purple-primary palette positions EdSteward.ai as:
- **Authoritative yet approachable** - Purple conveys expertise without intimidation
- **Premium and innovative** - Differentiates from traditional blue competitors
- **Growth-oriented** - Green reinforces positive outcomes and sustainable compliance
- **Achievement-focused** - Gold highlights excellence and premium value

This color strategy supports our goal of becoming the trusted, premium choice for institutional compliance tracking while maintaining the warmth and approachability needed for educational environments.

---

*Last updated: December 2024  
Version: 1.0*