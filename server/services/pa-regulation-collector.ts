import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertRegulationSchema } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { syslog, LogLevel, LogFacility } from './syslog';

class PARegulationCollector {
  private readonly BASE_URLS = {
    // Direct link to PA education policies
    paEducation: 'https://www.education.pa.gov/Policy-Funding/BoardPolicies/Pages/default.aspx',
    paHigherEd: 'https://www.education.pa.gov/Policy-Funding/BECS/PACode/Pages/default.aspx',
    paStateSystem: 'https://www.passhe.edu/inside/policies/Pages/Board-of-Governors-Policies.aspx',
    paCHE: 'https://www.education.pa.gov/Postsecondary-Adult/College%20and%20Career%20Education/Pages/Regulations-Policies.aspx'
  };

  private readonly IGNORED_PATTERNS = [
    /^\s*$/,
    /^menu$/i,
    /^search$/i,
    /^contact us$/i,
    /^skip to/i
  ];

  private readonly SHAREPOINT_SELECTORS = {
    content: [
      // Main content
      '#s4-workspace', // SharePoint main workspace
      '#s4-bodyContainer', // SharePoint body container
      '#contentRow', // SharePoint content row
      '#DeltaPlaceHolderMain', // SharePoint main content placeholder
      '.ms-webpart-zone', // SharePoint web part zone
      // Rich text fields
      '.ms-rtestate-field',
      '.ms-rtestate-read',
      '#ctl00_PlaceHolderMain_ctl01__ControlWrapper_RichHtmlField'
    ],
    links: [
      // Policy links
      'a[href*="policy"]',
      'a[href*="regulation"]',
      'a[href*="requirement"]',
      // Link containers
      '.ms-listlink',
      '.ms-linksection-link'
    ],
    lists: [
      // List views
      '.ms-listviewtable',
      '.ms-itmhover',
      // List items
      '.ms-vb2', // List cell
      '.ms-alternating' // Alternating row
    ]
  };

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

      // Log complete HTML for debugging
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Raw page content", {
        url,
        contentType: response.headers['content-type'],
        contentLength: response.data.length,
        htmlPreview: response.data.substring(0, 1000).replace(/\s+/g, ' '),
        hasMainContent: response.data.includes('DeltaPlaceHolderMain'),
        hasWebParts: response.data.includes('ms-webpart-zone')
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

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Remove navigation elements but keep main content structure
    $('nav, header:not(:has(h1)), footer, .navigation, .menu, .sidebar').remove();

    const sections: Array<{ text: string, source: string, score: number }> = [];
    const processedTexts = new Set<string>();

    // Check main content containers
    this.SHAREPOINT_SELECTORS.content.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Found content container", {
          url,
          selector,
          count: elements.length,
          html: elements.first().html()?.substring(0, 500)
        });

        elements.each((_, container) => {
          let content = '';
          let score = 0;

          // Process headings
          $(container).find('h1, h2, h3, h4').each((_, heading) => {
            const text = this.cleanText($(heading).text());
            if (text && !this.IGNORED_PATTERNS.some(p => p.test(text))) {
              content += `\n${text}\n\n`;
              score += 1;
            }
          });

          // Process paragraphs and links
          $(container).find('p, a').each((_, element) => {
            const text = this.cleanText($(element).text());
            if (text && text.length > 15 && !processedTexts.has(text)) {
              if (/regulation|policy|requirement|standard|guideline/i.test(text)) {
                score += 2;
              }
              if (/academic|education|student|faculty|program/i.test(text)) {
                score += 1;
              }
              content += text + '\n\n';
              processedTexts.add(text);
            }
          });

          // Process lists
          $(container).find('li, .ms-vb2').each((_, item) => {
            const text = this.cleanText($(item).text());
            if (text && text.length > 15 && !processedTexts.has(text)) {
              content += `• ${text}\n`;
              processedTexts.add(text);
              score += 0.5;
            }
          });

          if (content) {
            // Log section details
            syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content section found", {
              url,
              selector,
              length: content.length,
              score,
              preview: content.substring(0, 200)
            });

            sections.push({ text: content, source: selector, score });
          }
        });
      }
    });

    // Process policy/regulation links
    this.SHAREPOINT_SELECTORS.links.forEach(selector => {
      $(selector).each((_, link) => {
        const text = this.cleanText($(link).text());
        const href = $(link).attr('href');
        if (text && href && !processedTexts.has(text)) {
          syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Found policy link", {
            url,
            text,
            href,
            parent: $(link).parent().prop('tagName')
          });
        }
      });
    });

    // Sort sections by score
    sections.sort((a, b) => b.score - a.score);

    let content = '';
    if (sections.length > 0) {
      // Combine sections with score above threshold
      content = sections
        .filter(s => s.score > 0.5)
        .map(s => s.text)
        .join('\n\n');
    }

    // Log extraction results
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Content extraction results", {
      url,
      sectionsFound: sections.length,
      totalLength: content.length,
      preview: content.substring(0, 200),
      scores: sections.map(s => ({
        source: s.source,
        score: s.score,
        length: s.text.length
      }))
    });

    return content;
  }

  private async parseRegulation(html: string, source: string, url: string): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      // Log page structure before parsing
      syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Page structure", {
        url,
        title: $('title').text(),
        h1: $('h1').first().text(),
        contentMain: $('#DeltaPlaceHolderMain').length > 0,
        webParts: $('.ms-webpart-zone').length
      });

      const content = this.extractContent($, url);

      // More permissive content validation for debugging
      if (!content || content.length < 20) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Insufficient content", {
          url,
          contentLength: content?.length || 0,
          preview: content?.substring(0, 200)
        });
        return null;
      }

      // Extract title from content
      let title = '';
      const titleSelectors = [
        'h1',
        '.page-title',
        'title',
        '[id*="title"]'
      ];

      for (const selector of titleSelectors) {
        const element = $(selector).first();
        if (element.length) {
          const text = this.cleanText(element.text());
          if (text && text.length > 5 && !this.IGNORED_PATTERNS.some(p => p.test(text))) {
            title = text;
            break;
          }
        }
      }

      if (!title) {
        const urlParts = url.split('/');
        title = urlParts[urlParts.length - 1].replace(/[-_]/g, ' ').replace('.aspx', '') || 'Untitled Regulation';
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
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Processing source", { source, url: baseUrl });

          const content = await this.fetchPageContent(baseUrl);
          const $ = cheerio.load(content);

          // Find links that might point to regulations
          const links = $('a').toArray()
            .filter(element => {
              const href = $(element).attr('href');
              const text = $(element).text().toLowerCase();

              if (!href || href.startsWith('mailto:')) return false;

              const hasRegulation = /regulation|policy|requirement|standard|guideline/i.test(text);
              const hasEducation = /academic|program|course|degree|student|faculty/i.test(text);

              // Log potential regulation links
              if (hasRegulation || hasEducation) {
                syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Found potential regulation link", {
                  source,
                  href,
                  text,
                  context: $(element).parent().html()?.substring(0, 200)
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
  private cleanText(text: string): string {
    return text
      .replace(/[\r\n]+/g, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\S\n]+/g, ' ')
      .trim();
  }
}

export const paRegulationCollector = new PARegulationCollector();