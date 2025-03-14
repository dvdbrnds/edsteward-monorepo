import { storage } from '../storage';
import { db } from '../db';
import { syslog, LogLevel, LogFacility } from './syslog';
import { regulations } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

class PARegulationCollector {
  private readonly BASE_URLS = {
    paEducation: 'https://www.education.pa.gov/Policy-Funding/BECS/PACode/Pages/default.aspx',
    paHigherEd: 'https://www.education.pa.gov/Policy-Funding/BECS/PACode/Pages/HigherEducation.aspx',
    paStateSystem: 'https://www.passhe.edu/inside/policies/Pages/Board-of-Governors-Policies.aspx',
    paDeptEd: 'https://www.education.pa.gov/Teachers%20-%20Administrators/School%20Services/Pages/default.aspx',
    paStateBoard: 'https://www.stateboard.education.pa.gov/Pages/RegulationsPolicy.aspx'
  };

  private readonly debugDir = path.join(process.cwd(), 'logs', 'pa-content-debug');
  private dbConnection: any = null;
  private isProcessing = false;
  private lastConnectionTime = 0;
  private readonly MIN_CONNECTION_DELAY = 60000; // 1 minute
  private readonly OPERATION_DELAY = 30000; // 30 seconds
  private readonly problematicRegulations = new Set(['Basic Education Circulars (BECs)']);

  constructor() {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  private async logError(error: Error, context: Record<string, any>) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        detail: (error as any).detail
      },
      context
    };

    // Write to debug log file
    const logPath = path.join(this.debugDir, 'error-logs.jsonl');
    await fs.promises.appendFile(
      logPath,
      JSON.stringify(errorLog) + '\n',
      'utf8'
    );

    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
      `Error in PA regulation collector: ${error.message}`, errorLog);
  }

  private async initializeConnection(): Promise<void> {
    try {
      // Close existing connection if any
      if (this.dbConnection) {
        try {
          await this.dbConnection.end();
        } catch (error) {
          await this.logError(error instanceof Error ? error : new Error(String(error)), {
            operation: 'close_connection'
          });
        }
      }

      // Enforce minimum delay between connections
      const now = Date.now();
      const timeSinceLastConnection = now - this.lastConnectionTime;
      if (timeSinceLastConnection < this.MIN_CONNECTION_DELAY) {
        const waitTime = this.MIN_CONNECTION_DELAY - timeSinceLastConnection;
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Waiting ${waitTime}ms before creating new connection`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Initialize new connection
      this.dbConnection = drizzle(neon(process.env.DATABASE_URL!));
      this.lastConnectionTime = Date.now();

      // Verify connection
      await this.dbConnection.select().from(regulations).limit(1);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Database connection initialized");
    } catch (error) {
      await this.logError(error instanceof Error ? error : new Error(String(error)), {
        operation: 'initialize_connection'
      });
      this.dbConnection = null;
      throw error;
    }
  }

  private isProblematicRegulation(name: string): boolean {
    return this.problematicRegulations.has(name.trim());
  }

  private async processRegulation(regulation: Partial<InsertRegulation>): Promise<void> {
    // Skip problematic regulations
    if (this.isProblematicRegulation(regulation.name!)) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        `Skipping known problematic regulation: ${regulation.name}`, {
          regulationId: regulation.itemId,
          contentLength: regulation.requirements?.length || 0
        });
      return;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
          `Processing regulation attempt ${attempt}: ${regulation.name}`);

        await this.initializeConnection();

        // Query existing regulation
        const existing = await this.dbConnection
          .select()
          .from(regulations)
          .where(eq(regulations.itemId, regulation.itemId!))
          .limit(1);

        // Add delay before write operation
        await new Promise(resolve => setTimeout(resolve, this.OPERATION_DELAY));

        if (existing.length > 0) {
          await this.dbConnection
            .update(regulations)
            .set({
              ...regulation,
              lastUpdated: new Date(),
              lastVerified: new Date()
            })
            .where(eq(regulations.id, existing[0].id));

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Updated regulation: ${regulation.name}`);
        } else {
          await this.dbConnection
            .insert(regulations)
            .values(regulation);

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Created regulation: ${regulation.name}`);
        }

        // Add delay after write operation
        await new Promise(resolve => setTimeout(resolve, this.OPERATION_DELAY));
        return;

      } catch (error) {
        await this.logError(error instanceof Error ? error : new Error(String(error)), {
          operation: 'process_regulation',
          attempt,
          regulation: {
            name: regulation.name,
            itemId: regulation.itemId,
            contentLength: regulation.requirements?.length || 0,
            contentPreview: regulation.requirements?.substring(0, 200)
          }
        });

        // Reset connection on error
        this.dbConnection = null;

        // Use exponential backoff with longer base delay
        const delay = Math.pow(2, attempt) * this.OPERATION_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // After max retries, add to problematic set
    this.problematicRegulations.add(regulation.name!.trim());
    throw new Error(`Failed to process regulation after 3 attempts: ${regulation.name}`);
  }

  public async collectRegulations(): Promise<void> {
    if (this.isProcessing) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING,
        "Collection already in progress");
      return;
    }

    this.isProcessing = true;

    try {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
        "Starting PA regulations collection");

      // Process one source at a time
      for (const [source, url] of Object.entries(this.BASE_URLS)) {
        try {
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Processing source: ${source}`);

          const content = await fetch(url).then(res => res.text());
          const $ = cheerio.load(content);

          // Extract regulation links
          const links = $('a').filter((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().toLowerCase();
            return href && !href.startsWith('mailto:') && (
              /regulation|policy|requirement|standard/i.test(text) ||
              /academic|program|course|degree/i.test(text)
            );
          }).map((_, el) => {
            const href = $(el).attr('href')!;
            return href.startsWith('http') ? href : new URL(href, url).toString();
          }).get();

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO,
            `Found ${links.length} potential regulation links`);

          // Process each link sequentially
          for (const link of links) {
            try {
              // Fetch content with retry
              let content: string;
              try {
                const response = await fetch(link, {
                  headers: {
                    'User-Agent': 'MoravianComplianceBot/1.0',
                    'Accept': 'text/html,application/xhtml+xml'
                  },
                  timeout: 30000
                });
                content = await response.text();
              } catch (error) {
                await this.logError(error instanceof Error ? error : new Error(String(error)), {
                  operation: 'fetch_content',
                  link
                });
                continue;
              }

              const regulation: Partial<InsertRegulation> = {
                itemId: `PA-${source}-${Date.now()}`,
                name: $('h1').first().text().trim() || 'PA Regulation',
                topic: 'Higher Education',
                jurisdiction: 'state',
                stateCode: 'PA',
                stateAgency: source,
                regulationUrl: link,
                agency_url: url,
                agency_name: source,
                requirements: content
              };

              await this.processRegulation(regulation);

              // Add significant delay between regulations
              await new Promise(resolve => setTimeout(resolve, this.OPERATION_DELAY * 2));

            } catch (error) {
              await this.logError(error instanceof Error ? error : new Error(String(error)), {
                operation: 'process_link',
                link
              });
            }
          }

        } catch (error) {
          await this.logError(error instanceof Error ? error : new Error(String(error)), {
            operation: 'process_source',
            source
          });
        }

        // Add longer delay between sources
        await new Promise(resolve => setTimeout(resolve, this.MIN_CONNECTION_DELAY));
      }

    } catch (error) {
      await this.logError(error instanceof Error ? error : new Error(String(error)), {
        operation: 'collect_regulations'
      });
      throw error;
    } finally {
      this.isProcessing = false;
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
      await this.logError(error instanceof Error ? error : new Error(String(error)), {
        operation: 'fetchPageContent',
        url
      });
      throw error;
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

  private SHAREPOINT_SELECTORS = {
    mainContent: ['.ms-rtestate-field', '.ms-rteElement-H1', '.ms-rteElement-H2', '.ms-rteElement-H3', '.ms-rteElement-P'],
    richText: ['.ms-rtestate-read', '.ms-rtestate-write']
  };
}

export const paRegulationCollector = new PARegulationCollector();