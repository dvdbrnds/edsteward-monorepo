#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { glob } from 'glob';

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  summary?: string;
  parameters?: any[];
  responses?: any;
  tags?: string[];
  security?: any[];
}

/**
 * Extract JSDoc comments from route files
 */
function extractJSDocFromFile(filePath: string): RouteInfo[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes: RouteInfo[] = [];
  
  // Regex to match JSDoc comments followed by router methods
  const jsdocRouteRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  
  let match;
  while ((match = jsdocRouteRegex.exec(content)) !== null) {
    const [, jsdocContent, method, routePath] = match;
    
    // Parse JSDoc content
    const description = extractJSDocTag(jsdocContent, 'description') || 
                       extractJSDocTag(jsdocContent, 'summary') || 
                       extractFirstLine(jsdocContent);
    
    const summary = extractJSDocTag(jsdocContent, 'summary') || 
                   extractFirstLine(jsdocContent);
    
    const tags = extractJSDocTags(jsdocContent, 'tags');
    const parameters = extractJSDocParameters(jsdocContent);
    const responses = extractJSDocResponses(jsdocContent);
    const security = extractJSDocSecurity(jsdocContent);
    
    routes.push({
      method: method.toUpperCase(),
      path: routePath,
      description,
      summary,
      parameters,
      responses,
      tags,
      security
    });
  }
  
  return routes;
}

/**
 * Extract a specific JSDoc tag value
 */
function extractJSDocTag(content: string, tag: string): string | null {
  const regex = new RegExp(`@${tag}\\s+(.+?)(?=\\n|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract multiple JSDoc tag values
 */
function extractJSDocTags(content: string, tag: string): string[] {
  const regex = new RegExp(`@${tag}\\s+(.+?)(?=\\n|$)`, 'gi');
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Extract the first meaningful line from JSDoc content
 */
function extractFirstLine(content: string): string {
  const lines = content.split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim())
    .filter(line => line.length > 0);
  
  return lines[0] || '';
}

/**
 * Extract parameter information from JSDoc
 */
function extractJSDocParameters(content: string): any[] {
  const parameters: any[] = [];
  const paramRegex = /@param\s+\{([^}]+)\}\s+(\w+)\s*-?\s*(.+?)(?=\n|$)/g;
  
  let match;
  while ((match = paramRegex.exec(content)) !== null) {
    const [, type, name, description] = match;
    parameters.push({
      name,
      in: 'query', // Default to query, could be enhanced
      description: description.trim(),
      schema: {
        type: mapJSDocTypeToOpenAPI(type)
      }
    });
  }
  
  return parameters;
}

/**
 * Extract response information from JSDoc
 */
function extractJSDocResponses(content: string): any {
  const responses: any = {};
  const responseRegex = /@returns?\s+\{([^}]+)\}\s*(.+?)(?=\n|$)/g;
  
  let match;
  while ((match = responseRegex.exec(content)) !== null) {
    const [, type, description] = match;
    responses['200'] = {
      description: description.trim(),
      content: {
        'application/json': {
          schema: {
            type: mapJSDocTypeToOpenAPI(type)
          }
        }
      }
    };
  }
  
  return Object.keys(responses).length > 0 ? responses : undefined;
}

/**
 * Extract security information from JSDoc
 */
function extractJSDocSecurity(content: string): any[] | undefined {
  const security: any[] = [];
  const securityRegex = /@security\s+(\w+)/g;
  
  let match;
  while ((match = securityRegex.exec(content)) !== null) {
    const [, scheme] = match;
    security.push({ [scheme]: [] });
  }
  
  return security.length > 0 ? security : undefined;
}

/**
 * Map JSDoc types to OpenAPI types
 */
function mapJSDocTypeToOpenAPI(jsdocType: string): string {
  const typeMap: { [key: string]: string } = {
    'string': 'string',
    'number': 'number',
    'integer': 'integer',
    'boolean': 'boolean',
    'array': 'array',
    'object': 'object',
    'Object': 'object',
    'Array': 'array',
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean'
  };
  
  return typeMap[jsdocType] || 'string';
}

/**
 * Convert route path to OpenAPI path format
 */
function convertRoutePathToOpenAPI(routePath: string): string {
  // Convert Express route parameters to OpenAPI format
  // e.g., /users/:id -> /users/{id}
  return routePath.replace(/:(\w+)/g, '{$1}');
}

/**
 * Merge extracted routes with existing OpenAPI spec
 */
function mergeRoutesWithOpenAPI(routes: RouteInfo[], openApiSpec: any): any {
  const updatedSpec = { ...openApiSpec };
  
  if (!updatedSpec.paths) {
    updatedSpec.paths = {};
  }
  
  for (const route of routes) {
    const openApiPath = convertRoutePathToOpenAPI(route.path);
    
    if (!updatedSpec.paths[openApiPath]) {
      updatedSpec.paths[openApiPath] = {};
    }
    
    const operation: any = {
      summary: route.summary || route.description,
      description: route.description,
      tags: route.tags || ['API'],
      operationId: `${route.method.toLowerCase()}${openApiPath.replace(/[^a-zA-Z0-9]/g, '')}`
    };
    
    if (route.parameters && route.parameters.length > 0) {
      operation.parameters = route.parameters;
    }
    
    if (route.responses) {
      operation.responses = route.responses;
    } else {
      operation.responses = {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        }
      };
    }
    
    if (route.security) {
      operation.security = route.security;
    }
    
    updatedSpec.paths[openApiPath][route.method.toLowerCase()] = operation;
  }
  
  return updatedSpec;
}

/**
 * Main function to generate API documentation
 */
async function generateApiDocs(): Promise<void> {
  console.log('🔍 Scanning route files for JSDoc comments...');
  
  // Find all route files
  const routeFiles = await glob('server/routes/**/*.ts', { 
    ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'] 
  });
  
  console.log(`📁 Found ${routeFiles.length} route files`);
  
  // Extract routes from all files
  const allRoutes: RouteInfo[] = [];
  for (const file of routeFiles) {
    try {
      const routes = extractJSDocFromFile(file);
      if (routes.length > 0) {
        console.log(`📄 ${file}: ${routes.length} documented routes`);
        allRoutes.push(...routes);
      }
    } catch (error) {
      console.warn(`⚠️ Warning: Could not process ${file}: ${error}`);
    }
  }
  
  console.log(`📋 Total extracted routes: ${allRoutes.length}`);
  
  // Load existing OpenAPI spec
  const openApiPath = path.join(process.cwd(), 'docs/api/openapi.yaml');
  let openApiSpec: any = {};
  
  if (fs.existsSync(openApiPath)) {
    try {
      const openApiYaml = fs.readFileSync(openApiPath, 'utf8');
      openApiSpec = yaml.load(openApiYaml) as any;
      console.log('📖 Loaded existing OpenAPI specification');
    } catch (error) {
      console.warn('⚠️ Warning: Could not load existing OpenAPI spec, creating new one');
      openApiSpec = {
        openapi: '3.0.0',
        info: {
          title: 'EdSteward API',
          version: '1.0.0',
          description: 'Auto-generated API documentation'
        },
        paths: {}
      };
    }
  }
  
  // Merge routes with OpenAPI spec
  const updatedSpec = mergeRoutesWithOpenAPI(allRoutes, openApiSpec);
  
  // Ensure docs directory exists
  const docsDir = path.dirname(openApiPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Write updated spec
  const updatedYaml = yaml.dump(updatedSpec, { 
    indent: 2, 
    lineWidth: 120, 
    noRefs: true 
  });
  
  fs.writeFileSync(openApiPath, updatedYaml);
  console.log(`✅ Updated OpenAPI specification written to ${openApiPath}`);
  
  // Generate summary report
  const pathCount = Object.keys(updatedSpec.paths || {}).length;
  const operationCount = Object.values(updatedSpec.paths || {})
    .reduce((count: number, pathItem: any) => {
      return count + Object.keys(pathItem).filter(key => 
        ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(key)
      ).length;
    }, 0);
  
  console.log(`
📊 Documentation Summary:
   • ${pathCount} API paths
   • ${operationCount} operations
   • ${allRoutes.length} auto-documented routes
   • Available at: /api/docs

💡 To add more documentation, use JSDoc comments above route definitions:
   /**
    * Get user profile
    * @summary Retrieve user information
    * @tags Users
    * @param {string} id - User ID
    * @returns {object} User profile data
    * @security sessionAuth
    */
   router.get('/users/:id', ...)
`);
}

// Run the script
if (require.main === module) {
  generateApiDocs().catch(console.error);
}

export { generateApiDocs }; 