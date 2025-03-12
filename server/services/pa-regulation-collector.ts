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
    /^\s*$/,
    /^menu$/i,
    /^search$/i,
    /^home$/i,
    /^breadcrumb$/i,
    /^skip to/i,
    /^copyright/i,
    /^site map$/i,
    /^contact us$/i
  ];

  private readonly CONTENT_SECTION_SELECTORS = [
    // Primary content areas
    '#main-content',
    '.main-content',
    '.content-main',
    '#contentMain',
    // Regulation-specific sections
    '.regulation-content',
    '.policy-content',
    '[id*="policy"]',
    '[id*="regulation"]',
    // Generic content areas
    'article',
    '.post-content',
    '.entry-content',
    '#content',
    '.content',
    'main'
  ];

  private readonly TITLE_INDICATORS = [
    // Direct regulation/policy titles
    'Requirements for',
    'Policy on',
    'Regulation for',
    'Guidelines for',
    'Standards for',
    // Education-specific prefixes
    'Academic Requirements',
    'Program Requirements',
    'Student Policy',
    'Faculty Policy',
    'Certification Requirements',
    // Action verbs often used in titles
    'Establishing',
    'Implementing',
    'Governing'
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

  private findTitle($: cheerio.CheerioAPI): string {
    let candidates: Array<{ text: string, source: string, score: number }> = [];

    // Search for titles in headings
    $('h1, h2, h3, [class*="title"], [id*="title"]').each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text && text.length >= 5 && !this.IGNORED_TITLE_PATTERNS.some(p => p.test(text))) {
        candidates.push({
          text,
          source: el.tagName,
          score: this.scoreTitleCandidate(text)
        });
      }
    });

    // Look for key phrases in paragraphs
    $('p').slice(0, 3).each((_, el) => {
      const text = this.cleanText($(el).text());
      for (const indicator of this.TITLE_INDICATORS) {
        const pattern = new RegExp(`${indicator}\\s+([^.!?]+)[.!?]`, 'i');
        const match = text.match(pattern);
        if (match && match[1]) {
          const title = this.cleanText(match[0]);
          candidates.push({
            text: title,
            source: 'paragraph',
            score: this.scoreTitleCandidate(title)
          });
        }
      }
    });

    // Log all candidates for debugging
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Title candidates found", {
      candidates: candidates.map(c => ({
        text: c.text,
        source: c.source,
        score: c.score
      }))
    });

    // Sort by score and get best candidate
    candidates.sort((a, b) => b.score - a.score);
    const bestCandidate = candidates[0];

    if (bestCandidate && bestCandidate.score >= 2) {
      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Selected title", {
        title: bestCandidate.text,
        source: bestCandidate.source,
        score: bestCandidate.score
      });
      return bestCandidate.text;
    }

    return '';
  }

  private scoreTitleCandidate(text: string): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    // Check for regulation-related terms
    const regulationTerms = ['regulation', 'policy', 'requirement', 'standard', 'guideline'];
    for (const term of regulationTerms) {
      if (lowerText.includes(term)) score += 2;
    }

    // Check for education-related terms
    const educationTerms = ['academic', 'student', 'faculty', 'program', 'degree', 'education'];
    for (const term of educationTerms) {
      if (lowerText.includes(term)) score += 1;
    }

    // Check for title indicators
    for (const indicator of this.TITLE_INDICATORS) {
      if (lowerText.includes(indicator.toLowerCase())) score += 2;
    }

    // Penalize very short or long titles
    if (text.length < 10) score -= 1;
    if (text.length > 150) score -= 2;

    return score;
  }

  private extractContent($: cheerio.CheerioAPI): string {
    let bestContent = '';

    // Remove non-content elements
    $('script, style, nav, header, footer, .navigation, .menu, .sidebar').remove();

    // Try each content selector
    for (const selector of this.CONTENT_SECTION_SELECTORS) {
      const section = $(selector);
      if (section.length) {
        let content = '';

        // Process each element while preserving structure
        section.find('*').each((_, el) => {
          const $el = $(el);

          if ($el.is('p')) {
            content += $el.text() + '\n\n';
          } else if ($el.is('h1, h2, h3, h4, h5, h6')) {
            content += '\n' + $el.text() + '\n\n';
          } else if ($el.is('ul, ol')) {
            $el.find('li').each((_, li) => {
              content += '• ' + $(li).text() + '\n';
            });
            content += '\n';
          } else if ($el.is('table')) {
            $el.find('tr').each((_, row) => {
              content += $(row).find('td, th').map((_, cell) => $(cell).text()).get().join(' | ') + '\n';
            });
            content += '\n';
          }
        });

        content = this.cleanText(content);
        if (content.length > bestContent.length) {
          bestContent = content;
        }
      }
    }

    // Log content extraction result
    syslog.log(LogFacility.LOCAL0, LogLevel.DEBUG, "Content extraction result", {
      contentLength: bestContent.length,
      preview: bestContent.substring(0, 200)
    });

    return bestContent;
  }

  private detectCategory(content: string): string {
    const categories = {
      'Academic Programs': ['curriculum', 'program', 'degree', 'academic', 'course'],
      'Financial Aid': ['financial aid', 'scholarship', 'grant', 'loan', 'tuition'],
      'Student Services': ['student service', 'counseling', 'advising', 'support'],
      'Athletics': ['athletic', 'sport', 'physical education', 'competition'],
      'Campus Safety': ['safety', 'security', 'emergency', 'crime'],
      'Research': ['research', 'intellectual property', 'innovation'],
      'Human Resources': ['employment', 'faculty', 'staff', 'personnel']
    };

    let bestMatch = 'Other';
    let highestScore = 0;

    const lowerContent = content.toLowerCase();
    for (const [category, terms] of Object.entries(categories)) {
      const score = terms.reduce((sum, term) => {
        const matches = lowerContent.match(new RegExp(term, 'g'));
        return sum + (matches ? matches.length : 0);
      }, 0);

      if (score > highestScore) {
        highestScore = score;
        bestMatch = category;
      }
    }

    return bestMatch;
  }

  private async parseRegulation(html: string, source: string, url: string): Promise<Partial<InsertRegulation> | null> {
    try {
      const $ = cheerio.load(html);

      // Find title first
      const title = this.findTitle($);
      if (!title) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "No valid title found", {
          id: "SKIP_PAGE",
          parameters: { url }
        });
        return null;
      }

      // Extract content
      const content = this.extractContent($);
      if (!content || content.length < 100) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Insufficient content", {
          id: "SKIP_PAGE",
          parameters: { url, contentLength: content?.length || 0 }
        });
        return null;
      }

      const category = this.detectCategory(content);
      const itemId = `PA-${source}-${Buffer.from(title).toString('base64').substring(0, 8)}`;

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

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully parsed regulation", {
        id: "PARSE_SUCCESS",
        parameters: {
          title,
          category,
          contentLength: content.length,
          url
        }
      });

      return regulation;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error parsing regulation", {
        id: "PARSE_ERROR",
        parameters: {
          url,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
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
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching page", {
        id: "FETCH_ERROR",
        parameters: {
          url,
          error: error instanceof Error ? error.message : String(error)
        }
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
          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Processing source", { source });

          const content = await this.fetchPageContent(baseUrl);
          const $ = cheerio.load(content);

          // Find potential regulation links
          const links = $('a').toArray()
            .filter(element => {
              const href = $(element).attr('href');
              const text = $(element).text().toLowerCase();

              if (!href || href.startsWith('mailto:')) return false;

              return (
                text.includes('regulation') ||
                text.includes('policy') ||
                text.includes('requirement') ||
                text.includes('standard') ||
                text.includes('education') ||
                text.includes('academic')
              );
            });

          for (const link of links) {
            try {
              const href = $(link).attr('href');
              if (!href) continue;

              const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
              const pageContent = await this.fetchPageContent(fullUrl);
              const regulation = await this.parseRegulation(pageContent, source, fullUrl);

              if (regulation) {
                regulations.push(regulation);
                syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Added regulation", {
                  source,
                  url: fullUrl,
                  title: regulation.name
                });
              }
            } catch (error) {
              syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error processing link", {
                id: "LINK_ERROR",
                parameters: {
                  url: href,
                  source,
                  error: error instanceof Error ? error.message : String(error)
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
              error: error instanceof Error ? error.message : String(error)
            }
          });
          continue;
        }
      }

      return regulations;
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error in regulation collection", {
        id: "COLLECTION_ERROR",
        parameters: {
          error: error instanceof Error ? error.message : String(error)
        }
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
        id: "VALIDATION_ERROR",
        parameters: {
          name: regulation.name,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }
}

export const paRegulationCollector = new PARegulationCollector();