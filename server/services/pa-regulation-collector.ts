import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertRegulationSchema } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { syslog, LogLevel, LogFacility } from './syslog';

class PARegulationCollector {
  private readonly BASE_URLS = {
    paCode: 'https://www.pacodeandbulletin.gov',
    paDep: 'https://www.dep.pa.gov',
    paEducation: 'https://www.education.pa.gov',
    paHigherEd: 'https://www.education.pa.gov/Postsecondary-Adult/Pages/default.aspx',
    paStateSystem: 'https://www.passhe.edu/inside/policies/Pages/Board-of-Governors-Policies.aspx',
    paCHE: 'https://www.education.pa.gov/Postsecondary-Adult/College%20and%20Career%20Education/Pages/default.aspx'
  };

  private readonly IGNORED_PATTERNS = [
    /^\s*$/,
    /^home$/i,
    /^menu$/i,
    /^search$/i,
    /^skip to/i,
    /^copyright/i,
    /^follow us$/i,
    /^contact us$/i
  ];

  private readonly BOILERPLATE_CONTENT = [
    'The Pennsylvania Department of Education (PDE) oversees',
    'PDE oversees public school districts',
    'Contact Us',
    'Follow Us',
    'Accessibility',
    'Copyright',
    'All Rights Reserved',
    'Privacy Policy',
    'public school districts',
    'Career and Technology Centers/Vocational Technical schools',
    'public Intermediate Units',
    'education of youth in State Juvenile Correctional Institutions'
  ];

  private readonly TITLE_PATTERNS = {
    // Document titles
    document: [
      /(\d+\s*PA\s*Code\s*.*)/i,
      /(Chapter\s+\d+[.:]\s*.*)/i,
      /(Section\s+\d+[.:]\s*.*)/i,
      /(Article\s+\d+[.:]\s*.*)/i
    ],
    // Policy/regulation patterns
    policy: [
      /Policy(?:\s+on|\s+for|\s+regarding)?\s+(.+)/i,
      /Regulation(?:\s+on|\s+for|\s+regarding)?\s+(.+)/i,
      /Requirement(?:s)?(?:\s+for|\s+on|\s+regarding)?\s+(.+)/i,
      /Guideline(?:s)?(?:\s+for|\s+on|\s+regarding)?\s+(.+)/i,
      /Standard(?:s)?(?:\s+for|\s+on|\s+regarding)?\s+(.+)/i
    ],
    // Education-specific patterns
    education: [
      /Academic\s+(?:Requirements?|Standards?|Policies?)\s+(?:for\s+)?(.+)/i,
      /Program\s+(?:Requirements?|Standards?|Policies?)\s+(?:for\s+)?(.+)/i,
      /Student\s+(?:Requirements?|Standards?|Policies?)\s+(?:for\s+)?(.+)/i,
      /Faculty\s+(?:Requirements?|Standards?|Policies?)\s+(?:for\s+)?(.+)/i
    ]
  };

  private cleanText(text: string): string {
    return text
      .replace(/[\r\n]+/g, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\S\n]+/g, ' ')
      .trim();
  }

  private isBoilerplateContent(text: string): boolean {
    return this.BOILERPLATE_CONTENT.some(phrase => 
      text.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  private findTitle($: cheerio.CheerioAPI, url: string): string {
    let candidates: Array<{ text: string, source: string, score: number }> = [];

    // Try specific title elements first
    const titleSelectors = [
      'h1.regulation-title',
      'h1.policy-title',
      'h1.page-title',
      'h1:first-of-type',
      'h1',
      '.page-title',
      '.document-title',
      '[id*="title"]',
      '[class*="title"]'
    ];

    // Check title elements
    titleSelectors.forEach(selector => {
      $(selector).each((_, el) => {
        const text = this.cleanText($(el).text());
        if (text && text.length >= 5 && !this.IGNORED_PATTERNS.some(p => p.test(text))) {
          const score = this.scoreTitleCandidate(text);
          candidates.push({
            text,
            source: selector,
            score: score + (selector.includes('regulation') || selector.includes('policy') ? 1 : 0)
          });
        }
      });
    });

    // Check text content for title patterns
    $('p, div').slice(0, 5).each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text) {
        // Check against all title patterns
        Object.entries(this.TITLE_PATTERNS).forEach(([type, patterns]) => {
          patterns.forEach(pattern => {
            const match = text.match(pattern);
            if (match) {
              const title = match[1] || match[0];
              candidates.push({
                text: this.cleanText(title),
                source: `text-${type}`,
                score: this.scoreTitleCandidate(title) + (type === 'document' ? 2 : 1)
              });
            }
          });
        });
      }
    });

    // Log candidates for debugging
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title candidates", {
      url,
      candidates: candidates.map(c => ({
        text: c.text,
        source: c.source,
        score: c.score,
        length: c.text.length,
        hasRegulationTerm: /regulation|policy|requirement|standard|guideline/i.test(c.text),
        hasEducationTerm: /academic|program|course|degree|student|faculty/i.test(c.text)
      }))
    });

    // Sort and select best candidate
    candidates.sort((a, b) => b.score - a.score);
    const bestCandidate = candidates[0];

    // More permissive threshold (0.5 -> 0)
    if (bestCandidate) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Selected title", {
        url,
        title: bestCandidate.text,
        score: bestCandidate.score,
        source: bestCandidate.source
      });
      return bestCandidate.text;
    }

    return '';
  }

  private scoreTitleCandidate(text: string): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    // Check for policy/regulation patterns
    const policyPatterns = [
      /regulation/i,
      /policy/i,
      /requirement/i,
      /standard/i,
      /guideline/i
    ];

    policyPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) score += 1;
    });

    // Check for education-related terms
    const educationPatterns = [
      /academic/i,
      /program/i,
      /course/i,
      /degree/i,
      /student/i,
      /faculty/i,
      /university/i,
      /college/i
    ];

    educationPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) score += 0.5;
    });

    // Check for formal title indicators
    if (/chapter\s+\d+/i.test(lowerText)) score += 2;
    if (/section\s+\d+/i.test(lowerText)) score += 2;
    if (/article\s+\d+/i.test(lowerText)) score += 2;
    if (/pa\s+code/i.test(lowerText)) score += 2;

    // Format-based adjustments
    if (/^[A-Z]/.test(text)) score += 0.25; // Starts with capital
    if (text.length < 5) score -= 1;
    if (text.length > 200) score -= 1;

    return score;
  }

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Remove navigation and irrelevant elements
    $('nav, header:not(:has(h1)), footer, .navigation, .menu, .sidebar, .social-share, .comments').remove();

    let bestContent = '';
    let contentSections: Array<{ text: string, source: string, score: number }> = [];

    const processElement = (el: cheerio.Element, selector: string) => {
      const $el = $(el);
      let content = '';

      // Process text content
      $el.find('p, li').each((_, element) => {
        const text = this.cleanText($(element).text());
        if (text && text.length > 20 && !this.isBoilerplateContent(text)) {
          content += text + '\n\n';
        }
      });

      // Process headings to maintain structure
      $el.find('h2, h3, h4').each((_, element) => {
        const text = this.cleanText($(element).text());
        if (text && !this.isBoilerplateContent(text)) {
          content += '\n' + text + '\n\n';
        }
      });

      if (content) {
        contentSections.push({
          text: content,
          source: selector,
          score: this.scoreContent(content)
        });
      }
    };

    // Try primary selectors first
    for (const selector of this.CONTENT_SELECTORS.primary) {
      $(selector).each((_, el) => processElement(el, selector));
    }

    // If no content found, try secondary selectors
    if (contentSections.length === 0) {
      for (const selector of this.CONTENT_SELECTORS.secondary) {
        $(selector).each((_, el) => processElement(el, selector));
      }
    }

    // Sort by score and select best content
    contentSections.sort((a, b) => b.score - a.score);

    // Log content extraction results
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content sections found", {
      url,
      sections: contentSections.map(s => ({
        source: s.source,
        score: s.score,
        length: s.text.length,
        preview: s.text.substring(0, 100)
      }))
    });

    if (contentSections.length > 0) {
      bestContent = contentSections[0].text;
    }

    return bestContent;
  }

  private scoreContent(content: string): number {
    let score = 0;
    const lowerContent = content.toLowerCase();

    // Check for regulation-related terms
    const regulationTerms = [
      'regulation',
      'policy',
      'requirement',
      'standard',
      'guideline',
      'procedure',
      'must',
      'shall',
      'comply',
      'compliance'
    ];

    regulationTerms.forEach(term => {
      const count = (lowerContent.match(new RegExp(term, 'g')) || []).length;
      score += count * 0.5;
    });

    // Check for education-specific terms
    const educationTerms = [
      'academic',
      'program',
      'course',
      'degree',
      'student',
      'faculty',
      'university',
      'college'
    ];

    educationTerms.forEach(term => {
      const count = (lowerContent.match(new RegExp(term, 'g')) || []).length;
      score += count * 0.3;
    });

    // Penalize boilerplate content
    if (this.BOILERPLATE_CONTENT.some(phrase => 
      lowerContent.includes(phrase.toLowerCase())
    )) {
      score -= 3;
    }

    // Length considerations
    if (content.length < 50) score -= 1;
    if (content.length > 10000) score -= 2;

    return score;
  }

  private async parseRegulation(html: string, source: string, url: string): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      const title = this.findTitle($, url);
      if (!title) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "No valid title found", { url });
        return null;
      }

      const content = this.extractContent($, url);
      if (!content || content.length < 50) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Insufficient content", {
          url,
          contentLength: content?.length || 0
        });
        return null;
      }

      const itemId = `PA-${source}-${Buffer.from(title).toString('base64').substring(0, 8)}`;

      const regulation: Partial<InsertRegulation> = {
        itemId,
        name: title,
        topic: 'Higher Education',
        statute: '',
        summary: content.substring(0, 500),
        requirements: content,
        category: this.detectCategory(content),
        jurisdiction: 'state',
        stateCode: 'PA',
        stateAgency: source,
        isApplicable: true,
        lastUpdated: new Date(),
        lastVerified: new Date(),
        sources: [{
          url,
          type: 'web-scrape',
          lastChecked: new Date()
        }],
        regulationUrl: url,
        agency_url: this.BASE_URLS[source as keyof typeof this.BASE_URLS] || url,
        agency_name: source,
        agency_department: source
      };

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully parsed regulation", {
        title,
        url,
        contentLength: content.length
      });

      return regulation;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error parsing regulation", {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private detectCategory(content: string): string {
    const categories = {
      'Academic Programs': ['curriculum', 'program requirement', 'degree requirement', 'academic standard'],
      'Financial Aid': ['financial aid', 'scholarship', 'grant', 'loan', 'tuition'],
      'Student Services': ['student service', 'counseling', 'advising', 'support'],
      'Athletics': ['athletic', 'sport', 'physical education', 'competition'],
      'Campus Safety': ['safety', 'security', 'emergency', 'crime'],
      'Research': ['research', 'intellectual property', 'innovation'],
      'Human Resources': ['employment', 'faculty', 'staff', 'personnel']
    };

    const lowerContent = content.toLowerCase();
    let bestMatch = 'Other';
    let maxMatches = 0;

    for (const [category, terms] of Object.entries(categories)) {
      const matches = terms.reduce((count, term) => {
        const regExp = new RegExp(term, 'g');
        return count + (lowerContent.match(regExp) || []).length;
      }, 0);

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = category;
      }
    }

    return bestMatch;
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoravianCompliance/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching content", {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private readonly CONTENT_SELECTORS = {
    primary: [
      // Direct regulation content
      '#regulation-text',
      '#regulation-content',
      '#policy-text',
      '#policy-content',
      '.regulation-text',
      '.regulation-content',
      '.policy-text',
      '.policy-content',
      // Regulation sections
      '[id*="requirements"]',
      '[id*="guidelines"]',
      '[class*="requirements"]',
      '[class*="guidelines"]',
      // Content by type
      '[data-content-type="regulation"]',
      '[data-content-type="policy"]',
      '[data-type="requirement"]'
    ],
    secondary: [
      // Main content areas
      '#main-content article',
      '.main-content article',
      'article.content',
      '.article-content',
      // Policy containers
      '.policy-container',
      '.requirement-container',
      '.standard-container'
    ]
  };


  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting PA regulations collection");

      for (const [source, baseUrl] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Processing source: ${source}`);

          const content = await this.fetchPageContent(baseUrl);
          const $ = cheerio.load(content);

          const links = $('a').toArray()
            .filter(element => {
              const href = $(element).attr('href');
              const text = $(element).text().toLowerCase();
              if (!href || href.startsWith('mailto:')) return false;

              return this.TITLE_PATTERNS.policy.some(p => p.test(text)) ||
                     this.TITLE_PATTERNS.education.some(p => p.test(text)) ||
                     this.TITLE_PATTERNS.document.some(p => p.test(text));
            });

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${links.length} potential regulation links`, {
            source,
            baseUrl
          });

          for (const link of links) {
            try {
              const href = $(link).attr('href');
              if (!href) continue;

              const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
              const regulation = await this.parseRegulation(await this.fetchPageContent(fullUrl), source, fullUrl);

              if (regulation) {
                regulations.push(regulation);
                syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Added regulation", {
                  title: regulation.name,
                  source,
                  url: fullUrl
                });
              }
            } catch (error) {
              syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing link", {
                url: href,
                error: error instanceof Error ? error.message : String(error)
              });
              continue;
            }
          }
        } catch (error) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing source", {
            source,
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      return regulations;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error in regulation collection", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async validateRegulation(regulation: Partial<InsertRegulation>): Promise<boolean> {
    try {
      await insertRegulationSchema.parseAsync(regulation);
      return true;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Regulation validation failed", {
        name: regulation.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

export const paRegulationCollector = new PARegulationCollector();