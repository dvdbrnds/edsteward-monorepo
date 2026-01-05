import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

}

export async function setupVite(app: Express, server: Server) {
  const viteConfig = (await import("../vite.config.ts")).default;
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Don't serve index.html for API routes - let them pass through to route handlers
    if (url.startsWith('/api/')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with cache-busting headers
  app.use(express.static(distPath, {
    setHeaders: (res, path) => {
      // Disable caching for HTML files to ensure tenant detection works
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        // Allow short caching for assets but with revalidation
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist, but EXCLUDE API routes
  app.get("*", (req, res, next) => {
    // Don't serve index.html for API routes - let them pass through to route handlers
    if (req.originalUrl.startsWith('/api/')) {
      return next();
    }
    
    // Server-side tenant detection for title injection
    // Use neutral default and let client-side handle detection
    // This avoids issues with ALB hostname detection
    let pageTitle = 'Loading...';
    
    
    // Read the HTML file and inject tenant-specific title
    const htmlPath = path.resolve(distPath, "index.html");
    fs.readFile(htmlPath, 'utf8', (err, html) => {
      if (err) {
        return res.status(500).send('Error loading page');
      }
      
      // Replace the title with tenant-specific title
      const modifiedHtml = html.replace(
        /<title[^>]*>.*?<\/title>/i,
        `<title>${pageTitle}</title>`
      );
      
      // Set no-cache headers
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html');
      
      res.send(modifiedHtml);
    });
  });
}
