/**
 * Differential text comparison utility for regulation content
 * 
 * This module provides tools to analyze and compare text between 
 * original and updated regulation content, generating statistical
 * metrics about the changes.
 */

import { diffWords } from 'diff';

/**
 * Calculates differences between original and updated text content
 * with statistical metrics about the changes.
 * 
 * @param originalText The original regulation text content
 * @param updatedText The updated regulation text content
 * @returns Object containing change statistics and differences
 */
export function calculateTextChangeDiff(originalText: string, updatedText: string) {
  // Handle null or undefined inputs
  const original = originalText || '';
  const updated = updatedText || '';
  
  // Get the word-level differences between the two texts
  const differences = diffWords(original, updated);
  
  // Calculate lengths for statistical analysis
  const originalLength = original.length;
  const updatedLength = updated.length;
  
  // Calculate content added, removed, and changed
  let addedChars = 0;
  let removedChars = 0;
  
  // Analyze each difference part
  differences.forEach(part => {
    if (part.added) {
      addedChars += part.value.length;
    } else if (part.removed) {
      removedChars += part.value.length;
    }
  });
  
  // Calculate total changed characters (sum of added and removed)
  const changedChars = addedChars + removedChars;
  
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
    // Raw character counts
    addedChars,
    removedChars,
    changedChars,
    
    // Document sizes
    originalLength,
    updatedLength,
    
    // Percentage metrics
    addedPercentage,
    removedPercentage,
    changedPercentage,
    
    // Detailed differences for rendering
    differences
  };
}