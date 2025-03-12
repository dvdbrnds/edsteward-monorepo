import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertRegulationSchema } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { syslog, LogLevel, LogFacility } from './syslog';

class PARegulationCollector {
  private readonly BASE_URLS = {
    // Direct links to regulation content
    paEducation: 'https://www.education.pa.gov/Postsecondary-Adult/College%20and%20Career%20Education/Pages/Chapter-31-General-Provisions.aspx',
    paHigherEd: 'https://www.education.pa.gov/Policy-Funding/BECS/PACode/Pages/HigherEducation.aspx',
    paStateSystem: 'https://www.passhe.edu/inside/policies/Pages/Board-of-Governors-Policies.aspx'
  };

  private readonly SHAREPOINT_SELECTORS = {
    mainContent: [
      '#DeltaPlaceHolderMain',
      '#contentBox',
      '#s4-workspace',
      '#s4-bodyContainer'
    ],
    richText: [
      '.ms-rtestate-field',
      '.ms-rtestate-read',
      '#ctl00_PlaceHolderMain_ctl01__ControlWrapper_RichHtmlField'
    ],
    lists: [
      '.ms-listviewtable',
      '.ms-vh-div',
      '.ms-vb2'
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

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Remove navigation elements
    $('nav, footer, .navigation, .menu, .sidebar, script, style').remove();

    let content = '';
    const processedTexts = new Set<string>();

    // Helper function to process section content
    const processSection = (section: cheerio.Cheerio<cheerio.Element>) => {
      let sectionContent = '';

      // Process main content
      section.find('p, li').each((_, el) => {
        const text = this.cleanText($(el).text());
        if (text && !processedTexts.has(text)) {
          sectionContent += text + '\n\n';
          processedTexts.add(text);
        }
      });

      // Process headings for structure
      section.find('h1, h2, h3, h4').each((_, el) => {
        const text = this.cleanText($(el).text());
        if (text && !processedTexts.has(text)) {
          sectionContent += '\n' + text + '\n\n';
          processedTexts.add(text);
        }
      });

      return sectionContent;
    };

    // Process main content sections
    this.SHAREPOINT_SELECTORS.mainContent.forEach(selector => {
      $(selector).each((_, el) => {
        const sectionContent = processSection($(el));

        // Log found content for debugging
        if (sectionContent) {
          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Found main content section", {
            url,
            selector,
            length: sectionContent.length,
            preview: sectionContent.substring(0, 200)
          });
          content += sectionContent;
        }
      });
    });

    // Process rich text sections
    this.SHAREPOINT_SELECTORS.richText.forEach(selector => {
      $(selector).each((_, el) => {
        const sectionContent = processSection($(el));
        if (sectionContent) {
          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Found rich text content", {
            url,
            selector,
            length: sectionContent.length,
            preview: sectionContent.substring(0, 200)
          });
          content += sectionContent;
        }
      });
    });

    // Process SharePoint lists
    this.SHAREPOINT_SELECTORS.lists.forEach(selector => {
      $(selector).each((_, list) => {
        $(list).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length > 0) {
            const rowText = cells.map((_, cell) => $(cell).text().trim()).get().join(' | ');
            const text = this.cleanText(rowText);
            if (text && !processedTexts.has(text)) {
              content += text + '\n';
              processedTexts.add(text);
            }
          }
        });
      });
    });

    // Log content statistics
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content extraction summary", {
      url,
      totalLength: content.length,
      hasRegulationTerms: /regulation|policy|requirement/i.test(content),
      hasLegalTerms: /shall|must|required|compliance/i.test(content),
      preview: content.substring(0, 200)
    });

    return content;
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoravianComplianceBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 15000
      });

      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Fetched page", {
        url,
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.data.length,
        hasMainContent: response.data.includes('DeltaPlaceHolderMain')
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