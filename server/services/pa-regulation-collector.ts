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

  private readonly TITLE_PATTERNS = {
    core: [
      /policy|regulation|requirement|standard|guideline|procedure/i,
      /requirements?|standards?|guidelines?/i
    ],
    education: [
      /academic|program|course|degree|student|faculty|education|certification/i,
      /university|college|campus|enrollment|assessment/i
    ],
    document: [
      /title:?\s*(.+)/i,
      /policy:?\s*(.+)/i,
      /regulation:?\s*(.+)/i,
      /(\d+\s*PA\s*Code\s*.*)/i,
      /(chapter\s+\d+[.:]\s*.*)/i
    ]
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

  private cleanText(text: string): string {
    return text
      .replace(/[\r\n]+/g, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\S\n]+/g, ' ')
      .trim();
  }

  private findTitle($: cheerio.CheerioAPI, url: string): string {
    // Try regulation-specific title elements first
    const titleSelectors = [
      '.regulation-title',
      '.policy-title',
      '.document-title',
      'h1.page-title',
      'h1.title',
      'h1:first-of-type',
      '.page-header h1',
      'h1'
    ];

    let bestTitle = '';
    let bestScore = 0;

    // Try specific title selectors
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = this.cleanText(element.text());
        if (text && text.length >= 5 && !this.IGNORED_PATTERNS.some(p => p.test(text))) {
          const score = this.scoreTitleCandidate(text);
          if (score > bestScore) {
            bestScore = score;
            bestTitle = text;
          }
        }
      }
    }

    // If no title found, try looking in first few paragraphs
    if (!bestTitle) {
      $('p').slice(0, 3).each((_, el) => {
        const text = this.cleanText($(el).text());
        const score = this.scoreTitleCandidate(text);
        if (score > bestScore) {
          bestScore = score;
          bestTitle = text;
        }
      });
    }

    if (bestTitle && bestScore >= 0.5) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Selected title", {
        url,
        title: bestTitle,
        score: bestScore
      });
      return bestTitle;
    }

    return '';
  }

  private scoreTitleCandidate(text: string): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    // Check for regulation terms
    this.TITLE_PATTERNS.core.forEach(pattern => {
      if (pattern.test(lowerText)) score += 1.5;
    });

    // Check for education terms
    this.TITLE_PATTERNS.education.forEach(pattern => {
      if (pattern.test(lowerText)) score += 1;
    });

    // Length-based adjustments
    if (text.length < 10) score -= 1;
    if (text.length > 200) score -= 1;
    if (/^[A-Z]/.test(text)) score += 0.5;

    return score;
  }

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Remove irrelevant elements
    $('script, style, nav, header:not(:has(h1)), footer, .navigation, .menu, .sidebar').remove();

    // Initialize content extraction
    let content = '';
    let contentSections: Array<{ text: string, source: string }> = [];

    // Function to extract and clean text from an element
    const extractText = (el: cheerio.Element): string => {
      const $el = $(el);
      let text = '';

      // Handle different element types
      if ($el.is('p, li, td')) {
        text = this.cleanText($el.text());
      } else if ($el.is('h2, h3, h4, h5, h6')) {
        text = '\n' + this.cleanText($el.text()) + '\n';
      }

      return text;
    };

    // Try multiple content selectors in order of specificity
    const contentSelectors = [
      // Primary regulation content
      '.regulation-content',
      '.policy-content',
      '.requirements-section',
      '#regulation-content',
      '#policy-content',
      '[class*="regulation-text"]',
      '[class*="policy-text"]',
      // Fallback main content
      '#main-content',
      '.main-content',
      'article',
      '.article-content',
      '.content'
    ];

    for (const selector of contentSelectors) {
      $(selector).each((_, section) => {
        let sectionText = '';

        // Process all text elements within the section
        $(section).find('p, li, td, h2, h3, h4, h5, h6').each((_, el) => {
          const text = extractText(el);
          if (text && text.length > 0) {
            sectionText += text + '\n';
          }
        });

        if (sectionText) {
          contentSections.push({
            text: sectionText,
            source: selector
          });
        }
      });

      // If we found substantial content, use it
      if (contentSections.length > 0) {
        break;
      }
    }

    // Log all found content sections
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content sections found", {
      url,
      sections: contentSections.map(s => ({
        source: s.source,
        length: s.text.length,
        preview: s.text.substring(0, 100)
      }))
    });

    // Select the longest content section that meets our criteria
    let bestContent = '';
    for (const section of contentSections) {
      if (section.text.length > bestContent.length) {
        // Validate content has meaningful regulation-related text
        if (
          this.TITLE_PATTERNS.core.some(p => p.test(section.text)) ||
          this.TITLE_PATTERNS.education.some(p => p.test(section.text))
        ) {
          bestContent = section.text;
        }
      }
    }

    // If no specific content found, try extracting from body
    if (!bestContent) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "No specific content found, trying body content");
      let bodyContent = '';
      $('body p, body li').each((_, el) => {
        const text = extractText(el);
        if (text && text.length > 0) {
          bodyContent += text + '\n';
        }
      });

      if (bodyContent.length > 100) {
        bestContent = bodyContent;
      }
    }

    return bestContent;
  }

  private async parseRegulation(html: string, source: string, url: string): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      // Extract title first
      const title = this.findTitle($, url);
      if (!title) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "No valid title found", { url });
        return null;
      }

      // Extract and validate content
      const content = this.extractContent($, url);

      // More permissive content validation
      if (!content || content.length < 100) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Insufficient content", {
          url,
          contentLength: content?.length || 0,
          preview: content?.substring(0, 100)
        });
        return null;
      }

      // Create regulation object
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
        url,
        title,
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
      'Academic Programs': {
        terms: ['curriculum', 'program requirement', 'degree requirement', 'academic standard'],
        weight: 2
      },
      'Financial Aid': {
        terms: ['financial aid', 'scholarship', 'grant', 'loan', 'tuition'],
        weight: 2
      },
      'Student Services': {
        terms: ['student service', 'counseling', 'advising', 'support service'],
        weight: 1.5
      },
      'Athletics': {
        terms: ['athletic', 'sport', 'physical education', 'competition'],
        weight: 1.5
      },
      'Campus Safety': {
        terms: ['safety', 'security', 'emergency', 'crime', 'incident'],
        weight: 1.5
      },
      'Research': {
        terms: ['research', 'intellectual property', 'innovation'],
        weight: 1
      },
      'Human Resources': {
        terms: ['employment', 'faculty', 'staff', 'personnel', 'hiring'],
        weight: 1
      }
    };

    const lowerContent = content.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [category, config] of Object.entries(categories)) {
      scores[category] = config.terms.reduce((score, term) => {
        const matches = (lowerContent.match(new RegExp(term, 'g')) || []).length;
        return score + matches * config.weight;
      }, 0);
    }

    const entries = Object.entries(scores);
    if (!entries.length) return 'Other';

    const [bestCategory] = entries.reduce((best, current) =>
      current[1] > best[1] ? current : best
    );

    return scores[bestCategory] > 0 ? bestCategory : 'Other';
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

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting PA regulations collection");

      for (const [source, baseUrl] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Processing source: ${source}`);

          const content = await this.fetchPageContent(baseUrl);
          const $ = cheerio.load(content);

          // Find regulation-related links
          const links = $('a').toArray()
            .filter(element => {
              const href = $(element).attr('href');
              const text = $(element).text().toLowerCase();
              if (!href || href.startsWith('mailto:')) return false;

              return this.TITLE_PATTERNS.core.some(p => p.test(text)) ||
                     this.TITLE_PATTERNS.education.some(p => p.test(text));
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