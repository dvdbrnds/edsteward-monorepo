/**
 * LLM Gateway Routes (Refactored)
 * Routes using the new service layer architecture
 */
import express from 'express';
import { setupLogger } from '../utils/logger.js';
import { createErrorResponse, ValidationError } from '../core/error-types.js';
import { 
  getComplianceService, 
  getRegulationRepository,
  getServiceHealth 
} from '../shared/container/service-registry.js';

const logger = setupLogger('llm-gateway-routes-refactored');
const router = express.Router();

// Middleware to inject services
router.use((req, res, next) => {
  try {
    logger.info('Injecting services into request...');
    
    const complianceService = getComplianceService();
    const regulationRepository = getRegulationRepository();
    
    logger.info('Services retrieved successfully');
    
    req.services = {
      compliance: complianceService,
      regulations: regulationRepository
    };
    
    logger.info('Services injected into request');
    next();
  } catch (error) {
    logger.error('Failed to inject services:', error.message);
    logger.error('Stack trace:', error.stack);
    res.status(500).json(createErrorResponse(error));
  }
});

// Service health endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await getServiceHealth();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(500).json(createErrorResponse(error));
  }
});

// Get all regulations
router.get('/regulations', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, search } = req.query;
    const offset = (page - 1) * limit;
    
    // Build filters
    const filters = {};
    if (category) filters.category = category;
    if (search) filters.keywords = search;
    
    // Get regulations with pagination
    const regulations = await req.services.regulations.findMany(filters, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy: 'name',
      sortOrder: 'asc'
    });
    
    // Get total count for pagination
    const total = await req.services.regulations.count(filters);
    
    res.json({
      regulations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      filters: { category, search }
    });
  } catch (error) {
    logger.error('Error fetching regulations:', error.message);
    res.status(500).json(createErrorResponse(error));
  }
});

// Get regulations by category
router.get('/regulations/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const regulations = await req.services.regulations.findByCategory(category);
    
    res.json({
      category,
      count: regulations.length,
      regulations
    });
  } catch (error) {
    logger.error('Error fetching regulations by category:', error.message);
    res.status(500).json(createErrorResponse(error));
  }
});

// Get regulation categories
router.get('/regulations/categories', async (req, res) => {
  try {
    const categories = await req.services.regulations.getCategories();
    const stats = await req.services.regulations.getStats();
    
    res.json({
      categories,
      categoryBreakdown: stats.categories,
      total: stats.total
    });
  } catch (error) {
    logger.error('Error fetching categories:', error.message);
    res.status(500).json(createErrorResponse(error));
  }
});

// Get single regulation by ID
router.get('/regulations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const regulation = await req.services.regulations.findById(parseInt(id));
    
    if (!regulation) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Regulation with ID ${id} not found`,
          code: 'NOT_FOUND'
        }
      });
    }
    
    res.json({ regulation });
  } catch (error) {
    logger.error('Error fetching regulation:', error.message);
    res.status(500).json(createErrorResponse(error));
  }
});

// Compliance query endpoint (main functionality)
router.post('/query', async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ValidationError('Query is required and must be a non-empty string');
    }

    if (query.length > 5000) {
      throw new ValidationError('Query too long (max 5000 characters)');
    }

    logger.info(`Processing compliance query: "${query.substring(0, 100)}..."`);
    
    // Add start time for performance tracking
    options.startTime = Date.now();
    
    // Check if this is a real LinearEngine execution request
    if (options.realExecution && options.regulation === 'reg-66') {
      logger.info('Real LinearEngine execution requested for REG-66');
      
      // Import and run the actual LinearEngine workflow
      const { Reg66LinearEngine } = await import('../../regulations/reg-66/Reg66LinearEngine.js');
      const linearEngine = new Reg66LinearEngine();
      
      try {
        // Run the real workflow
        const workflowResult = await linearEngine.runCompleteWorkflow();
        
        // Format the response to match expected structure
        const result = {
          query,
          response: {
            fullResponse: `LinearEngine Workflow Completed Successfully\n\nStep 1 Results: ${JSON.stringify(workflowResult.step1_result, null, 2)}\n\nValidation Decision: ${JSON.stringify(workflowResult.validation_decision, null, 2)}\n\nStep 2 Results: ${JSON.stringify(workflowResult.step2_result, null, 2)}\n\nFinal Status: ${JSON.stringify(workflowResult.final_status, null, 2)}`,
            confidence: workflowResult.final_status?.confidence || 0.85,
            keyPoints: [
              `Government Sources: ${workflowResult.step1_result?.sources_fetched || 'N/A'}`,
              `Differential Analysis: ${workflowResult.step1_result?.changes_detected || 'N/A'} changes detected`,
              `Validation Decision: ${workflowResult.validation_decision?.decision || 'N/A'}`,
              `University Libraries: ${workflowResult.step2_result?.sources_consulted?.length || 0} sources consulted`,
              `Final Compliance: ${workflowResult.final_status?.status || 'N/A'}`
            ],
            actionItems: workflowResult.final_status?.recommendations || []
          },
          relevantRegulations: ['REG-66'],
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - options.startTime,
          source: 'Real LinearEngine Workflow',
          workflowDetails: workflowResult
        };
        
        return result;
      } catch (error) {
        logger.error('LinearEngine workflow failed:', error);
        // Fall back to regular compliance service
      }
    }
    
    // Process the query using the compliance service (default behavior)
    const result = await req.services.compliance.processQuery(query, options);
    
    logger.info(`Query processed successfully in ${result.processingTime}ms`);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Error processing query: ${error.message}`);
    
    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(error));
    } else {
      res.status(500).json(createErrorResponse(error));
    }
  }
});

// Content validation endpoint
router.post('/validate', async (req, res) => {
  try {
    const { content, regulationIds = [], options = {} } = req.body;

    // Validate input
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Content is required and must be a non-empty string');
    }

    if (content.length > 50000) {
      throw new ValidationError('Content too long (max 50,000 characters)');
    }

    if (regulationIds && !Array.isArray(regulationIds)) {
      throw new ValidationError('regulationIds must be an array');
    }

    logger.info(`Validating content (${content.length} chars) against ${regulationIds.length || 'all'} regulations`);
    
    // Validate content using the compliance service
    const result = await req.services.compliance.validateContent(content, regulationIds);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Error validating content: ${error.message}`);
    
    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(error));
    } else {
      res.status(500).json(createErrorResponse(error));
    }
  }
});

// Change detection endpoint
router.post('/detect-changes', async (req, res) => {
  try {
    const { previousContent, currentContent, categories = [], options = {} } = req.body;

    // Validate input
    if (!previousContent || !currentContent) {
      throw new ValidationError('Both previousContent and currentContent are required');
    }

    if (typeof previousContent !== 'string' || typeof currentContent !== 'string') {
      throw new ValidationError('Content must be strings');
    }

    if (categories && !Array.isArray(categories)) {
      throw new ValidationError('categories must be an array');
    }

    logger.info(`Detecting changes between content versions across ${categories.length || 'all'} categories`);
    
    // Detect changes using the compliance service
    const result = await req.services.compliance.detectChanges(previousContent, currentContent, categories);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Error detecting changes: ${error.message}`);
    
    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(error));
    } else {
      res.status(500).json(createErrorResponse(error));
    }
  }
});

// Compliance summary endpoint
router.post('/summary', async (req, res) => {
  try {
    const { content, options = {} } = req.body;

    // Validate input
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Content is required and must be a non-empty string');
    }

    logger.info(`Generating compliance summary for content (${content.length} chars)`);
    
    // Generate summary using the compliance service
    const result = await req.services.compliance.getComplianceSummary(content);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error(`Error generating summary: ${error.message}`);
    
    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(error));
    } else {
      res.status(500).json(createErrorResponse(error));
    }
  }
});

// Regulation statistics endpoint
router.get('/stats', async (req, res) => {
  try {
    const stats = await req.services.regulations.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching statistics:', error.message);
    res.status(500).json(createErrorResponse(error));
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Unhandled route error:', error.message);
  res.status(500).json(createErrorResponse(error));
});

export default router; 