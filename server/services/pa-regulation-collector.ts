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

  private parseRegulation(html: string, source: string, url: string): Partial<InsertRegulation> {
    const $ = cheerio.load(html);

    const title = $('h1, .regulation-title, .page-title').first().text().trim();
    const name = title || 'Untitled PA Regulation';

    const contentSelectors = [
      '.regulation-content',
      '.content-main',
      'article',
      '.regulation-body',
      '#main-content'
    ];

    let content = '';
    contentSelectors.forEach(selector => {
      const element = $(selector);
      if (element.length) {
        content += element.text().trim() + '\n';
      }
    });

    const datePattern = /(?:effective|updated|issued|revised)(?:\s+date)?:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i;
    const dateMatch = content.match(datePattern);
    const effectiveDate = dateMatch ? new Date(dateMatch[1]) : null;

    const requirementsPattern = /(?:requirements|compliance|standards|regulations):\s*([^]*?)(?:\n\n|\.|$)/i;
    const requirementsMatch = content.match(requirementsPattern);
    const requirements = requirementsMatch ? requirementsMatch[1].trim() : '';

    const regulation: Partial<InsertRegulation> = {
      name,
      jurisdiction: 'state',
      stateCode: 'PA',
      stateAgency: source,
      summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      requirements,
      effectiveDate,
      category: this.isEducationRelated(content) ? 'Academic Programs' : 'Other',
      sources: [{
        url,
        type: 'web-scrape' as const,
        lastChecked: new Date()
      }],
      regulationUrl: url,
      agency_url: this.BASE_URLS[source as keyof typeof this.BASE_URLS] || url,
      agency_name: source,
      lastVerified: new Date(),
      isApplicable: true
    };

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Parsed regulation", {
      parameters: {
        source,
        url,
        title: name,
        contentLength: content.length
      }
    });

    return regulation;
  }

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Starting PA regulations collection');

      for (const [source, baseUrl] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Processing source", {
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

          // Process each link
          for (const link of links) {
            const href = $(link).attr('href');
            if (!href) continue;

            const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();

            try {
              const pageContent = await this.fetchPageContent(fullUrl);
              const regulation = this.parseRegulation(pageContent, source, fullUrl);

              if (regulation.name && regulation.summary) {
                regulations.push(regulation);
              }
            } catch (error) {
              syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing link", {
                parameters: {
                  url: fullUrl,
                  source,
                  errorMessage: error instanceof Error ? error.message : String(error)
                }
              });
              continue;
            }
          }
        } catch (error) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing source", {
            parameters: {
              source,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          });
          continue;
        }
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "PA regulations collection completed", {
        parameters: { 
          count: regulations.length
        }
      });

      return regulations;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error in PA regulations collection", {
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
        parameters: {
          name: regulation.name
        }
      });
      return true;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Regulation validation failed", {
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