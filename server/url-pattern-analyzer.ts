
import axios from 'axios';
import * as cheerio from 'cheerio';
import { storage } from './storage';

/**
 * Analyzes a regulation URL to extract patterns and discover similar regulations
 */
export class UrlPatternAnalyzer {
  /**
   * Extract the base URL and pattern from a regulation URL
   */
  static parseUrl(url: string) {
    try {
      if (!url || !url.startsWith('http')) {
        return { baseUrl: '', pattern: '', isValid: false };
      }
      
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      
      // Extract numeric patterns that might indicate regulation IDs
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const numericPatterns = pathParts
        .filter(part => /\d+/.test(part))
        .map(part => {
          const match = part.match(/(\D*)(\d+)(\D*)/);
          if (match) {
            return {
              prefix: match[1] || '',
              number: match[2],
              suffix: match[3] || '',
              pattern: `${match[1]}[0-9]+${match[3]}`
            };
          }
          return null;
        })
        .filter(Boolean);
      
      return { 
        baseUrl, 
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        numericPatterns,
        isValid: true
      };
    } catch (error) {
      console.error('Error parsing URL:', error);
      return { baseUrl: '', pattern: '', isValid: false };
    }
  }

  /**
   * Scrape a page and find similar regulation links based on URL patterns
   */
  static async findSimilarRegulations(originalUrl: string, maxResults = 10) {
    try {
      const { baseUrl, hostname, path, numericPatterns, isValid } = this.parseUrl(originalUrl);
      
      if (!isValid) {
        return { success: false, error: 'Invalid URL format', similarUrls: [] };
      }
      
      // Try scraping the page that contains the regulation
      const response = await axios.get(originalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 RegulationComplianceBot'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const links = $('a[href]')
        .map(function() {
          const href = $(this).attr('href');
          return href;
        })
        .get()
        .filter(href => href && (href.startsWith('http') || href.startsWith('/')));
      
      // Normalize relative URLs
      const normalizedLinks = links.map(link => {
        if (link.startsWith('/')) {
          return `${baseUrl}${link}`;
        }
        return link;
      });
      
      // Filter for similar patterns
      const similarLinks = new Set<string>();
      
      // First look for URLs on the same domain with similar path structure
      normalizedLinks
        .filter(link => link.includes(hostname) && link !== originalUrl)
        .forEach(link => {
          // Check if the link has a similar pattern to the original URL
          const linkPathname = new URL(link).pathname;
          if (linkPathname.split('/').length === path.split('/').length) {
            similarLinks.add(link);
          }
          
          // Also check numeric patterns
          if (numericPatterns.length > 0) {
            numericPatterns.forEach(pattern => {
              if (pattern && linkPathname.includes(pattern.prefix) && linkPathname.includes(pattern.suffix)) {
                similarLinks.add(link);
              }
            });
          }
        });
      
      // Return the results with metadata
      return {
        success: true,
        originalUrl,
        baseUrl,
        patterns: numericPatterns,
        similarUrls: Array.from(similarLinks).slice(0, maxResults),
        hostname,
        totalFound: similarLinks.size
      };
    } catch (error) {
      console.error('Error finding similar regulations:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        similarUrls: []
      };
    }
  }
  
  /**
   * Analyze a batch of regulations and extract URL patterns
   */
  static async analyzeBatchRegulations() {
    try {
      const regulations = await storage.getRegulations();
      const regulationsWithUrls = regulations.filter(reg => 
        reg.agency_url && reg.agency_url.startsWith('http')
      );
      
      
      const urlPatterns = new Map<string, Set<string>>();
      const domainStats: Record<string, number> = {};
      
      regulationsWithUrls.forEach(reg => {
        try {
          const { hostname, path } = this.parseUrl(reg.agency_url);
          
          // Track domains
          domainStats[hostname] = (domainStats[hostname] || 0) + 1;
          
          // Track path patterns
          const pathPattern = path.replace(/\d+/g, '[NUMBER]');
          if (!urlPatterns.has(hostname)) {
            urlPatterns.set(hostname, new Set());
          }
          urlPatterns.get(hostname)?.add(pathPattern);
        } catch (error) {
          console.error(`Error analyzing URL pattern for regulation ${reg.itemId}:`, error);
        }
      });
      
      // Convert to a more readable format
      const analysis = {
        totalRegulations: regulations.length,
        regulationsWithUrls: regulationsWithUrls.length,
        domains: Object.entries(domainStats)
          .sort((a, b) => b[1] - a[1])
          .map(([domain, count]) => ({
            domain,
            count,
            patterns: Array.from(urlPatterns.get(domain) || [])
          }))
      };
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing regulation URLs:', error);
      throw error;
    }
  }
}
