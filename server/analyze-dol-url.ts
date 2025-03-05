
import { UrlPatternAnalyzer } from './url-pattern-analyzer';

async function analyzeUrl() {
  try {
    const url = "https://www.dol.gov/agencies/oasam/regulatory/statutes/age-discrimination-act";
    console.log(`Analyzing URL: ${url}`);
    
    const results = await UrlPatternAnalyzer.findSimilarRegulations(url);
    
    console.log('Analysis Results:');
    console.log(JSON.stringify(results, null, 2));
    
    if (results.similarUrls && results.similarUrls.length > 0) {
      console.log('\nSimilar Regulations:');
      results.similarUrls.forEach((similar, index) => {
        console.log(`${index + 1}. ${similar}`);
      });
    } else {
      console.log('\nNo similar regulations found.');
    }
  } catch (error) {
    console.error('Error analyzing URL:', error);
  }
}

analyzeUrl();
