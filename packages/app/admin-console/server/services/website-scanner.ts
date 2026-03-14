/**
 * Website crawler for compliance scanning.
 *
 * Strategy: instead of guessing URL paths, we extract every link + anchor text
 * from the homepage and key sub-pages, then use Claude to identify which pages
 * are relevant to regulatory compliance. This handles arbitrary terminology
 * ("Campus Police", "Public Safety", "MUPD", "Security", etc.) naturally.
 */

import * as cheerio from 'cheerio';
import { getAllSearchPaths } from './compliance-checks.js';

export interface SiteLink {
  url: string;
  text: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  textContent: string;
  rawHtml: string;
  links: SiteLink[];
  hasPdf: boolean;
  pdfLinks: string[];
  statusCode: number;
}

export interface CrawlResult {
  baseUrl: string;
  pagesScanned: number;
  pages: CrawledPage[];
  errors: string[];
  durationMs: number;
}

const REQUEST_DELAY_MS = 120;
const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 8000;
const MAX_CONTENT_LENGTH = 50_000;
const USER_AGENT = 'EdSteward-ComplianceScanner/1.0 (compliance audit tool; +https://edsteward.ai)';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function normalizeUrl(base: string, href: string): string | null {
  try {
    const url = new URL(href, base);
    url.hash = '';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isSameDomain(baseUrl: string, testUrl: string): boolean {
  try {
    const base = new URL(baseUrl);
    const test = new URL(testUrl);
    return test.hostname === base.hostname || test.hostname.endsWith('.' + base.hostname);
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<{ html: string; status: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return { html: '', status: response.status };
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { html: '', status: response.status };
    }
    const html = await response.text();
    return { html, status: response.status };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function extractPageContent(html: string, url: string): CrawledPage {
  const $ = cheerio.load(html);

  $('script, style, noscript, iframe, svg').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim() || '';

  // Extract links BEFORE stripping HTML so we capture hrefs
  const links: SiteLink[] = [];
  const pdfLinks: string[] = [];
  const seen = new Set<string>();
  const linkAnnotations: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(url, href);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const text = $(el).text().trim().replace(/\s+/g, ' ').slice(0, 120);
    links.push({ url: normalized, text });
    if (href.toLowerCase().endsWith('.pdf')) pdfLinks.push(normalized);
    // Build annotation so Claude sees what pages link to
    if (text) linkAnnotations.push(`[${text}](${normalized})`);
  });

  let textContent = '';
  const mainSelectors = ['main', 'article', '#content', '#main-content', '.content', '.main-content', '[role="main"]'];
  for (const sel of mainSelectors) {
    if ($(sel).length) {
      textContent = $(sel).text();
      break;
    }
  }
  if (!textContent) textContent = $('body').text();

  textContent = textContent.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  // Append link annotations so the analyzer can see where links point
  if (linkAnnotations.length > 0) {
    textContent += '\n\nLINKS ON THIS PAGE:\n' + linkAnnotations.join('\n');
  }

  textContent = textContent.slice(0, MAX_CONTENT_LENGTH);

  return { url, title, textContent, rawHtml: html, links, hasPdf: pdfLinks.length > 0, pdfLinks, statusCode: 200 };
}

/**
 * Use Claude to identify which links from the site are relevant to
 * regulatory compliance. This handles arbitrary terminology and URL patterns.
 */
async function discoverCompliancePages(
  allLinks: SiteLink[],
  baseUrl: string,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return []; // Fall back to path-based discovery only

  // Deduplicate and filter to same-domain
  const unique = new Map<string, string>();
  for (const link of allLinks) {
    if (!isSameDomain(baseUrl, link.url) && !link.url.startsWith(baseUrl)) continue;
    if (!unique.has(link.url)) {
      unique.set(link.url, link.text);
    } else if (link.text && !unique.get(link.url)) {
      unique.set(link.url, link.text);
    }
  }

  const linkList = Array.from(unique.entries())
    .map(([url, text]) => {
      const path = new URL(url).pathname;
      return text ? `${path} — "${text}"` : path;
    })
    .slice(0, 300) // Cap to avoid huge prompts
    .join('\n');

  if (!linkList) return [];

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You identify web pages related to higher education regulatory compliance. Output ONLY a JSON array of URL paths. No explanation.`,
        messages: [{ role: 'user', content: `From this university website, which pages are likely related to ANY of these compliance areas?

Compliance areas: campus safety/security/police, annual security report, Clery Act, crime statistics, FERPA/student privacy/student records, Title IX/sex discrimination/sexual misconduct, ADA/disability/accessibility/accommodations, financial aid/consumer information/cost of attendance/net price calculator, HIPAA/health privacy, drug & alcohol policy, sexual violence/dating violence/stalking (Campus SaVE/VAWA), fire safety, copyright/DMCA, Section 504, GDPR/privacy policy, pregnant/parenting students, student conduct/code of conduct/community standards/judicial affairs/disciplinary procedures, student handbook, dean of students, reporting/complaint forms

Pages on this site:
${linkList}

Return a JSON array of the relevant paths (the part before the —). Include pages that might contain sub-links to compliance content (e.g., a "Student Life" page might link to policies). Return at most 25 paths.` }],
      }),
    });

    if (!response.ok) {
      console.error('Link discovery LLM call failed:', response.status);
      return [];
    }

    const data = await response.json() as any;
    const raw = data.content?.[0]?.text || '';
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const paths: string[] = JSON.parse(jsonStr);
    return paths
      .filter(p => typeof p === 'string' && p.startsWith('/'))
      .map(p => baseUrl + p);
  } catch (error: any) {
    console.error('Link discovery failed:', error.message);
    return [];
  }
}

export async function crawlWebsite(websiteUrl: string): Promise<CrawlResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];

  let baseUrl = websiteUrl;
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
  try {
    const parsed = new URL(baseUrl);
    baseUrl = parsed.origin;
  } catch {
    return { baseUrl, pagesScanned: 0, pages: [], errors: [`Invalid URL: ${websiteUrl}`], durationMs: 0 };
  }

  // ── Phase 1: Fetch homepage ──────────────────────────────────────────
  let homepageHtml: string | null = null;
  const tryUrls = [baseUrl, baseUrl.replace('://', '://www.')];
  for (const tryUrl of tryUrls) {
    const result = await fetchPage(tryUrl);
    if (result?.html) {
      homepageHtml = result.html;
      baseUrl = tryUrl;
      break;
    }
  }

  if (!homepageHtml) {
    return { baseUrl, pagesScanned: 0, pages: [], errors: ['Could not reach website homepage'], durationMs: Date.now() - startTime };
  }

  const homepage = extractPageContent(homepageHtml, baseUrl);
  pages.push(homepage);
  visited.add(baseUrl);

  // ── Phase 2: AI-powered link discovery ───────────────────────────────
  // Collect all links from the homepage (nav, footer, body)
  const allLinks = [...homepage.links];

  // Also try a few high-level navigation pages that often link deeper to
  // policies (e.g., /about, /student-life, /academics, /admissions)
  const navPaths = ['/about', '/student-life', '/life', '/students', '/current-students', '/policies', '/compliance'];
  for (const np of navPaths) {
    const navUrl = baseUrl + np;
    if (visited.has(navUrl)) continue;
    visited.add(navUrl);
    await sleep(REQUEST_DELAY_MS);
    const result = await fetchPage(navUrl);
    if (result?.html && result.status === 200) {
      const navPage = extractPageContent(result.html, navUrl);
      allLinks.push(...navPage.links);
    }
  }

  // Ask Claude which links look compliance-related
  const aiDiscoveredUrls = await discoverCompliancePages(allLinks, baseUrl);
  console.log(`   AI discovered ${aiDiscoveredUrls.length} compliance-relevant URLs`);

  // ── Phase 3: Probe common hardcoded paths (fast fallback) ────────────
  const compliancePaths = getAllSearchPaths();
  const probeUrls = compliancePaths.map(p => baseUrl + p);

  // Merge AI-discovered URLs first (higher priority), then probed paths
  const allUrlsToFetch = [...aiDiscoveredUrls, ...probeUrls];
  const deduped: string[] = [];
  for (const url of allUrlsToFetch) {
    if (!visited.has(url) && isSameDomain(baseUrl, url)) {
      visited.add(url);
      deduped.push(url);
    }
  }

  for (const url of deduped) {
    if (pages.length >= MAX_PAGES) break;
    await sleep(REQUEST_DELAY_MS);
    const result = await fetchPage(url);
    if (result?.html && result.status === 200) {
      const page = extractPageContent(result.html, url);
      pages.push(page);

      // Follow high-value links from discovered pages (one level deep)
      for (const link of page.links) {
        if (pages.length >= MAX_PAGES) break;
        if (visited.has(link.url) || !isSameDomain(baseUrl, link.url)) continue;
        const lowerText = (link.text + ' ' + link.url).toLowerCase();
        const deepKeywords = [
          'annual security', 'fire safety', 'clery', 'crime',
          'title ix', 'ferpa', 'privacy policy', 'consumer info',
          'net price', 'ada', 'section 504', 'drug', 'alcohol',
          'copyright', 'dmca', 'sexual', 'discrimination',
          'nondiscrimination', 'non-discrimination', 'accommodation',
          'disability', 'report', '.pdf',
        ];
        if (deepKeywords.some(kw => lowerText.includes(kw))) {
          visited.add(link.url);
          await sleep(REQUEST_DELAY_MS);
          const subResult = await fetchPage(link.url);
          if (subResult?.html && subResult.status === 200) {
            pages.push(extractPageContent(subResult.html, link.url));
          }
        }
      }
    }
  }

  return {
    baseUrl,
    pagesScanned: pages.length,
    pages,
    errors,
    durationMs: Date.now() - startTime,
  };
}
