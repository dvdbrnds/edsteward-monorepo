/**
 * Diff Generator
 * 
 * Generates detailed diffs and human-readable explanations of differences
 * between regulation texts.
 */

const diff = require('diff');

/**
 * Generate a detailed line-by-line diff between two texts
 * 
 * @param {string} sourceText - Source regulation text
 * @param {string} targetText - Target authoritative text
 * @returns {Array} Detailed diff information
 */
function generateDetailedDiff(sourceText, targetText) {
  // Split text into lines for more meaningful diffs
  const sourceLines = sourceText.split('\n');
  const targetLines = targetText.split('\n');
  
  // Generate line-by-line diff
  const lineDiff = diff.diffLines(sourceText, targetText);
  
  // Process differences into structured format
  const detailedDiff = [];
  
  let sourceLineNumber = 0;
  let targetLineNumber = 0;
  
  lineDiff.forEach(part => {
    const diffPart = {
      type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      text: part.value,
      lineCount: (part.value.match(/\n/g) || []).length + (part.value.endsWith('\n') ? 0 : 1)
    };
    
    // Add line numbers for reference
    if (!part.added) {
      diffPart.sourceStart = sourceLineNumber;
      sourceLineNumber += diffPart.lineCount;
      diffPart.sourceEnd = sourceLineNumber - 1;
    }
    
    if (!part.removed) {
      diffPart.targetStart = targetLineNumber;
      targetLineNumber += diffPart.lineCount;
      diffPart.targetEnd = targetLineNumber - 1;
    }
    
    detailedDiff.push(diffPart);
  });
  
  // Add additional metadata
  return {
    differences: detailedDiff,
    stats: {
      additions: detailedDiff.filter(p => p.type === 'added').reduce((sum, p) => sum + p.lineCount, 0),
      deletions: detailedDiff.filter(p => p.type === 'removed').reduce((sum, p) => sum + p.lineCount, 0),
      changes: detailedDiff.filter(p => p.type !== 'unchanged').length,
      totalLines: sourceLines.length,
      changePercentage: Math.round(
        (detailedDiff.filter(p => p.type !== 'unchanged').reduce((sum, p) => sum + p.lineCount, 0) / 
        sourceLines.length) * 100
      )
    }
  };
}

/**
 * Generate a human-readable summary of the differences
 * 
 * @param {Object} diffResult - Diff result from generateDetailedDiff
 * @returns {string} Human-readable summary
 */
function generateHumanReadableSummary(diffResult) {
  const { differences, stats } = diffResult;
  
  // Create a summary of changes
  let summary = `The regulation text has ${stats.changes} differences from the authoritative source:\n`;
  
  // Add statistics
  summary += `- ${stats.additions} lines added\n`;
  summary += `- ${stats.deletions} lines removed\n`;
  summary += `- Approximately ${stats.changePercentage}% of the content differs from the authoritative source\n\n`;
  
  // Add key differences (limit to most significant changes)
  const significantDiffs = differences.filter(d => 
    d.type !== 'unchanged' && 
    d.text.length > 10 && 
    !d.text.match(/^[\s\n]*$/) // Skip whitespace-only changes
  );
  
  if (significantDiffs.length > 0) {
    summary += "Key differences:\n";
    
    // Limit to 5 most significant differences
    const topDiffs = significantDiffs
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 5);
    
    topDiffs.forEach((part, i) => {
      const truncatedText = part.text.length > 100 
        ? part.text.substring(0, 97) + '...' 
        : part.text;
      
      const cleanText = truncatedText.replace(/\n/g, ' ').trim();
      
      summary += `${i + 1}. ${part.type === 'added' ? 'Added' : 'Removed'}: "${cleanText}"\n`;
      
      if (part.type === 'removed') {
        summary += `   at source lines ${part.sourceStart + 1}-${part.sourceEnd + 1}\n`;
      } else {
        summary += `   at target lines ${part.targetStart + 1}-${part.targetEnd + 1}\n`;
      }
    });
  } else {
    summary += "No significant textual differences found, but formatting or whitespace may differ.\n";
  }
  
  return summary;
}

/**
 * Check if a specific article is correctly represented
 * 
 * @param {string} articleNumber - Article number to check
 * @param {string} sourceText - Source regulation text
 * @param {string} targetText - Target authoritative text
 * @returns {Object} Article validation result
 */
function validateSpecificArticle(articleNumber, sourceText, targetText) {
  // Extract the specific article from both texts
  const sourceArticleMatch = sourceText.match(
    new RegExp(`Article\\s*${articleNumber}[^]*?(?=Article\\s*\\d+|$)`, 'i')
  );
  
  const targetArticleMatch = targetText.match(
    new RegExp(`Article\\s*${articleNumber}[^]*?(?=Article\\s*\\d+|$)`, 'i')
  );
  
  if (!sourceArticleMatch) {
    return {
      valid: false,
      message: `Article ${articleNumber} not found in source text`
    };
  }
  
  if (!targetArticleMatch) {
    return {
      valid: false,
      message: `Article ${articleNumber} not found in target text - can't validate`
    };
  }
  
  const sourceArticle = sourceArticleMatch[0];
  const targetArticle = targetArticleMatch[0];
  
  // Generate diff for this specific article
  const articleDiff = generateDetailedDiff(sourceArticle, targetArticle);
  
  // Check if article matches
  const isValid = articleDiff.stats.changePercentage < 10; // Less than 10% difference
  
  return {
    valid: isValid,
    message: isValid 
      ? `Article ${articleNumber} matches the authoritative source`
      : `Article ${articleNumber} has significant differences from the authoritative source`,
    diff: articleDiff,
    summary: generateHumanReadableSummary(articleDiff)
  };
}

module.exports = {
  generateDetailedDiff,
  generateHumanReadableSummary,
  validateSpecificArticle
};