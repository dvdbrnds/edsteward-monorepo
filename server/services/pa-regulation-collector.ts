import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertRegulationSchema } from '@shared/schema';
import type { InsertRegulation } from '@shared/schema';
import { format } from 'date-fns';

class PARegulationCollector {
  private readonly BASE_URLS = {
    paCode: 'https://www.pacodeandbulletin.gov',
    paDep: 'https://www.dep.pa.gov',
    paEducation: 'https://www.education.pa.gov'
  };

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching content from ${url}:`, error);
      throw error;
    }
  }

  private parseRegulation(html: string, source: string): Partial<InsertRegulation> {
    const $ = cheerio.load(html);
    
    // Basic regulation data extraction
    const name = $('.regulation-title').text().trim();
    const summary = $('.regulation-summary').text().trim();
    const effectiveDateText = $('.effective-date').text().trim();
    
    return {
      name: name || 'Untitled PA Regulation',
      jurisdiction: 'state',
      stateCode: 'PA',
      stateAgency: source,
      summary,
      effectiveDate: effectiveDateText ? new Date(effectiveDateText) : null,
      sources: [{
        url: source,
        type: 'web-scrape' as const,
        lastChecked: new Date()
      }]
    };
  }

  public async collectRegulations(): Promise<Partial<InsertRegulation>[]> {
    const regulations: Partial<InsertRegulation>[] = [];
    
    try {
      // Fetch from PA Code and Bulletin
      const paCodeContent = await this.fetchPageContent(this.BASE_URLS.paCode);
      const paCodeRegs = this.parseRegulation(paCodeContent, 'PA Code and Bulletin');
      regulations.push(paCodeRegs);

      // Add more sources as needed
      // TODO: Implement fetching from additional PA government sources
      
      return regulations;
    } catch (error) {
      console.error('Error collecting PA regulations:', error);
      throw error;
    }
  }

  public async validateRegulation(regulation: Partial<InsertRegulation>): Promise<boolean> {
    try {
      await insertRegulationSchema.parseAsync(regulation);
      return true;
    } catch (error) {
      console.error('Regulation validation failed:', error);
      return false;
    }
  }
}

export const paRegulationCollector = new PARegulationCollector();
