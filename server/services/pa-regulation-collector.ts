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

  private async retryContentLoad(url: string, maxRetries = 3, delay = 2000): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MoravianComplianceBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          timeout: attempt * 5000 // Increase timeout with each retry
        });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Successfully fetched content on attempt ${attempt}`, {
          url,
          contentLength: response.data.length,
          attempt
        });

        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
          `Attempt ${attempt} failed to fetch content`, {
            url,
            error: lastError.message,
            nextRetryIn: delay
          });

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private validateContent(content: string): boolean {
    // More lenient content validation
    const contentQualityIndicators = {
      minLength: 50, // Reduced from 100
      hasRegulationTerms: /regulation|policy|requirement|standard|guideline|code|statute/i.test(content),
      hasEducationTerms: /academic|program|course|degree|student|faculty|school|education|college|university/i.test(content),
      hasLegalTerms: /shall|must|required|compliance|pursuant|chapter|section|article/i.test(content),
      hasStructure: /<h[1-6]|<p|<div|<table|<ul|<ol/i.test(content),
      hasSuspiciousContent: /403 Forbidden|404 Not Found|Error|Access Denied|Under Maintenance/i.test(content)
    };

    // Log content snippets for debugging
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content validation details", {
      indicators: contentQualityIndicators,
      contentPreview: content.substring(0, 200),
      contentLength: content.length,
      hasHtmlTags: /<[^>]+>/i.test(content),
      firstParagraph: content.match(/<p[^>]*>([^<]+)<\/p>/i)?.[1]?.trim() || ''
    });

    // More flexible validation logic
    const hasQualityContent = 
      contentQualityIndicators.minLength &&
      (contentQualityIndicators.hasRegulationTerms || contentQualityIndicators.hasEducationTerms) &&
      (contentQualityIndicators.hasLegalTerms || contentQualityIndicators.hasStructure) &&
      !contentQualityIndicators.hasSuspiciousContent;

    if (!hasQualityContent) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Content validation failed", {
        reason: Object.entries(contentQualityIndicators)
          .filter(([_, value]) => !value)
          .map(([key]) => key)
          .join(', ')
      });
    }

    return hasQualityContent;
  }

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Remove navigation elements
    $('nav, footer, .navigation, .menu, .sidebar, script, style').remove();

    let content = '';
    const processedTexts = new Set<string>();

    // Helper function to process section content with improved context retention
    const processSection = (section: cheerio.Cheerio<cheerio.Element>) => {
      let sectionContent = '';
      let currentContext = '';

      // Process headings first to establish context
      section.find('h1, h2, h3, h4').each((_, el) => {
        const text = this.cleanText($(el).text());
        if (text && !processedTexts.has(text)) {
          currentContext = text;
          sectionContent += '\n' + text + '\n\n';
          processedTexts.add(text);
        }
      });

      // Process main content with context
      section.find('p, li, td').each((_, el) => {
        const $el = $(el);
        const text = this.cleanText($el.text());

        if (text && !processedTexts.has(text)) {
          // Check if this content is related to current context
          if (currentContext && !sectionContent.includes(text)) {
            sectionContent += text + '\n\n';
            processedTexts.add(text);
          }
        }
      });

      // Process tables specifically
      section.find('table').each((_, table) => {
        const $rows = $(table).find('tr');
        if ($rows.length > 0) {
          sectionContent += '\nTable Content:\n';
          $rows.each((_, row) => {
            const rowContent = $(row).find('th, td')
              .map((_, cell) => $(cell).text().trim())
              .get()
              .join(' | ');
            if (rowContent && !processedTexts.has(rowContent)) {
              sectionContent += rowContent + '\n';
              processedTexts.add(rowContent);
            }
          });
          sectionContent += '\n';
        }
      });

      return sectionContent;
    };

    // Process SharePoint specific zones first
    this.SHAREPOINT_SELECTORS.mainContent.forEach(selector => {
      $(selector).each((_, el) => {
        const sectionContent = processSection($(el));
        if (sectionContent) {
          content += sectionContent;
        }
      });
    });

    // Process rich text content
    this.SHAREPOINT_SELECTORS.richText.forEach(selector => {
      $(selector).each((_, el) => {
        const sectionContent = processSection($(el));
        if (sectionContent) {
          content += sectionContent;
        }
      });
    });

    // Log extraction summary
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content extraction details", {
      url,
      totalLength: content.length,
      sections: content.split('\n\n').length,
      hasRegulationTerms: /regulation|policy|requirement/i.test(content),
      hasLegalTerms: /shall|must|required|compliance/i.test(content),
      preview: content.substring(0, 200)
    });

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