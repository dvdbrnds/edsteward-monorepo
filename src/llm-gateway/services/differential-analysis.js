/**
 * Differential Analysis Engine
 * 
 * Compares incoming regulation data against existing records to detect changes.
 * Generates change summaries for CCO review.
 * 
 * Features:
 *   - Content hash comparison
 *   - Text diff generation
 *   - Task/deadline change detection
 *   - Change significance classification
 */

import crypto from 'crypto';

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Generate SHA-256 hash for content
 */
function generateHash(content) {
  if (!content) return null;
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Normalize text for comparison (remove whitespace variations)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
    .toLowerCase();
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

/**
 * Detect changes between two regulation versions
 */
export function detectChanges(existingData, incomingData) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🔍 DIFFERENTIAL ANALYSIS ENGINE`);
  console.log(`${'═'.repeat(70)}\n`);
  
  const startTime = Date.now();
  
  const result = {
    hasChanges: false,
    changeType: 'none',
    changeSeverity: 'none',
    changes: [],
    summary: '',
    
    // Hash comparison
    hashes: {
      existing: {
        content: generateHash(existingData?.content || existingData?.regulationText),
        tasks: generateHash(existingData?.tasks || existingData?.complianceTasks),
        deadlines: generateHash(existingData?.deadlines || existingData?.filingDeadlines)
      },
      incoming: {
        content: generateHash(incomingData?.content || incomingData?.regulationText),
        tasks: generateHash(incomingData?.tasks || incomingData?.complianceTasks),
        deadlines: generateHash(incomingData?.deadlines || incomingData?.filingDeadlines)
      }
    },
    
    // Analysis metadata
    analysis: {
      timestamp: new Date().toISOString(),
      duration: null
    }
  };
  
  // 1. Content/Text Changes
  if (result.hashes.existing.content !== result.hashes.incoming.content) {
    const contentChange = analyzeTextChanges(
      existingData?.content || existingData?.regulationText || '',
      incomingData?.content || incomingData?.regulationText || ''
    );
    
    if (contentChange.hasChanges) {
      result.hasChanges = true;
      result.changes.push({
        type: 'content',
        description: 'Regulation text has changed',
        details: contentChange
      });
    }
  }
  
  // 2. Task Changes
  if (result.hashes.existing.tasks !== result.hashes.incoming.tasks) {
    const taskChanges = analyzeTaskChanges(
      existingData?.tasks || existingData?.complianceTasks || [],
      incomingData?.tasks || incomingData?.complianceTasks || []
    );
    
    if (taskChanges.hasChanges) {
      result.hasChanges = true;
      result.changes.push({
        type: 'tasks',
        description: 'Compliance tasks have changed',
        details: taskChanges
      });
    }
  }
  
  // 3. Deadline Changes
  if (result.hashes.existing.deadlines !== result.hashes.incoming.deadlines) {
    const deadlineChanges = analyzeDeadlineChanges(
      existingData?.deadlines || existingData?.filingDeadlines || [],
      incomingData?.deadlines || incomingData?.filingDeadlines || []
    );
    
    if (deadlineChanges.hasChanges) {
      result.hasChanges = true;
      result.changes.push({
        type: 'deadlines',
        description: 'Filing deadlines have changed',
        details: deadlineChanges
      });
    }
  }
  
  // 4. Metadata Changes
  const metadataChanges = analyzeMetadataChanges(existingData, incomingData);
  if (metadataChanges.hasChanges) {
    result.hasChanges = true;
    result.changes.push({
      type: 'metadata',
      description: 'Regulation metadata has changed',
      details: metadataChanges
    });
  }
  
  // Determine overall change type and severity
  if (result.hasChanges) {
    result.changeType = determineChangeType(result.changes);
    result.changeSeverity = determineChangeSeverity(result.changes);
    result.summary = generateChangeSummary(result.changes);
  } else {
    result.summary = 'No changes detected between existing and incoming regulation data.';
  }
  
  result.analysis.duration = `${Date.now() - startTime}ms`;
  
  console.log(`  📊 Result: ${result.hasChanges ? 'CHANGES DETECTED' : 'NO CHANGES'}`);
  console.log(`  📋 Change Type: ${result.changeType}`);
  console.log(`  ⚠️  Severity: ${result.changeSeverity}`);
  console.log(`  ⏱️  Duration: ${result.analysis.duration}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  return result;
}

/**
 * Analyze text content changes
 */
function analyzeTextChanges(existingText, incomingText) {
  const normExisting = normalizeText(existingText);
  const normIncoming = normalizeText(incomingText);
  
  if (normExisting === normIncoming) {
    return { hasChanges: false };
  }
  
  // Calculate basic diff stats
  const existingWords = normExisting.split(/\s+/).filter(w => w);
  const incomingWords = normIncoming.split(/\s+/).filter(w => w);
  
  const existingSet = new Set(existingWords);
  const incomingSet = new Set(incomingWords);
  
  const addedWords = [...incomingSet].filter(w => !existingSet.has(w));
  const removedWords = [...existingSet].filter(w => !incomingSet.has(w));
  
  // Find key changed sections
  const keyPhrases = findKeyChangedPhrases(existingText, incomingText);
  
  return {
    hasChanges: true,
    existingLength: existingText.length,
    incomingLength: incomingText.length,
    lengthChange: incomingText.length - existingText.length,
    wordCountChange: incomingWords.length - existingWords.length,
    addedWordsCount: addedWords.length,
    removedWordsCount: removedWords.length,
    keyPhrases: keyPhrases.slice(0, 10),
    significance: calculateTextSignificance(addedWords, removedWords, keyPhrases)
  };
}

/**
 * Find key phrases that changed (containing requirement language)
 */
function findKeyChangedPhrases(existingText, incomingText) {
  const keyTerms = ['shall', 'must', 'required', 'deadline', 'penalty', 'fine', 'submit', 'report', 'notify'];
  const phrases = [];
  
  // Simple implementation: find sentences with key terms that differ
  const existingSentences = (existingText || '').split(/[.!?]+/).map(s => s.trim().toLowerCase());
  const incomingSentences = (incomingText || '').split(/[.!?]+/).map(s => s.trim().toLowerCase());
  
  const existingSet = new Set(existingSentences);
  const incomingSet = new Set(incomingSentences);
  
  // New sentences containing key terms
  for (const sentence of incomingSentences) {
    if (!existingSet.has(sentence) && keyTerms.some(term => sentence.includes(term))) {
      phrases.push({ type: 'added', text: sentence.substring(0, 150) });
    }
  }
  
  // Removed sentences containing key terms
  for (const sentence of existingSentences) {
    if (!incomingSet.has(sentence) && keyTerms.some(term => sentence.includes(term))) {
      phrases.push({ type: 'removed', text: sentence.substring(0, 150) });
    }
  }
  
  return phrases;
}

/**
 * Calculate significance of text changes
 */
function calculateTextSignificance(addedWords, removedWords, keyPhrases) {
  const requirementTerms = ['shall', 'must', 'required', 'mandatory', 'prohibited'];
  const deadlineTerms = ['deadline', 'date', 'within', 'days', 'annual', 'quarterly'];
  const penaltyTerms = ['penalty', 'fine', 'violation', 'sanction'];
  
  let score = 0;
  
  // Check added words for significant terms
  for (const word of addedWords) {
    if (requirementTerms.includes(word)) score += 10;
    if (deadlineTerms.includes(word)) score += 8;
    if (penaltyTerms.includes(word)) score += 12;
  }
  
  // Check removed words
  for (const word of removedWords) {
    if (requirementTerms.includes(word)) score += 10;
    if (deadlineTerms.includes(word)) score += 8;
    if (penaltyTerms.includes(word)) score += 12;
  }
  
  // Key phrases add significance
  score += keyPhrases.length * 5;
  
  if (score >= 30) return 'high';
  if (score >= 15) return 'medium';
  if (score > 0) return 'low';
  return 'minimal';
}

/**
 * Analyze task changes
 */
function analyzeTaskChanges(existingTasks, incomingTasks) {
  const existing = Array.isArray(existingTasks) ? existingTasks : [];
  const incoming = Array.isArray(incomingTasks) ? incomingTasks : [];
  
  if (existing.length === 0 && incoming.length === 0) {
    return { hasChanges: false };
  }
  
  // Map tasks by title for comparison
  const existingByTitle = new Map(existing.map(t => [normalizeText(t.title), t]));
  const incomingByTitle = new Map(incoming.map(t => [normalizeText(t.title), t]));
  
  const added = [];
  const removed = [];
  const modified = [];
  
  // Find added tasks
  for (const [title, task] of incomingByTitle) {
    if (!existingByTitle.has(title)) {
      added.push({ title: task.title, priority: task.priority });
    } else {
      // Check if modified
      const existingTask = existingByTitle.get(title);
      const changes = compareTaskDetails(existingTask, task);
      if (changes.length > 0) {
        modified.push({ title: task.title, changes });
      }
    }
  }
  
  // Find removed tasks
  for (const [title, task] of existingByTitle) {
    if (!incomingByTitle.has(title)) {
      removed.push({ title: task.title, priority: task.priority });
    }
  }
  
  return {
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
    existingCount: existing.length,
    incomingCount: incoming.length,
    added,
    removed,
    modified
  };
}

/**
 * Compare task details
 */
function compareTaskDetails(existing, incoming) {
  const changes = [];
  const fields = ['priority', 'assignedRole', 'deadline', 'description', 'evidenceRequired'];
  
  for (const field of fields) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];
    
    if (JSON.stringify(existingVal) !== JSON.stringify(incomingVal)) {
      changes.push({
        field,
        from: existingVal,
        to: incomingVal
      });
    }
  }
  
  return changes;
}

/**
 * Analyze deadline changes
 */
function analyzeDeadlineChanges(existingDeadlines, incomingDeadlines) {
  const existing = Array.isArray(existingDeadlines) ? existingDeadlines : [];
  const incoming = Array.isArray(incomingDeadlines) ? incomingDeadlines : [];
  
  if (existing.length === 0 && incoming.length === 0) {
    return { hasChanges: false };
  }
  
  const added = [];
  const removed = [];
  const modified = [];
  
  // Simple comparison by type/description
  const existingTypes = new Set(existing.map(d => normalizeText(d.type || d.description)));
  const incomingTypes = new Set(incoming.map(d => normalizeText(d.type || d.description)));
  
  for (const deadline of incoming) {
    const key = normalizeText(deadline.type || deadline.description);
    if (!existingTypes.has(key)) {
      added.push(deadline);
    }
  }
  
  for (const deadline of existing) {
    const key = normalizeText(deadline.type || deadline.description);
    if (!incomingTypes.has(key)) {
      removed.push(deadline);
    }
  }
  
  return {
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
    existingCount: existing.length,
    incomingCount: incoming.length,
    added,
    removed,
    modified
  };
}

/**
 * Analyze metadata changes
 */
function analyzeMetadataChanges(existing, incoming) {
  const changes = [];
  const metadataFields = [
    'effectiveDate', 'statute', 'category', 'topic', 'agencyName', 
    'riskScore', 'riskLevel', 'lovvLevel'
  ];
  
  for (const field of metadataFields) {
    const existingVal = existing?.[field];
    const incomingVal = incoming?.[field];
    
    if (existingVal !== incomingVal && (existingVal || incomingVal)) {
      changes.push({
        field,
        from: existingVal || '(not set)',
        to: incomingVal || '(not set)'
      });
    }
  }
  
  return {
    hasChanges: changes.length > 0,
    changes
  };
}

/**
 * Determine overall change type
 */
function determineChangeType(changes) {
  const types = changes.map(c => c.type);
  
  if (types.includes('content') && types.includes('tasks')) {
    return 'comprehensive';
  }
  if (types.includes('content')) {
    return 'content_update';
  }
  if (types.includes('tasks')) {
    return 'task_update';
  }
  if (types.includes('deadlines')) {
    return 'deadline_update';
  }
  if (types.includes('metadata')) {
    return 'metadata_update';
  }
  
  return 'minor';
}

/**
 * Determine change severity
 */
function determineChangeSeverity(changes) {
  let maxSeverity = 'low';
  
  for (const change of changes) {
    if (change.type === 'content' && change.details?.significance === 'high') {
      return 'critical';
    }
    if (change.type === 'tasks') {
      const taskDetails = change.details;
      if (taskDetails?.added?.some(t => t.priority === 'critical') ||
          taskDetails?.removed?.length > 3) {
        maxSeverity = 'high';
      } else if (taskDetails?.added?.length > 0 || taskDetails?.removed?.length > 0) {
        maxSeverity = maxSeverity === 'low' ? 'medium' : maxSeverity;
      }
    }
    if (change.type === 'deadlines' && change.details?.added?.length > 0) {
      maxSeverity = maxSeverity === 'low' ? 'medium' : maxSeverity;
    }
  }
  
  return maxSeverity;
}

/**
 * Generate human-readable change summary
 */
function generateChangeSummary(changes) {
  const parts = [];
  
  for (const change of changes) {
    switch (change.type) {
      case 'content':
        const textDetails = change.details;
        if (textDetails.lengthChange > 1000) {
          parts.push(`Significant text additions (${textDetails.lengthChange} characters added)`);
        } else if (textDetails.lengthChange < -1000) {
          parts.push(`Significant text removals (${Math.abs(textDetails.lengthChange)} characters removed)`);
        } else if (textDetails.keyPhrases?.length > 0) {
          parts.push(`Regulatory language changes detected (${textDetails.keyPhrases.length} key phrases modified)`);
        } else {
          parts.push('Minor text changes');
        }
        break;
        
      case 'tasks':
        const taskDetails = change.details;
        if (taskDetails.added?.length > 0) {
          parts.push(`${taskDetails.added.length} new compliance task(s) added`);
        }
        if (taskDetails.removed?.length > 0) {
          parts.push(`${taskDetails.removed.length} compliance task(s) removed`);
        }
        if (taskDetails.modified?.length > 0) {
          parts.push(`${taskDetails.modified.length} compliance task(s) modified`);
        }
        break;
        
      case 'deadlines':
        const deadlineDetails = change.details;
        if (deadlineDetails.added?.length > 0) {
          parts.push(`${deadlineDetails.added.length} new deadline(s) added`);
        }
        if (deadlineDetails.removed?.length > 0) {
          parts.push(`${deadlineDetails.removed.length} deadline(s) removed`);
        }
        break;
        
      case 'metadata':
        const metaDetails = change.details;
        if (metaDetails.changes?.length > 0) {
          const fieldNames = metaDetails.changes.map(c => c.field).join(', ');
          parts.push(`Metadata updated: ${fieldNames}`);
        }
        break;
    }
  }
  
  if (parts.length === 0) {
    return 'Minor changes detected.';
  }
  
  return parts.join('. ') + '.';
}

/**
 * Quick check if content has changed (hash-only comparison)
 */
export function quickHashCheck(existingHash, incomingContent) {
  const incomingHash = generateHash(incomingContent);
  return {
    hasChanges: existingHash !== incomingHash,
    existingHash,
    incomingHash
  };
}

// Named exports for direct import
export { generateHash };

export default { detectChanges, quickHashCheck, generateHash };
