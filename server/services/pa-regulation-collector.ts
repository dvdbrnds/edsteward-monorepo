import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertRegulationSchema } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { syslog, LogLevel, LogFacility } from './syslog';

class PARegulationCollector {
  private readonly BASE_URLS = {
    // Direct links to regulation content
    paEducation: 'https://www.education.pa.gov/Policy-Funding/BECS/PACode/Pages/default.aspx',
    paHigherEd: 'https://www.education.pa.gov/Policy-Funding/BECS/PACode/Pages/HigherEducation.aspx',
    paStateSystem: 'https://www.passhe.edu/inside/policies/Pages/Board-of-Governors-Policies.aspx',
    // Add fallback URLs
    paDeptEd: 'https://www.education.pa.gov/Teachers%20-%20Administrators/School%20Services/Pages/default.aspx',
    paStateBoard: 'https://www.stateboard.education.pa.gov/Pages/RegulationsPolicy.aspx'
  };

  private readonly SHAREPOINT_SELECTORS = {
    mainContent: [
      '#DeltaPlaceHolderMain',
      '#contentBox',
      '#s4-workspace',
      '#s4-bodyContainer',
      // Add more SharePoint specific selectors
      '.ms-webpart-zone',
      '.ms-webpart-cell-horizontal',
      '.ms-webpartzone-cell',
      '[data-name="WebPartZone"]',
      '.ms-webpart-chrome',
      '#WebPartWPQ1', // Common SharePoint web part ID pattern
      '#WebPartWPQ2',
      '#WebPartWPQ3'
    ],
    richText: [
      '.ms-rtestate-field',
      '.ms-rtestate-read',
      '#ctl00_PlaceHolderMain_ctl01__ControlWrapper_RichHtmlField',
      // Add more rich text selectors
      '.ms-rte-wpbox',
      '.ms-rtestate-write',
      '.ms-rtefield',
      '[id^="ctl00_PlaceHolderMain_RichHtmlField"]'
    ],
    lists: [
      '.ms-listviewtable',
      '.ms-vh-div',
      '.ms-vb2',
      // Add more list selectors
      '.ms-listviewgrid',
      '.ms-quickLaunch',
      '.ms-core-listMenu-verticalBox',
      '.ms-core-listMenu-horizontalBox'
    ],
    // Add new selector category for policy content
    policyContent: [
      '[id*="policy"]',
      '[id*="regulation"]',
      '[class*="policy"]',
      '[class*="regulation"]',
      '.ms-policy-content',
      '.regulation-text'
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

  private isContentRelevant(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Skip if too short
    if (text.length < 20) return false;

    // Check for regulation terms
    const hasRegulationTerm = /regulation|policy|requirement|standard|guideline/i.test(text);
    const hasEducationTerm = /academic|program|course|degree|student|faculty/i.test(text);
    const hasLegalTerm = /shall|must|required|compliance|pursuant|chapter/i.test(text);

    return (hasRegulationTerm || hasEducationTerm) && hasLegalTerm;
  }

  private async retryContentLoad(url: string, maxRetries = 5, initialDelay = 2000): Promise<string> {
    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add special handling for PA Code website
        if (url.includes('pacodeandbulletin.gov')) {
          // Log the attempt for PA Code site
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Attempting to fetch PA Code content (attempt ${attempt})`, {
              url,
              attempt,
              delay
            });

          // Use more conservative timeout for PA Code site
          delay = attempt * 10000; // Longer delays for problematic site
        }

        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MoravianComplianceBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: attempt * 5000, // Increase timeout with each retry
          validateStatus: function (status) {
            // Consider only 5xx errors for retry
            return status < 500;
          }
        });

        // Check for error pages or invalid responses
        if (response.data.includes('Server Error in') ||
          response.data.includes('Runtime Error') ||
          response.data.includes('404 Not Found')) {
          throw new Error(`Server returned error page: ${url}`);
        }

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Successfully fetched content on attempt ${attempt}`, {
            url,
            contentLength: response.data.length,
            attempt
          });

        return response.data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Special handling for PA Code site errors
        if (url.includes('pacodeandbulletin.gov')) {
          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
            `PA Code site fetch failed on attempt ${attempt}`, {
              url,
              error: lastError.message,
              nextRetryIn: delay,
              willRetry: attempt < maxRetries
            });

          if (attempt === maxRetries) {
            // Log that we're falling back to alternative sources
            syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
              `PA Code site unavailable after ${maxRetries} attempts, using fallback sources`);
            throw new Error('PA Code site unavailable');
          }
        } else {
          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
            `Attempt ${attempt} failed to fetch content`, {
              url,
              error: lastError.message,
              nextRetryIn: delay
            });
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  private validateContent(content: string): boolean {
    // Basic validation
    if (!content || content.length < 50) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content too short", {
        contentLength: content?.length || 0
      });
      return false;
    }

    // Log the actual content being validated
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content being validated", {
      contentPreview: content.substring(0, 1000),
      totalLength: content.length,
      hasHtmlTags: /<[^>]+>/i.test(content)
    });

    // Check for suspicious content first
    const hasSuspiciousContent = /403 Forbidden|404 Not Found|Error|Access Denied|Under Maintenance|Server Error/i.test(content);
    if (hasSuspiciousContent) {
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content contains error indicators", {
        contentPreview: content.substring(0, 200)
      });
      return false;
    }

    // Split content into sections for better analysis
    const sections = content.split(/\n\s*\n/);
    let relevantSections = 0;

    // Analyze each section
    sections.forEach((section, index) => {
      if (section.length > 20) { // Only analyze substantial sections
        const patterns = {
          education: /education|academic|school|college|university|student|faculty|degree|program|course/i,
          regulation: /regulation|policy|requirement|guideline|standard|rule|procedure/i,
          legal: /shall|must|required|compliance|pursuant|accordance|provision/i,
          reference: /chapter|section|article|paragraph|part|pursuant|according/i
        };

        const matches = Object.entries(patterns)
          .filter(([_, pattern]) => pattern.test(section))
          .map(([key]) => key);

        if (matches.length > 0) {
          relevantSections++;
          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, `Found relevant content in section ${index}`, {
            patterns: matches,
            sectionPreview: section.substring(0, 100)
          });
        }
      }
    });

    // More detailed logging of validation results
    const validationDetails = {
      totalSections: sections.length,
      relevantSections,
      contentLength: content.length,
      hasEducationTerms: /education|academic|school|college|university/i.test(content),
      hasRegulationTerms: /regulation|policy|requirement|guideline/i.test(content),
      hasLegalTerms: /shall|must|required|compliance/i.test(content)
    };

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content validation details", validationDetails);

    // Accept content if:
    // 1. Has at least one relevant section
    // 2. Contains either education or regulation terms
    // 3. No suspicious content
    const isValid =
      relevantSections > 0 &&
      (validationDetails.hasEducationTerms || validationDetails.hasRegulationTerms) &&
      !hasSuspiciousContent;

    if (!isValid) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Content validation failed", {
        reason: !relevantSections ? "No relevant sections found" :
          !validationDetails.hasEducationTerms && !validationDetails.hasRegulationTerms ? "Missing education/regulation terms" :
            hasSuspiciousContent ? "Contains error indicators" : "Unknown reason",
        details: validationDetails
      });
    }

    return isValid;
  }

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Remove navigation and irrelevant elements
    $('nav, header, footer, .navigation, .menu, .sidebar, script, style').remove();

    let content = '';
    const processedTexts = new Set<string>();

    // Extract content from PA education department specific elements
    const paEducationSelectors = [
      // SharePoint specific content containers
      '#DeltaPlaceHolderMain',
      '#contentBox',
      '#s4-workspace',
      '#s4-bodyContainer',
      '.ms-webpart-zone',
      '.ms-webpart-cell-horizontal',
      // Rich text content areas
      '.ms-rtestate-field',
      '.ms-rtestate-read',
      '#ctl00_PlaceHolderMain_ctl01__ControlWrapper_RichHtmlField',
      // Regulation specific content
      '[id*="regulation"]',
      '[id*="policy"]',
      '[class*="regulation"]',
      '[class*="policy"]',
      // Standard content areas
      'main',
      'article',
      '.content',
      '#content',
      // List views
      '.ms-listviewtable',
      '.ms-vh-div'
    ];

    // First try to extract content from the most specific selectors
    for (const selector of paEducationSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, element) => {
          const $element = $(element);

          // Extract headings with hierarchy
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(heading => {
            $element.find(heading).each((_, h) => {
              const text = this.cleanText($(h).text());
              if (text && !processedTexts.has(text)) {
                content += `\n${text}\n\n`;
                processedTexts.add(text);
              }
            });
          });

          // Extract paragraphs and list items
          $element.find('p, li').each((_, el) => {
            const text = this.cleanText($(el).text());
            if (text && !processedTexts.has(text) && text.length > 20) {
              content += `${text}\n\n`;
              processedTexts.add(text);
            }
          });

          // Handle tables
          $element.find('table').each((_, table) => {
            const $rows = $(table).find('tr');
            if ($rows.length > 0) {
              let hasHeader = false;
              $rows.each((rowIndex, row) => {
                const cells = $(row).find('th, td')
                  .map((_, cell) => $(cell).text().trim())
                  .get()
                  .filter(text => text.length > 0);

                if (cells.length > 0) {
                  const rowText = cells.join(' | ');
                  if (!processedTexts.has(rowText)) {
                    if (rowIndex === 0 || $(row).find('th').length > 0) {
                      hasHeader = true;
                      content += `\nTable: ${rowText}\n`;
                    } else {
                      content += `${rowText}\n`;
                    }
                    processedTexts.add(rowText);
                  }
                }
              });
              if (hasHeader) content += '\n';
            }
          });

          // Extract any remaining text nodes that might contain important content
          $element.contents().each((_, node) => {
            if (node.type === 'text') {
              const text = this.cleanText($(node).text());
              if (text && !processedTexts.has(text) && text.length > 20) {
                content += `${text}\n\n`;
                processedTexts.add(text);
              }
            }
          });
        });

        // Log successful content extraction
        if (content.length > 100) {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content extracted from selector", {
            selector,
            contentLength: content.length,
            preview: content.substring(0, 200)
          });
        }
      }
    }

    // If no content was found with specific selectors, try a more generic approach
    if (!content || content.length < 100) {
      // Try to find any div that might contain regulation text
      $('div').each((_, div) => {
        const $div = $(div);
        const text = this.cleanText($div.text());

        // Check if this div contains regulation-related content
        if (text && text.length > 100 &&
          !processedTexts.has(text) &&
          /regulation|policy|requirement|education/i.test(text)) {
          content += `${text}\n\n`;
          processedTexts.add(text);

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Found regulation content in generic div", {
            contentLength: text.length,
            preview: text.substring(0, 200)
          });
        }
      });
    }

    // Log extraction results
    if (!content) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "No content found with any selector", {
        url,
        selectors: paEducationSelectors
      });
    } else {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content extraction complete", {
        url,
        contentLength: content.length,
        sections: content.split('\n\n').length,
        preview: content.substring(0, 200)
      });
    }

    return content;
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const content = await this.retryContentLoad(url);

      if (!this.validateContent(content)) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
          "Content validation failed, content may be invalid or incomplete", {
            url,
            contentLength: content.length
          });
      }

      return content;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch content after retries", {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async parseRegulation(html: string, source: string, url: string): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      // Extract title
      let title = '';
      const titleSelectors = ['h1', '.page-title', 'title'];

      for (const selector of titleSelectors) {
        const element = $(selector).first();
        const text = this.cleanText(element.text());
        if (text && text.length > 5 && /chapter|regulation|policy|requirement/i.test(text)) {
          title = text;
          break;
        }
      }

      if (!title) {
        const urlParts = url.split('/');
        title = urlParts[urlParts.length - 1].replace(/[-_]/g, ' ').replace('.aspx', '') || 'Untitled Regulation';
      }

      // Extract and validate content
      const content = this.extractContent($, url);
      if (!content || !this.isContentRelevant(content)) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Insufficient or irrelevant content", {
          url,
          contentLength: content?.length || 0
        });
        return null;
      }

      const regulation: Partial<InsertRegulation> = {
        itemId: `PA-${source}-${Date.now()}`,
        name: title,
        topic: 'Higher Education',
        statute: '',
        summary: content.substring(0, 500),
        requirements: content,
        category: 'Academic Programs',
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
        title: regulation.name,
        url,
        contentLength: content.length,
        preview: content.substring(0, 200)
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

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting PA regulations collection");

      for (const [source, baseUrl] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Processing source: ${source}`);

          // First try to parse the base URL as a regulation
          const baseContent = await this.fetchPageContent(baseUrl);
          const baseRegulation = await this.parseRegulation(baseContent, source, baseUrl);
          if (baseRegulation) {
            regulations.push(baseRegulation);
          }

          // Then look for additional regulation links
          const $ = cheerio.load(baseContent);
          const links = $('a').toArray()
            .filter(element => {
              const href = $(element).attr('href');
              const text = $(element).text().toLowerCase();

              if (!href || href.startsWith('mailto:')) return false;

              const isRegulationLink = /regulation|policy|requirement|chapter|standard/i.test(text);
              const isEducationLink = /academic|program|course|degree|student|faculty/i.test(text);

              if (isRegulationLink || isEducationLink) {
                syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Found potential regulation link", {
                  source,
                  href,
                  text
                });
                return true;
              }

              return false;
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
              const regulation = await this.parseRegulation(
                await this.fetchPageContent(fullUrl),
                source,
                fullUrl
              );

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
}

export const paRegulationCollector = new PARegulationCollector();