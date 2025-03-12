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

  private readonly IGNORED_TITLE_PATTERNS = [
    /the\.gov means/i,
    /official website/i,
    /home\s*page/i,
    /welcome to/i,
    /main\s*menu/i,
    /navigation/i,
    /skip to/i,
    /^menu$/i,
    /^search$/i,
    /^breadcrumb$/i
  ];

  private readonly CONTENT_SECTION_SELECTORS = [
    // Primary content selectors
    '.regulation-content',
    '.regulation-detail',
    '#regulation-content',
    '.policy-detail',
    '#policy-content',
    '#main-content',
    '#content-main',
    '.main-content',
    // Secondary content selectors
    'article',
    '.post-content',
    '.entry-content',
    // Generic content areas
    '.content',
    '#content',
    '.page-content',
    // Fallback selectors
    'main',
    '.container'
  ];

  private readonly REGULATION_TITLE_SELECTORS = [
    // Data attribute selectors
    '[data-type="regulation"]',
    '[data-type="policy"]',
    '[data-content-type="regulation"]',
    // Specific class selectors
    '.regulation-title',
    '.policy-title',
    '.document-title',
    // Content area headings
    '#regulation-content h1',
    '.regulation-content h1',
    '.policy-content h1',
    // Standard headings
    'h1.title',
    'h1.page-title',
    // Fallback
    'h1'
  ];

  private readonly REGULATION_RELATED_TERMS = [
    // Core terms
    'policy',
    'regulation',
    'requirement',
    'standard',
    'rule',
    'guideline',
    // Additional terms
    'procedure',
    'compliance',
    'statute',
    'code',
    'law',
    'mandate',
    'provision',
    'ordinance',
    // Education-specific terms
    'academic',
    'certification',
    'credential',
    'degree',
    'program',
    'assessment',
    'enrollment'
  ];

  private cleanText(text: string): string {
    return text
      .replace(/[\r\n]+/g, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\s+([.,;!?])/g, '$1')
      .trim();
  }

  private isValidTitle(text: string, content: string): boolean {
    if (!text || text.length < 5) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation failed: too short", {
        text,
        length: text?.length || 0
      });
      return false;
    }

    // Check against ignored patterns
    if (this.IGNORED_TITLE_PATTERNS.some(pattern => pattern.test(text))) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation failed: matched ignored pattern", {
        text,
        pattern: this.IGNORED_TITLE_PATTERNS.find(p => p.test(text))?.toString()
      });
      return false;
    }

    const wordCount = text.split(/\s+/).length;
    if (wordCount < 2 || wordCount > 50) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation failed: invalid word count", {
        text,
        wordCount
      });
      return false;
    }

    const lowerText = text.toLowerCase();
    const lowerContent = content.toLowerCase();

    // Look for regulation terms in title
    const hasRegulationTerm = this.REGULATION_RELATED_TERMS.some(term => 
      lowerText.includes(term)
    );

    // If title has regulation term, it's valid
    if (hasRegulationTerm) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation passed: contains regulation term", {
        text,
        hasRegulationTerm: true
      });
      return true;
    }

    // If title appears in content near regulation terms, it's valid
    for (const term of this.REGULATION_RELATED_TERMS) {
      const contextPattern = new RegExp(`(${text}.*?${term}|${term}.*?${text})`, 'i');
      if (contextPattern.test(content)) {
        syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation passed: regulation term in context", {
          text,
          term
        });
        return true;
      }
    }

    // Look for education-specific patterns
    const educationPatterns = [
      /(?:college|university|school|campus|student|faculty|education).*?(?:requirement|standard|policy)/i,
      /(?:academic|program|course|degree).*?(?:requirement|standard|policy)/i,
      /(?:certification|credential|assessment).*?(?:requirement|standard|policy)/i
    ];

    for (const pattern of educationPatterns) {
      if (pattern.test(lowerContent)) {
        syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation passed: education context", {
          text,
          pattern: pattern.toString()
        });
        return true;
      }
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title validation failed: no regulation context found", {
      text
    });
    return false;
  }

  private extractContent($: cheerio.CheerioAPI): string {
    let bestContent = '';

    // Remove common non-content elements
    $('script, style, nav, header, footer, .navigation, .menu, .sidebar, .comments, .social-share').remove();

    // Try each content selector
    for (const selector of this.CONTENT_SECTION_SELECTORS) {
      const elements = $(selector);
      elements.each((_, el) => {
        const $el = $(el);
        let content = '';

        // Process child elements
        $el.children().each((_, child) => {
          const $child = $(child);

          // Handle different element types
          if ($child.is('p, div')) {
            content += $child.text() + '\n\n';
          } else if ($child.is('ul, ol')) {
            $child.find('li').each((_, li) => {
              content += '• ' + $(li).text() + '\n';
            });
            content += '\n';
          } else if ($child.is('table')) {
            $child.find('tr').each((_, row) => {
              content += $(row).find('td, th').map((_, cell) => $(cell).text()).get().join(' | ') + '\n';
            });
            content += '\n';
          } else if ($child.is('h1, h2, h3, h4, h5, h6')) {
            content += '\n' + $child.text() + '\n\n';
          }
        });

        // If this section has more content, use it
        if (content.length > bestContent.length) {
          bestContent = content;
        }
      });
    }

    // If no content found in specific sections, try getting text from body
    if (!bestContent) {
      bestContent = $('body').text();
    }

    return this.cleanText(bestContent);
  }

  private findRegulationTitle($: cheerio.CheerioAPI, content: string): string {
    let bestTitle = '';
    let allTitles: string[] = [];

    // First try specific regulation title selectors
    for (const selector of this.REGULATION_TITLE_SELECTORS) {
      const elements = $(selector);
      elements.each((_, el) => {
        const title = this.cleanText($(el).text());
        if (title) {
          allTitles.push(title);
          if (this.isValidTitle(title, content)) {
            bestTitle = title;
            return false; // Break the loop
          }
        }
      });
      if (bestTitle) break;
    }

    // Log title candidates and selection result
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Title extraction candidates", {
      id: "TITLE_EXTRACTION",
      parameters: {
        allTitles,
        selectedTitle: bestTitle,
        contentPreview: content.substring(0, 200)
      }
    });

    // If no valid title found from selectors, try content extraction
    if (!bestTitle) {
      // Look for regulation names in the first few paragraphs
      const paragraphs = content.split('\n\n').slice(0, 3);

      // Common patterns that introduce regulation titles
      const patterns = [
        // Direct references
        /(?:this|the)\s+(.*?(?:regulation|policy|requirement|standard|rule).*?)(?:\.|$)/i,
        // Purpose statements
        /(?:purpose|scope)\s+(?:of|for)\s+(.*?)(?:\.|$)/i,
        // Requirements patterns
        /(?:sets forth|establishes|implements)\s+(.*?)(?:\.|$)/i,
        // Education-specific patterns
        /(?:academic|program|certification)\s+(.*?)(?:\.|$)/i
      ];

      for (const para of paragraphs) {
        for (const pattern of patterns) {
          const match = para.match(pattern);
          if (match && match[1]) {
            const candidate = this.cleanText(match[1]);
            if (this.isValidTitle(candidate, content)) {
              bestTitle = candidate;
              break;
            }
          }
        }
        if (bestTitle) break;
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content-based title extraction result", {
        id: "CONTENT_TITLE_EXTRACTION",
        parameters: {
          extractedTitle: bestTitle,
          firstParagraph: paragraphs[0]
        }
      });
    }

    return bestTitle;
  }

  private detectCategory(content: string): string {
    const scores: Record<string, number> = {};

    // Calculate score for each category
    for (const [category, patterns] of Object.entries(this.CATEGORY_PATTERNS)) {
      scores[category] = patterns.reduce((score, pattern) => {
        const matches = content.match(pattern);
        return score + (matches ? matches.length : 0);
      }, 0);
    }

    // Find category with highest score
    let bestCategory = 'Other';
    let highestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        bestCategory = category;
      }
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Category detection result", {
      bestCategory,
      scores
    });

    return bestCategory;
  }

  private async parseRegulation(html: string, source: string, url: string): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      // Extract content first
      const content = this.extractContent($);

      // Skip if really insufficient content
      if (!content || content.length < 30) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Skipping page - insufficient content", {
          id: "SKIP_PAGE",
          parameters: { url, contentLength: content.length }
        });
        return null;
      }

      // Find a valid title
      const title = this.findRegulationTitle($, content);
      if (!title) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Skipping page - no valid title found", {
          id: "SKIP_PAGE",
          parameters: { url }
        });
        return null;
      }

      const category = this.detectCategory(content);
      const itemId = `PA-${source.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;

      const regulation: Partial<InsertRegulation> = {
        itemId,
        name: title,
        topic: 'Higher Education',
        statute: '',
        summary: content.substring(0, 500),
        requirements: content,
        category,
        jurisdiction: 'state',
        stateCode: 'PA',
        stateAgency: source,
        isApplicable: true,
        lastUpdated: new Date(),
        lastVerified: new Date(),
        sources: [{
          url,
          type: 'web-scrape' as const,
          lastChecked: new Date()
        }],
        regulationUrl: url,
        agency_url: this.BASE_URLS[source as keyof typeof this.BASE_URLS] || url,
        agency_name: source,
        agency_department: source
      };

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Parsed regulation", {
        id: "PARSE_SUCCESS",
        parameters: {
          source,
          url,
          title,
          category,
          contentLength: content.length
        }
      });

      return regulation;

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error parsing regulation", {
        id: "PARSE_ERROR",
        parameters: {
          url,
          source,
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
  }

  private readonly CATEGORY_PATTERNS = {
    'Academic Programs': [
      /academic.*program/i,
      /curriculum/i,
      /degree.*requirement/i,
      /course.*requirement/i,
      /academic.*standard/i,
      /education.*requirement/i
    ],
    'Financial Aid': [
      /financial.*aid/i,
      /scholarship/i,
      /grant.*program/i,
      /student.*loan/i,
      /tuition/i,
      /financial.*assistance/i
    ],
    'Student Services': [
      /student.*service/i,
      /counseling/i,
      /advising/i,
      /student.*support/i,
      /student.*resource/i
    ],
    'Athletics': [
      /athletic/i,
      /sport/i,
      /NCAA/i,
      /competition/i,
      /physical.*education/i
    ],
    'Campus Safety': [
      /safety/i,
      /security/i,
      /emergency/i,
      /police/i,
      /crime/i,
      /incident/i
    ],
    'Research': [
      /research/i,
      /grant/i,
      /intellectual.*property/i,
      /innovation/i,
      /laboratory/i
    ],
    'Human Resources': [
      /employment/i,
      /faculty/i,
      /staff/i,
      /personnel/i,
      /hiring/i,
      /recruitment/i
    ],
    'Accounting': [
      /financial/i,
      /accounting/i,
      /budget/i,
      /audit/i,
      /fiscal/i
    ]
  };

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HigherEdComplianceBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching content", {
        id: "FETCH_ERROR",
        parameters: {
          url,
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  public async validateRegulation(regulation: Partial<InsertRegulation>): Promise<boolean> {
    try {
      await insertRegulationSchema.parseAsync(regulation);
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Regulation validation successful", {
        id: "VALIDATION_SUCCESS",
        parameters: { name: regulation.name }
      });
      return true;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Regulation validation failed", {
        id: "VALIDATION_ERROR",
        parameters: {
          name: regulation.name,
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting PA regulations collection");

      for (const [source, baseUrl] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Processing source", {
            id: "SOURCE_START",
            parameters: { source, baseUrl }
          });

          const content = await this.fetchPageContent(baseUrl);
          const $ = cheerio.load(content);

          // Find regulation links
          const links = $('a').toArray().filter(element => {
            const href = $(element).attr('href');
            const text = $(element).text().toLowerCase();
            return href &&
                   !href.startsWith('mailto:') &&
                   (text.includes('regulation') ||
                    text.includes('policy') ||
                    text.includes('requirement') ||
                    text.includes('standard'));
          });

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Found potential regulation links", {
            id: "LINKS_FOUND",
            parameters: {
              source,
              linkCount: links.length
            }
          });

          // Process each link
          for (const link of links) {
            const href = $(link).attr('href');
            if (!href) continue;

            try {
              const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
              const pageContent = await this.fetchPageContent(fullUrl);
              const regulation = await this.parseRegulation(pageContent, source, fullUrl);

              if (regulation) {
                regulations.push(regulation);
                syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Added regulation", {
                  id: "REGULATION_ADDED",
                  parameters: {
                    source,
                    url: fullUrl,
                    name: regulation.name
                  }
                });
              }
            } catch (error) {
              syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing link", {
                id: "LINK_ERROR",
                parameters: {
                  url: href,
                  source,
                  errorMessage: error instanceof Error ? error.message : String(error)
                }
              });
              continue;
            }
          }
        } catch (error) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing source", {
            id: "SOURCE_ERROR",
            parameters: {
              source,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          });
          continue;
        }
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "PA regulations collection completed", {
        id: "COLLECTION_COMPLETE",
        parameters: {
          count: regulations.length
        }
      });

      return regulations;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error in PA regulations collection", {
        id: "COLLECTION_ERROR",
        parameters: {
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
}

export const paRegulationCollector = new PARegulationCollector();