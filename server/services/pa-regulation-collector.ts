import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertRegulationSchema } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { format } from 'date-fns';
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

  private readonly EDUCATION_TOPICS = [
    'higher education',
    'postsecondary',
    'college',
    'university',
    'academic',
    'education',
    'student',
    'faculty',
    'research',
    'campus'
  ];

  private cleanText(text: string): string {
    return text
      .replace(/[\s\n]+/g, ' ') // Replace multiple whitespace/newlines with single space
      .replace(/\s+([.,;!?])/g, '$1') // Remove spaces before punctuation
      .replace(/\s+/g, ' ') // Normalize remaining whitespace
      .trim();
  }

  private extractContentFromElement($: cheerio.CheerioAPI, element: cheerio.Cheerio): string {
    // Remove unwanted elements
    element.find('script, style, nav, header, footer, .navigation, .menu').remove();

    // Get text content
    let text = element.text();

    // Clean the text
    return this.cleanText(text);
  }

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

  private isEducationRelated(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.EDUCATION_TOPICS.some(topic => lowerText.includes(topic));
  }

  private parseRegulation(html: string, source: string, url: string): Partial<InsertRegulation> | null {
    try {
      const $ = cheerio.load(html);

      // Remove unwanted elements
      $('script, style, nav, header, footer, .navigation, .menu').remove();

      // Get title
      const titleSelectors = ['h1', '.regulation-title', '.page-title', '.title', '#title'];
      let title = '';
      for (const selector of titleSelectors) {
        const element = $(selector).first();
        if (element.length) {
          title = this.cleanText(element.text());
          break;
        }
      }
      const name = title || 'Untitled PA Regulation';

      // Get main content
      const contentSelectors = [
        '.regulation-content',
        '.content-main',
        'article',
        '.regulation-body',
        '#main-content',
        '.entry-content',
        'main',
        '.content',
        '#content'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length) {
          const text = this.extractContentFromElement($, element);
          if (text.length > mainContent.length) {
            mainContent = text;
          }
        }
      }

      // If no content found in main selectors, try getting cleaned body text
      if (!mainContent) {
        mainContent = this.extractContentFromElement($, $('body'));
      }

      // Only proceed if we have meaningful content
      if (!mainContent || mainContent.length < 50) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Skipping page - insufficient content", {
          id: "SKIP_PAGE",
          parameters: {
            url,
            contentLength: mainContent.length
          }
        });
        return null;
      }

      // Extract dates using improved pattern
      const datePattern = /(?:effective|updated|issued|revised|implementation)(?:\s+date)?:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i;
      const dateMatch = mainContent.match(datePattern);
      const effectiveDate = dateMatch ? new Date(dateMatch[1]) : null;

      // Extract requirements with improved pattern
      const requirementsPattern = /(?:requirements|compliance|standards|regulations|guidelines)(?:\s*:|:\s*|\s+-)?\s*([^]*?)(?=(?:\n\n|\.\s+[A-Z]|$))/i;
      const requirementsMatch = mainContent.match(requirementsPattern);
      let requirements = requirementsMatch ? this.cleanText(requirementsMatch[1]) : '';

      // If no specific requirements found, use the first substantial paragraph
      if (!requirements) {
        const paragraphs = mainContent.split(/(?:\n\n|\.\s+)/).filter(p => p.length > 100);
        requirements = paragraphs.length > 0 ? this.cleanText(paragraphs[0]) : mainContent.substring(0, 1000);
      }

      // Generate a unique itemId
      const itemId = `PA-${source.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;

      const regulation: Partial<InsertRegulation> = {
        itemId,
        name,
        topic: this.isEducationRelated(mainContent) ? 'Higher Education' : 'General',
        statute: '',
        summary: mainContent.substring(0, 500),
        requirements,
        category: this.isEducationRelated(mainContent) ? 'Academic Programs' : 'Other',
        jurisdiction: 'state',
        stateCode: 'PA',
        stateAgency: source,
        isApplicable: true,
        effectiveDate,
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
          title: name,
          contentLength: mainContent.length
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

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Starting PA regulations collection');

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
              const regulation = this.parseRegulation(pageContent, source, fullUrl);

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

  public async validateRegulation(regulation: Partial<InsertRegulation>): Promise<boolean> {
    try {
      await insertRegulationSchema.parseAsync(regulation);
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Regulation validation successful", {
        id: "VALIDATION_SUCCESS",
        parameters: {
          name: regulation.name
        }
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
}

export const paRegulationCollector = new PARegulationCollector();