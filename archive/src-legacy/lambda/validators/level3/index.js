const {
  ValidationStatus,
  SeverityLevel
} = require('../../../common/mcp/protocol');

/**
 * Level 3 (Structural) Validator Lambda Handler
 * Performs complex structural and relationship validation
 */
exports.handler = async (event) => {
  try {
    const { request, configuration } = event;
    const {
      structuralMatchThreshold = 0.90,
      useCache = true,
      maxDepth = 10,
      validateRelationships = true
    } = configuration;

    // Initialize validation result
    const validationResult = {
      status: ValidationStatus.PASS,
      confidence: 1.0,
      findings: []
    };

    // Get structural requirements
    const requirements = await getStructuralRequirements(request.regulation);

    // Build structural graph
    const structureGraph = buildStructureGraph(request.data, maxDepth);

    // Validate each structural requirement
    for (const requirement of requirements) {
      const structuralResult = await validateStructuralRequirement(
        requirement,
        structureGraph,
        {
          threshold: structuralMatchThreshold,
          validateRelationships
        }
      );

      if (!structuralResult.matches) {
        validationResult.findings.push({
          id: `L3-${requirement.id}`,
          path: structuralResult.path || 'data',
          severity: SeverityLevel.ERROR,
          message: `Structural validation failed: ${requirement.description}`,
          reference: requirement.reference,
          confidence: structuralResult.confidence,
          details: structuralResult.details
        });
      }

      // Update overall confidence
      validationResult.confidence = Math.min(
        validationResult.confidence,
        structuralResult.confidence
      );
    }

    // Set final status based on findings
    if (validationResult.findings.length > 0) {
      validationResult.status = ValidationStatus.FAIL;
    }

    return validationResult;
  } catch (error) {
    console.error('Error in Level 3 Validator:', error);
    throw new Error(`Level 3 Validation Error: ${error.message}`);
  }
};

/**
 * Retrieves structural requirements from the database or cache
 * @param {Object} regulation - Regulation metadata
 * @returns {Array} List of structural requirements
 */
async function getStructuralRequirements(regulation) {
  // TODO: Implement actual database/cache lookup
  // For now, return mock requirements
  return [
    {
      id: 'STR001',
      type: 'hierarchy',
      expectedStructure: {
        type: 'object',
        required: ['metadata', 'content'],
        properties: {
          metadata: {
            type: 'object',
            required: ['version', 'status']
          },
          content: {
            type: 'array',
            minItems: 1
          }
        }
      },
      reference: 'Section 3.1',
      description: 'Document structure requirements'
    },
    {
      id: 'STR002',
      type: 'relationship',
      expectedRelations: [
        {
          from: 'metadata.version',
          to: 'content',
          type: 'version_compatibility'
        }
      ],
      reference: 'Section 3.2',
      description: 'Version compatibility requirements'
    },
    {
      id: 'STR003',
      type: 'dependency',
      expectedDependencies: [
        {
          if: 'metadata.status',
          equals: 'draft',
          requires: ['metadata.reviewedBy', 'metadata.reviewDate']
        }
      ],
      reference: 'Section 3.3',
      description: 'Status-dependent field requirements'
    }
  ];
}

/**
 * Builds a graph representation of the data structure
 * @param {Object} data - Input data
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Object} Structure graph
 */
function buildStructureGraph(data, maxDepth) {
  const graph = {
    nodes: new Map(),
    edges: new Set(),
    metadata: {
      depth: 0,
      leafCount: 0,
      branchingFactor: 0
    }
  };

  function addNode(path, value, depth = 0) {
    const nodeId = path || 'root';
    const nodeType = Array.isArray(value) ? 'array' : typeof value;
    
    graph.nodes.set(nodeId, {
      type: nodeType,
      value: nodeType === 'object' || nodeType === 'array' ? null : value,
      depth,
      children: []
    });

    return nodeId;
  }

  function addEdge(from, to, type = 'contains') {
    graph.edges.add({
      from,
      to,
      type
    });
  }

  function traverse(obj, path = '', depth = 0) {
    if (depth > maxDepth) return;

    const nodeId = addNode(path, obj, depth);
    graph.metadata.depth = Math.max(graph.metadata.depth, depth);

    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj);
      graph.metadata.branchingFactor = Math.max(
        graph.metadata.branchingFactor,
        entries.length
      );

      for (const [key, value] of entries) {
        const childPath = path ? `${path}.${key}` : key;
        const childId = traverse(value, childPath, depth + 1);
        
        if (childId) {
          graph.nodes.get(nodeId).children.push(childId);
          addEdge(nodeId, childId);
        }
      }
    } else {
      graph.metadata.leafCount++;
    }

    return nodeId;
  }

  traverse(data);
  return graph;
}

/**
 * Validates a single structural requirement
 * @param {Object} requirement - Structural requirement definition
 * @param {Object} graph - Structure graph
 * @param {Object} options - Validation options
 * @returns {Object} Structural validation result
 */
async function validateStructuralRequirement(requirement, graph, options) {
  const result = {
    matches: false,
    confidence: 0,
    path: null,
    details: {}
  };

  try {
    switch (requirement.type) {
      case 'hierarchy':
        result.details = validateHierarchy(
          requirement.expectedStructure,
          graph
        );
        break;
      
      case 'relationship':
        result.details = validateRelationships(
          requirement.expectedRelations,
          graph,
          options.validateRelationships
        );
        break;
      
      case 'dependency':
        result.details = validateDependencies(
          requirement.expectedDependencies,
          graph
        );
        break;
      
      default:
        throw new Error(`Unknown requirement type: ${requirement.type}`);
    }

    result.confidence = result.details.confidence;
    result.matches = result.confidence >= options.threshold;
    result.path = result.details.violationPath;
  } catch (error) {
    console.warn(`Error in structural validation for ${requirement.id}:`, error);
    result.confidence = 0;
    result.matches = false;
    result.details.error = error.message;
  }

  return result;
}

/**
 * Validates hierarchical structure against expected schema
 * @param {Object} expectedStructure - Expected structure schema
 * @param {Object} graph - Structure graph
 * @returns {Object} Validation details
 */
function validateHierarchy(expectedStructure, graph) {
  const result = {
    confidence: 1.0,
    violations: [],
    violationPath: null
  };

  function validateNode(schema, nodeId) {
    const node = graph.nodes.get(nodeId);
    if (!node) return false;

    // Check type
    if (schema.type !== node.type) {
      result.violations.push({
        path: nodeId,
        expected: schema.type,
        actual: node.type
      });
      return false;
    }

    // Check array requirements
    if (schema.type === 'array' && schema.minItems) {
      if (node.children.length < schema.minItems) {
        result.violations.push({
          path: nodeId,
          message: `Array must have at least ${schema.minItems} items`
        });
        return false;
      }
    }

    // Check object requirements
    if (schema.type === 'object' && schema.required) {
      const childPaths = new Set(node.children.map(child => 
        child.split('.').pop()
      ));

      for (const requiredProp of schema.required) {
        if (!childPaths.has(requiredProp)) {
          result.violations.push({
            path: nodeId,
            message: `Missing required property: ${requiredProp}`
          });
          return false;
        }
      }
    }

    // Recurse into properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        const childId = node.children.find(child => 
          child.split('.').pop() === prop
        );
        if (childId && !validateNode(propSchema, childId)) {
          return false;
        }
      }
    }

    return true;
  }

  const isValid = validateNode(expectedStructure, 'root');
  result.confidence = isValid ? 1.0 : 0.0;
  
  if (result.violations.length > 0) {
    result.violationPath = result.violations[0].path;
  }

  return result;
}

/**
 * Validates relationships between nodes
 * @param {Array} expectedRelations - Expected relationships
 * @param {Object} graph - Structure graph
 * @param {boolean} validateRelationships - Whether to validate relationships
 * @returns {Object} Validation details
 */
function validateRelationships(expectedRelations, graph, validateRelationships) {
  const result = {
    confidence: 1.0,
    violations: [],
    violationPath: null
  };

  if (!validateRelationships) {
    return result;
  }

  for (const relation of expectedRelations) {
    const fromNode = graph.nodes.get(relation.from);
    const toNode = graph.nodes.get(relation.to);

    if (!fromNode || !toNode) {
      result.violations.push({
        path: relation.from,
        message: `Missing relationship nodes: ${relation.from} -> ${relation.to}`
      });
      continue;
    }

    // Check if relationship exists
    const hasRelation = Array.from(graph.edges).some(edge =>
      edge.from === relation.from &&
      edge.to === relation.to &&
      edge.type === relation.type
    );

    if (!hasRelation) {
      result.violations.push({
        path: relation.from,
        message: `Missing relationship: ${relation.type}`
      });
    }
  }

  result.confidence = result.violations.length === 0 ? 1.0 : 0.0;
  
  if (result.violations.length > 0) {
    result.violationPath = result.violations[0].path;
  }

  return result;
}

/**
 * Validates conditional dependencies between fields
 * @param {Array} expectedDependencies - Expected dependencies
 * @param {Object} graph - Structure graph
 * @returns {Object} Validation details
 */
function validateDependencies(expectedDependencies, graph) {
  const result = {
    confidence: 1.0,
    violations: [],
    violationPath: null
  };

  for (const dependency of expectedDependencies) {
    const conditionNode = graph.nodes.get(dependency.if);
    if (!conditionNode) continue;

    if (conditionNode.value === dependency.equals) {
      // Check required fields
      for (const requiredField of dependency.requires) {
        const requiredNode = graph.nodes.get(requiredField);
        
        if (!requiredNode) {
          result.violations.push({
            path: dependency.if,
            message: `Missing dependent field: ${requiredField}`
          });
        }
      }
    }
  }

  result.confidence = result.violations.length === 0 ? 1.0 : 0.0;
  
  if (result.violations.length > 0) {
    result.violationPath = result.violations[0].path;
  }

  return result;
} 