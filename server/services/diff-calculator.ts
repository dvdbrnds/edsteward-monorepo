import { diffWords } from 'diff';

/**
 * Calculates text differences between original and updated content
 * and provides statistical metrics about the changes.
 * 
 * @param originalText The original text content
 * @param updatedText The updated text content
 * @returns Object containing change statistics
 */
export function calculateTextChangeDiff(originalText: string, updatedText: string) {
  // Get the changes between the two texts
  const differences = diffWords(originalText, updatedText);
  
  // Calculate lengths for statistical analysis
  const originalLength = originalText.length;
  const updatedLength = updatedText.length;
  
  // Calculate content added, removed, and changed
  let addedChars = 0;
  let removedChars = 0;
  let changedChars = 0;
  
  // Analyze each difference
  differences.forEach(part => {
    if (part.added) {
      addedChars += part.value.length;
    } else if (part.removed) {
      removedChars += part.value.length;
    } else {
      // This part is unchanged
    }
  });
  
  // Calculate total changed characters (sum of added and removed)
  changedChars = addedChars + removedChars;
  
  // Calculate percentages based on the original text length
  // Use updated length for added percentage to avoid division by zero if original is empty
  const addedPercentage = originalLength === 0 
    ? 100 
    : Math.round((addedChars / Math.max(originalLength, 1)) * 100);
    
  const removedPercentage = originalLength === 0 
    ? 0 
    : Math.round((removedChars / Math.max(originalLength, 1)) * 100);
    
  const changedPercentage = originalLength === 0 
    ? 100 
    : Math.round((changedChars / Math.max(originalLength, 1)) * 100);
  
  return {
    addedChars,
    removedChars,
    changedChars,
    originalLength,
    updatedLength,
    addedPercentage,
    removedPercentage,
    changedPercentage,
    differences
  };
}