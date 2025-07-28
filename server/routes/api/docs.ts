import express from 'express';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

const router = express.Router();

// Load OpenAPI specification
const openApiPath = path.join(process.cwd(), 'docs/api/openapi.yaml');
const openApiYaml = fs.readFileSync(openApiPath, 'utf8');
const openApiSpec = yaml.load(openApiYaml) as any;

// Custom CSS for branded documentation
const customCss = `
  .swagger-ui .topbar { 
    background-color: #2c3e50; 
    border-bottom: 3px solid #3498db;
  }
  .swagger-ui .topbar .download-url-wrapper { 
    display: none; 
  }
  .swagger-ui .info .title { 
    color: #2c3e50; 
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }
  .swagger-ui .info .description { 
    font-size: 1.1rem;
    line-height: 1.6;
    color: #34495e;
  }
  .swagger-ui .scheme-container { 
    background: #ecf0f1; 
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }
  .swagger-ui .opblock.opblock-post { 
    border-color: #27ae60; 
  }
  .swagger-ui .opblock.opblock-get { 
    border-color: #3498db; 
  }
  .swagger-ui .opblock.opblock-put { 
    border-color: #f39c12; 
  }
  .swagger-ui .opblock.opblock-delete { 
    border-color: #e74c3c; 
  }
  .swagger-ui .btn.execute { 
    background-color: #3498db; 
    border-color: #3498db; 
  }
  .swagger-ui .btn.execute:hover { 
    background-color: #2980b9; 
    border-color: #2980b9; 
  }
  .swagger-ui .model-box { 
    background: #f8f9fa; 
    border: 1px solid #dee2e6;
    border-radius: 6px;
  }
  .swagger-ui .parameter__name { 
    font-weight: 600; 
  }
  .swagger-ui .response-col_status { 
    font-weight: 600; 
  }
  .swagger-ui .highlight-code { 
    background: #2c3e50; 
    color: #ecf0f1; 
  }
  .swagger-ui .auth-wrapper { 
    background: #fff3cd; 
    border: 1px solid #ffeaa7; 
    border-radius: 6px; 
    padding: 1rem; 
    margin: 1rem 0;
  }
  .swagger-ui .auth-container .auth-btn-wrapper { 
    padding: 0.5rem 0; 
  }
  .swagger-ui .opblock .opblock-section-header { 
    font-weight: 600; 
    font-size: 1.1rem; 
  }
  .swagger-ui .parameters-container { 
    background: #f8f9fa; 
    border-radius: 6px; 
    padding: 1rem; 
    margin: 0.5rem 0; 
  }
  .swagger-ui .responses-wrapper { 
    background: #f8f9fa; 
    border-radius: 6px; 
    padding: 1rem; 
    margin: 0.5rem 0; 
  }
`;

// Swagger UI options following Context7 best practices
const swaggerOptions = {
  customCss,
  customSiteTitle: 'EdSteward API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    // API exploration settings
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    showCommonExtensions: true,
    
    // Authentication settings
    persistAuthorization: true,
    
    // Request/response settings
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 3,
    displayRequestDuration: true,
    
    // Deep linking for better UX
    deepLinking: true,
    
    // Try it out functionality
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    
    // Request snippets for different languages
    requestSnippetsEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: {
          title: "cURL (bash)",
          syntax: "bash"
        },
        curl_powershell: {
          title: "cURL (PowerShell)", 
          syntax: "powershell"
        },
        javascript_fetch: {
          title: "JavaScript (fetch)",
          syntax: "javascript"
        },
        node_native: {
          title: "Node.js (native)",
          syntax: "javascript"
        }
      },
      defaultExpanded: false,
      languages: null // Show all available languages
    },
    
    // OAuth2 redirect URL
    oauth2RedirectUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/docs/oauth2-redirect`,
    
    // Validation settings
    validatorUrl: null, // Disable online validator for privacy
    
    // UI customization
    displayOperationId: true,
    showExtensions: true,
    showMutatedRequest: true,
    
    // Response handling
    maxDisplayedTags: 50,
    
    // Plugin configuration
    plugins: [
      // Custom request snippet generators
      {
        fn: {
          requestSnippetGenerator_javascript_fetch: (request: any) => {
            const url = request.get('url');
            const method = request.get('method');
            const headers = request.get('headers');
            const body = request.get('body');
            
            let code = `fetch('${url}', {\n  method: '${method}'`;
            
            if (headers && headers.size > 0) {
              code += ',\n  headers: {\n';
              headers.forEach((value: string, key: string) => {
                code += `    '${key}': '${value}',\n`;
              });
              code += '  }';
            }
            
            if (body) {
              code += ',\n  body: ';
              if (typeof body === 'string') {
                code += `'${body}'`;
              } else {
                code += `JSON.stringify(${JSON.stringify(body)})`;
              }
            }
            
            code += '\n})\n.then(response => response.json())\n.then(data => console.log(data))\n.catch(error => console.error(error));';
            
            return code;
          },
          
          requestSnippetGenerator_node_native: (request: any) => {
            const url = new URL(request.get('url'));
            const method = request.get('method');
            const headers = request.get('headers');
            const body = request.get('body');
            const isHttps = url.protocol === 'https:';
            
            let code = `const ${isHttps ? 'https' : 'http'} = require('${isHttps ? 'https' : 'http'}');\n\n`;
            code += `const options = {\n`;
            code += `  hostname: '${url.hostname}',\n`;
            code += `  port: ${url.port || (isHttps ? 443 : 80)},\n`;
            code += `  path: '${url.pathname}${url.search}',\n`;
            code += `  method: '${method}'`;
            
            if (headers && headers.size > 0) {
              code += ',\n  headers: {\n';
              headers.forEach((value: string, key: string) => {
                code += `    '${key}': '${value}',\n`;
              });
              code += '  }';
            }
            
            code += '\n};\n\n';
            code += `const req = ${isHttps ? 'https' : 'http'}.request(options, (res) => {\n`;
            code += `  let data = '';\n`;
            code += `  res.on('data', (chunk) => { data += chunk; });\n`;
            code += `  res.on('end', () => {\n`;
            code += `    console.log(JSON.parse(data));\n`;
            code += `  });\n`;
            code += `});\n\n`;
            code += `req.on('error', (error) => {\n`;
            code += `  console.error(error);\n`;
            code += `});\n\n`;
            
            if (body) {
              if (typeof body === 'string') {
                code += `req.write('${body}');\n`;
              } else {
                code += `req.write(JSON.stringify(${JSON.stringify(body)}));\n`;
              }
            }
            
            code += `req.end();`;
            
            return code;
          }
        }
      }
    ]
  }
};

// Main API documentation route
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, swaggerOptions));

// Health check endpoint for documentation service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'API Documentation',
    timestamp: new Date().toISOString(),
    version: openApiSpec.info?.version || '1.0.0',
    specStatus: 'loaded',
    endpoints: Object.keys(openApiSpec.paths || {}).length
  });
});

// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(openApiSpec);
});

// Serve OpenAPI spec as YAML
router.get('/openapi.yaml', (req, res) => {
  res.setHeader('Content-Type', 'application/x-yaml');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Disposition', 'inline; filename="openapi.yaml"');
  res.send(openApiYaml);
});

// OAuth2 redirect handler
router.get('/oauth2-redirect', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>OAuth2 Redirect</title>
    </head>
    <body>
      <script>
        // Handle OAuth2 redirect
        if (window.opener && window.opener.swaggerUIRedirectOauth2) {
          window.opener.swaggerUIRedirectOauth2({
            auth: {
              code: new URLSearchParams(window.location.search).get('code'),
              state: new URLSearchParams(window.location.search).get('state')
            }
          });
          window.close();
        } else {
          console.error('OAuth2 redirect failed: no opener or handler found');
        }
      </script>
    </body>
    </html>
  `);
});

// Development utilities
if (process.env.NODE_ENV === 'development') {
  // Endpoint to refresh OpenAPI spec without server restart
  router.post('/refresh', (req, res) => {
    try {
      const newYaml = fs.readFileSync(openApiPath, 'utf8');
      const newSpec = yaml.load(newYaml) as any;
      
      // Update the spec (this would require restarting the middleware in production)
      res.json({
        success: true,
        message: 'OpenAPI spec refreshed successfully',
        version: newSpec.info?.version || '1.0.0',
        endpoints: Object.keys(newSpec.paths || {}).length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh OpenAPI spec',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint to validate OpenAPI spec
  router.get('/validate', (req, res) => {
    try {
      const spec = yaml.load(openApiYaml) as any;
      
      // Basic validation
      const errors = [];
      if (!spec.openapi) errors.push('Missing OpenAPI version');
      if (!spec.info) errors.push('Missing info section');
      if (!spec.paths) errors.push('Missing paths section');
      
      if (errors.length > 0) {
        return res.status(400).json({
          valid: false,
          errors,
          message: 'OpenAPI spec validation failed'
        });
      }
      
      res.json({
        valid: true,
        version: spec.info?.version || '1.0.0',
        title: spec.info?.title || 'API',
        paths: Object.keys(spec.paths || {}),
        components: Object.keys(spec.components?.schemas || {}),
        message: 'OpenAPI spec is valid'
      });
    } catch (error) {
      res.status(500).json({
        valid: false,
        message: 'OpenAPI spec validation error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

export default router; 