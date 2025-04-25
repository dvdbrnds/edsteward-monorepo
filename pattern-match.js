// src/lambda/level1-validator/patternMatch.js
/**
 * Pattern Matching Utility
 * 
 * Provides utilities for validating values against patterns
 * like regular expressions, wildcards, and common formats.
 */

/**
 * Validate a value against a pattern
 * 
 * @param {any} value - The value to validate
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
  
  // Get pattern type or default to 'regex'
  const patternType = params.patternType || 'regex';
  
  switch (patternType) {
    case 'regex':
      return validateRegex(stringValue, params);
    case 'format':
      return validateFormat(stringValue, params);
    case 'enum':
      return validateEnum(stringValue, params);
    case 'wildcard':
      return validateWildcard(stringValue, params);
    default:
      return {
        isValid: false,
        message: `Unknown pattern type: ${patternType}`
      };
  }
}

/**
 * Validate value against regex pattern
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function validateRegex(value, params) {
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

/**
 * Validate value against common formats
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function validateFormat(value, params) {
  const format = params.format;
  
  if (!format) {
    return {
      isValid: false,
      message: 'Missing format parameter'
    };
  }
  
  switch (format) {
    case 'email':
      return validateEmail(value);
    case 'date':
      return validateDate(value);
    case 'time':
      return validateTime(value);
    case 'datetime':
      return validateDateTime(value);
    case 'url':
      return validateUrl(value);
    case 'phone':
      return validatePhone(value);
    case 'zipcode':
      return validateZipCode(value);
    case 'ssn':
      return validateSSN(value);
    default:
      return {
        isValid: false,
        message: `Unknown format: ${format}`
      };
  }
}

/**
 * Validate value against enumerated values
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function validateEnum(value, params) {
  const allowedValues = params.values;
  const caseSensitive = params.caseSensitive !== false; // Default to true
  
  if (!allowedValues || !Array.isArray(allowedValues)) {
    return {
      isValid: false,
      message: 'Missing or invalid enum values parameter'
    };
  }
  
  let isValid = false;
  
  if (caseSensitive) {
    isValid = allowedValues.includes(value);
  } else {
    isValid = allowedValues.some(
      allowedValue => String(allowedValue).toLowerCase() === value.toLowerCase()
    );
  }
  
  return {
    isValid,
    message: isValid ? null : `Value must be one of: ${allowedValues.join(', ')}`
  };
}

/**
 * Validate value against wildcard pattern
 * 
 * @param {string} value - The value to validate
 * @param {Object} params - Validation parameters
 * @returns {Object} Validation result
 */
function validateWildcard(value, params) {
  const pattern = params.pattern;
  
  if (!pattern) {
    return {
      isValid: false,
      message: 'Missing wildcard pattern parameter'
    };
  }
  
  // Convert wildcard to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // Escape dots
    .replace(/\*/g, '.*')   // * becomes .*
    .replace(/\?/g, '.');   // ? becomes .
  
  const regex = new RegExp(`^${regexPattern}$`);
  const isValid = regex.test(value);
  
  return {
    isValid,
    message: isValid ? null : `Value does not match pattern ${pattern}`
  };
}

/**
 * Validate email format
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateEmail(value) {
  // Basic email regex - not exhaustive but covers most common cases
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isValid = emailRegex.test(value);
  
  return {
    isValid,
    message: isValid ? null : 'Invalid email format'
  };
}

/**
 * Validate date format (YYYY-MM-DD)
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateDate(value) {
  // Check format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return {
      isValid: false,
      message: 'Date must be in YYYY-MM-DD format'
    };
  }
  
  // Check if date is valid
  const date = new Date(value);
  const isValid = !isNaN(date.getTime());
  
  return {
    isValid,
    message: isValid ? null : 'Invalid date'
  };
}

/**
 * Validate time format (HH:MM:SS or HH:MM)
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateTime(value) {
  // Check format HH:MM:SS or HH:MM
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
  const isValid = timeRegex.test(value);
  
  return {
    isValid,
    message: isValid ? null : 'Time must be in HH:MM:SS or HH:MM format'
  };
}

/**
 * Validate datetime format (ISO 8601)
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateDateTime(value) {
  // Check if datetime is valid ISO format
  const date = new Date(value);
  const isValid = !isNaN(date.getTime());
  
  return {
    isValid,
    message: isValid ? null : 'Datetime must be in ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SSZ)'
  };
}

/**
 * Validate URL format
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateUrl(value) {
  try {
    // Check if URL is valid
    new URL(value);
    return {
      isValid: true,
      message: null
    };
  } catch (error) {
    return {
      isValid: false,
      message: 'Invalid URL format'
    };
  }
}

/**
 * Validate phone number format
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validatePhone(value) {
  // Very basic phone validation - adjust for specific requirements
  const phoneRegex = /^\+?[0-9\s()-]{10,15}$/;
  const isValid = phoneRegex.test(value);
  
  return {
    isValid,
    message: isValid ? null : 'Invalid phone number format'
  };
}

/**
 * Validate US ZIP code format
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateZipCode(value) {
  // US ZIP code - 5 digits or 5+4
  const zipRegex = /^\d{5}(?:-\d{4})?$/;
  const isValid = zipRegex.test(value);
  
  return {
    isValid,
    message: isValid ? null : 'Invalid ZIP code format'
  };
}

/**
 * Validate US Social Security Number format
 * 
 * @param {string} value - The value to validate
 * @returns {Object} Validation result
 */
function validateSSN(value) {
  // US SSN - XXX-XX-XXXX
  const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
  const isValid = ssnRegex.test(value);
  
  return {
    isValid,
    message: isValid ? null : 'Invalid SSN format'
  };
}

module.exports = {
  validate
};
