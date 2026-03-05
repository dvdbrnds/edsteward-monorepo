export const API_ENDPOINTS = {
  VALIDATIONS: '/api/validations',
  VALIDATION_BY_ID: (id) => `/api/validations/${id}`,
  VALIDATE: '/api/validate',
  REGULATIONS: '/api/regulations',
  UPLOAD_REGULATIONS: '/api/regulations/upload',
  COLLECT_DATA: '/api/regulations/collect-data'
};

export const ValidationStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL: 'PARTIAL',
  PENDING: 'PENDING'
};

export const ValidationSeverity = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export const ValidationLevels = [
  { id: 1, name: 'Basic', description: 'Text pattern matching validation' },
  { id: 2, name: 'Semantic', description: 'NLP-based semantic validation' },
  { id: 3, name: 'Structural', description: 'Complex structural validation' },
  { id: 4, name: 'Advanced', description: 'Cross-document and temporal validation' }
];

export const ValidationStrategy = {
  ALL: 'ALL',
  FAST_FAIL: 'FAST_FAIL',
  THOROUGH: 'THOROUGH',
  CACHED_FIRST: 'CACHED_FIRST',
  CONFIDENCE_PRIORITIZED: 'CONFIDENCE_PRIORITIZED',
  PERFORMANCE_OPTIMIZED: 'PERFORMANCE_OPTIMIZED',
  COST_OPTIMIZED: 'COST_OPTIMIZED',
  ADAPTIVE: 'ADAPTIVE'
};

export const StrategyDescriptions = {
  [ValidationStrategy.ALL]: 'Run all specified validation levels in sequence',
  [ValidationStrategy.FAST_FAIL]: 'Order validators by complexity (fastest first) and stop on first failure',
  [ValidationStrategy.THOROUGH]: 'Order validators by complexity (most thorough first)',
  [ValidationStrategy.CACHED_FIRST]: 'Prioritize validators with cached results',
  [ValidationStrategy.CONFIDENCE_PRIORITIZED]: 'Prioritize validators based on historic confidence scores',
  [ValidationStrategy.PERFORMANCE_OPTIMIZED]: 'Optimize for execution speed',
  [ValidationStrategy.COST_OPTIMIZED]: 'Optimize for computational cost',
  [ValidationStrategy.ADAPTIVE]: 'Adapt strategy based on input characteristics'
};

export const SeverityLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
}; 