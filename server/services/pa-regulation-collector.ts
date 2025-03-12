import { storage } from '../storage';
import { db } from '../db';
import { syslog, LogLevel, LogFacility } from './syslog';
import { regulations } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedContent {
  content: string;
  source: string;
  score: number;
  matchedPatterns: string[];
}

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
      '.ms-webpart-zone',
      '.ms-webpart-cell-horizontal',
      '.ms-webpartzone-cell',
      '[data-name="WebPartZone"]'
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

  private readonly debugDir = path.join(process.cwd(), 'logs', 'pa-content-debug');
  private pendingRegulations: Partial<InsertRegulation>[] = [];
  private isProcessing = false;

  constructor() {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  private async logDatabaseError(error: Error, operation: string, context: any = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      operation,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        detail: (error as any).detail
      },
      context
    };

    const logPath = path.join(this.debugDir, 'database-errors.log');
    await fs.promises.appendFile(
      logPath,
      JSON.stringify(errorLog, null, 2) + '\n\n',
      'utf8'
    );

    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `Database error in ${operation}`, errorLog);
  }

  private async retryDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: any = {},
    maxRetries = 3,
    initialDelay = 3000
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Database operation completed successfully`, {
            operation: operationName,
            attempt,
            durationMs: duration,
            context
          });

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isConnectionError =
          lastError.message.includes('terminating connection') ||
          lastError.message.includes('Connection terminated');

        await this.logDatabaseError(lastError, operationName, {
          ...context,
          attempt,
          isConnectionError
        });

        if (attempt < maxRetries) {
          const retryDelay = isConnectionError ? delay * 2 : delay;

          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
            `Retrying database operation after error`, {
              operation: operationName,
              attempt,
              nextRetryDelayMs: retryDelay,
              isConnectionError
            });

          await new Promise(resolve => setTimeout(resolve, retryDelay));
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  private async processSingleRegulation(regulation: Partial<InsertRegulation>): Promise<void> {
    try {
      const operationContext = {
        regulationId: regulation.itemId,
        name: regulation.name
      };

      await this.retryDatabaseOperation(
        async () => {
          const existing = await storage.getRegulationByItemId(regulation.itemId!);

          if (existing) {
            await storage.updateRegulation(existing.id, {
              ...regulation,
              lastUpdated: new Date(),
              lastVerified: new Date()
            });
          } else {
            await storage.createRegulation(regulation);
          }
        },
        'process_regulation',
        operationContext
      );

      // Add significant delay between operations
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Failed to process regulation after all retries`, {
          name: regulation.name,
          itemId: regulation.itemId,
          error: error instanceof Error ? error.message : String(error)
        });

      // Re-queue failed item for later retry
      this.pendingRegulations.push(regulation);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.pendingRegulations.length > 0) {
        const regulation = this.pendingRegulations.shift()!;
        await this.processSingleRegulation(regulation);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Starting PA regulations collection");

      for (const [source, url] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Processing source: ${source}`);

          const baseContent = await this.fetchPageContent(url);
          const baseRegulation = await this.parseRegulation(baseContent, source, url);
          if (baseRegulation) {
            regulations.push(baseRegulation);
            this.pendingRegulations.push(baseRegulation);
            await this.processQueue();
          }

          const $ = cheerio.load(baseContent);
          const links = $('a').filter((_, element) => {
            const href = $(element).attr('href');
            const text = $(element).text().toLowerCase();
            return href && !href.startsWith('mailto:') && (
              /regulation|policy|requirement|chapter|standard/i.test(text) ||
              /academic|program|course|degree|student|faculty/i.test(text)
            );
          }).map((_, element) => {
            const href = $(element).attr('href')!;
            return href.startsWith('http') ? href : new URL(href, url).toString();
          }).get();

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Found ${links.length} potential regulation links`);

          for (const link of links) {
            try {
              const regulation = await this.parseRegulation(
                await this.fetchPageContent(link),
                source,
                link
              );

              if (regulation) {
                regulations.push(regulation);
                this.pendingRegulations.push(regulation);
                await this.processQueue();
              }

            } catch (error) {
              syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
                `Error processing link: ${link}`, {
                  error: error instanceof Error ? error.message : String(error)
                });
              continue;
            }
          }

        } catch (error) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
            `Error processing source: ${source}`, {
              error: error instanceof Error ? error.message : String(error)
            });
          continue;
        }
      }

      // Process any remaining items
      await this.processQueue();
      return regulations;

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
        `Error in regulation collection`, {
          error: error instanceof Error ? error.message : String(error)
        });
      throw error;
    }
  }

  private async parseRegulation(
    html: string,
    source: string,
    url: string
  ): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      let title = $('h1').first().text().trim() ||
                 $('.page-title').first().text().trim() ||
                 $('title').text().trim();

      if (!title) {
        const urlParts = url.split('/');
        title = urlParts[urlParts.length - 1]
          .replace(/[-_]/g, ' ')
          .replace('.aspx', '')
          .replace(/([A-Z])/g, ' $1')
          .trim() || 'Untitled Regulation';
      }

      const content = this.extractContent($, url);
      if (!content || !this.validateContent(content, url)) {
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

      return regulation;

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error parsing regulation", {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private validateContent(content: string, url: string): boolean {
    if (!content || content.length < 50) return false;

    const patterns = {
      core: {
        education: /education|academic|school|college|university|student|faculty|degree|program|course/i,
        regulation: /regulation|policy|requirement|guideline|standard|rule|procedure/i,
        legal: /shall|must|required|compliance|pursuant|accordance|provision/i
      },
      supporting: {
        topics: /curriculum|instruction|learning|teaching|enrollment|admission|graduation|certification/i,
        governance: /board|department|agency|authority|administration|commission/i,
        documentation: /chapter|section|article|paragraph|part|title|subsection/i
      }
    };

    let score = 0;
    const matches: string[] = [];

    Object.entries(patterns.core).forEach(([key, pattern]) => {
      if (pattern.test(content)) {
        score += 2;
        matches.push(key);
      }
    });

    Object.entries(patterns.supporting).forEach(([key, pattern]) => {
      if (pattern.test(content)) {
        score += 1;
        matches.push(key);
      }
    });

    const hasSuspiciousContent = /403 Forbidden|404 Not Found|Error|Access Denied|Under Maintenance|Server Error/i.test(content);

    if (hasSuspiciousContent) {
      this.logRejectedContent(content, url, "Contains error content");
      return false;
    }

    const isValid = score >= 3 &&
      (patterns.core.education.test(content) || patterns.core.regulation.test(content));

    if (!isValid) {
      this.logRejectedContent(content, url,
        score < 3 ? "Low relevance score" :
        !patterns.core.education.test(content) && !patterns.core.regulation.test(content) ? "Missing core terms" :
        "Unknown reason"
      );
    }

    return isValid;
  }

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    $('nav, header, footer, .navigation, .menu, .sidebar, script, style').remove();

    let content = '';
    const processedTexts = new Set<string>();

    const selectors = [
      ...this.SHAREPOINT_SELECTORS.mainContent,
      ...this.SHAREPOINT_SELECTORS.richText,
      'main',
      'article',
      '.content',
      '#content',
      '[id*="regulation"]',
      '[id*="policy"]'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, element) => {
          const $element = $(element);

          $element.find('h1, h2, h3, h4, h5, h6').each((_, heading) => {
            const text = this.cleanText($(heading).text());
            if (text && !processedTexts.has(text)) {
              content += `\n${text}\n\n`;
              processedTexts.add(text);
            }
          });

          $element.find('p, li').each((_, el) => {
            const text = this.cleanText($(el).text());
            if (text && !processedTexts.has(text) && text.length > 20) {
              content += `${text}\n\n`;
              processedTexts.add(text);
            }
          });

          $element.find('table').each((_, table) => {
            const $rows = $(table).find('tr');
            if ($rows.length > 0) {
              $rows.each((_, row) => {
                const cells = $(row).find('th, td')
                  .map((_, cell) => $(cell).text().trim())
                  .get()
                  .filter(cell => cell.length > 0);

                if (cells.length > 0) {
                  const rowText = cells.join(' | ');
                  if (!processedTexts.has(rowText)) {
                    content += `${rowText}\n`;
                    processedTexts.add(rowText);
                  }
                }
              });
              content += '\n';
            }
          });
        });
      }
    }

    if (!content || content.length < 100) {
      $('div').each((_, div) => {
        const text = this.cleanText($(div).text());
        if (text && text.length > 100 && !processedTexts.has(text)) {
          content += `${text}\n\n`;
          processedTexts.add(text);
        }
      });
    }

    return content;
  }

  private cleanText(text: string): string {
    return text
      .replace(/[\r\n]+/g, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\S\n]+/g, ' ')
      .trim();
  }

  private async logRejectedContent(content: string, url: string, reason: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `rejected-content-${timestamp}.txt`;
    const filepath = path.join(this.debugDir, filename);

    const logContent = `
URL: ${url}
Rejection Reason: ${reason}
Content Length: ${content.length}
Timestamp: ${new Date().toISOString()}
Content Preview:
${content.substring(0, 2000)}...
    `.trim();

    fs.writeFileSync(filepath, logContent);

    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Logged rejected content", {
      url,
      reason,
      logFile: filename
    });
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoravianComplianceBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();

      if (!this.validateContent(content, url)) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
          "Content validation failed, content may be invalid or incomplete", {
            url,
            contentLength: content.length
          });
      }

      return content;

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch content", {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export const paRegulationCollector = new PARegulationCollector();