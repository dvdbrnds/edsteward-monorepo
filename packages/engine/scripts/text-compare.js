// src/lambda/level1-validator/textCompare.js
/**
 * Text Comparison Utility
 * 
 * Provides utilities for comparing text values against expected values
 * with various comparison modes.
 */

/**
 * Validate a text value against expected parameters
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result with isValid flag and message
 */
function validate(value, params) {
  // Handle null/undefined values
  if (value === undefined || value === null) {
    return {
      isValid: false,
      message: 'Value is missing'
    };
  }
  
  // Convert value to string if it's not already
  const stringValue = String(value);
  
  // Get comparison mode or default to 'exact'
  const mode = params.mode || 'exact';
  
  switch (mode) {
    case 'exact':
      return exactMatch(stringValue, params);
    case 'contains':
      return containsMatch(stringValue, params);
    case 'startsWith':
      return startsWithMatch(stringValue, params);
    case 'endsWith':
      return endsWithMatch(stringValue, params);
    case 'length':
      return lengthMatch(stringValue, params);
    case 'regex':
      return regexMatch(stringValue, params);
    default:
      return {
        isValid: false,
        message: `Unknown comparison mode: ${mode}`
      };
  }
}

/**
 * Check for exact text match
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function exactMatch(value, params) {
  const expectedValue = params.value;
  const caseSensitive = params.caseSensitive !== false; // Default to true
  
  let isValid = false;
  
  if (caseSensitive) {
    isValid = value === expectedValue;
  } else {
    isValid = value.toLowerCase() === expectedValue.toLowerCase();
  }
  
  return {
    isValid,
    message: isValid ? null : `Value does not match expected value`
  };
}

/**
 * Check if value contains expected text
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function containsMatch(value, params) {
  const expectedValue = params.value;
  const caseSensitive = params.caseSensitive !== false; // Default to true
  
  let isValid = false;
  
  if (caseSensitive) {
    isValid = value.includes(expectedValue);
  } else {
    isValid = value.toLowerCase().includes(expectedValue.toLowerCase());
  }
  
  return {
    isValid,
    message: isValid ? null : `Value does not contain "${expectedValue}"`
  };
}

/**
 * Check if value starts with expected text
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function startsWithMatch(value, params) {
  const expectedValue = params.value;
  const caseSensitive = params.caseSensitive !== false; // Default to true
  
  let isValid = false;
  
  if (caseSensitive) {
    isValid = value.startsWith(expectedValue);
  } else {
    isValid = value.toLowerCase().startsWith(expectedValue.toLowerCase());
  }
  
  return {
    isValid,
    message: isValid ? null : `Value does not start with "${expectedValue}"`
  };
}

/**
 * Check if value ends with expected text
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function endsWithMatch(value, params) {
  const expectedValue = params.value;
  const caseSensitive = params.caseSensitive !== false; // Default to true
  
  let isValid = false;
  
  if (caseSensitive) {
    isValid = value.endsWith(expectedValue);
  } else {
    isValid = value.toLowerCase().endsWith(expectedValue.toLowerCase());
  }
  
  return {
    isValid,
    message: isValid ? null : `Value does not end with "${expectedValue}"`
  };
}

/**
 * Check text length
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function lengthMatch(value, params) {
  const min = params.min;
  const max = params.max;
  const exact = params.exact;
  const length = value.length;
  
  // Exact length check
  if (exact !== undefined) {
    const isValid = length === exact;
    return {
      isValid,
      message: isValid ? null : `Value length ${length} does not match expected length ${exact}`
    };
  }
  
  // Min/max length check
  let isValid = true;
  let message = null;
  
  if (min !== undefined && length < min) {
    isValid = false;
    message = `Value length ${length} is less than minimum length ${min}`;
  } else if (max !== undefined && length > max) {
    isValid = false;
    message = `Value length ${length} exceeds maximum length ${max}`;
  }
  
  return {
    isValid,
    message
  };
}

/**
 * Check regex pattern match
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function regexMatch(value, params) {
  try {
    const pattern = params.pattern;
    const flags = params.flags || '';
    
    if (!pattern) {
      return {
        isValid: false,
        message: 'Missing regex pattern parameter'
      };
    }
    
    const regex = new RegExp(pattern, flags);
    const isValid = regex.test(value);
    
    return {
      isValid,
      message: isValid ? null : `Value does not match pattern ${pattern}`
    };
  } catch (error) {
    return {
      isValid: false,
      message: `Invalid regex pattern: ${error.message}`
    };
  }
}

module.exports = {
  validate
};
