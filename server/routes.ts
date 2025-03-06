import express, { type Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import passport from "passport";
import { z } from "zod";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from './vite';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // API routes
  app.get("/api/regulations/ids", async (req, res) => {
    try {
      console.log(`Regulation IDs endpoint accessed - Auth check starting`);
      
      // Check if user exists
      if (!req.user) {
        console.log(`Regulation IDs endpoint - Authentication required error`);
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Log the request for debugging
      console.log(`Fetching regulation IDs for user: ${req.user.username}`);
      
      try {
        const regulations = await storage.getRegulations();
        const ids = regulations.map(reg => reg.itemId);

        console.log(`Found ${ids.length} regulation IDs`);
        
        return res.json({ 
          count: ids.length,
          ids
        });
      } catch (dbError) {
        console.error("Database error fetching regulation IDs:", dbError);
        return res.status(500).json({ 
          error: "Database error fetching regulation IDs",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      console.error("Failed to fetch regulation IDs:", error);
      return res.status(500).json({ 
        error: "Failed to fetch regulation IDs", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // System endpoint for OpenAI API check
  app.get("/api/system/check-openai", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.log("OpenAI API key not configured");
        return res.status(500).json({
          status: "error",
          message: "OpenAI API key not configured",
          details: "API key is missing in environment variables"
        });
      }

      // Simple test call to OpenAI API
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        console.log("OpenAI API Status: ok");
        return res.status(200).json({
          status: "ok",
          message: "OpenAI API connection successful",
          details: "API key is valid and working properly"
        });
      } else {
        const errorData = await response.json();
        console.error("OpenAI API error:", errorData);
        return res.status(response.status).json({
          status: "error",
          message: "OpenAI API connection failed",
          details: errorData.error?.message || "Unknown API error"
        });
      }
    } catch (error) {
      console.error("OpenAI API check error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to check OpenAI API",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return httpServer;
}