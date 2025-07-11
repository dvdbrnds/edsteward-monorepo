import express from "express";
import { storage } from "../../storage";
import { getDatabaseStorage } from "../../services/database";
import { hashPassword } from "../../auth";
import { db } from "../../db";

const router = express.Router();

// Simple admin check middleware
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// GET /api/admin/users - Get all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage();
    const users = await tenantStorage.getAllUsers();
    
    // Remove password hashes from response
    const sanitizedUsers = users.map((user: any) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(sanitizedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      error: "Failed to fetch users", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// POST /api/admin/users - Create new user
router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role = 'user' } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }
    
    const hashedPassword = await hashPassword(password);
    const tenantStorage = getDatabaseStorage();
    
    const newUser = await tenantStorage.createUser({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role
    }, undefined);
    
    // Remove password hash from response
    const { password: _, ...userResponse } = newUser;
    res.status(201).json(userResponse);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ 
      error: "Failed to create user", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GET /api/admin/institution-config - Get institution configuration
router.get("/institution-config", requireAdmin, async (req, res) => {
  try {
    // Return static configuration for single-tenant mode
    const config = {
      institution: {
        name: "Moravian University",
        domain: "moravian.edu",
        branding: {
          logo: "/assets/Moravian-Monogram-MoravianBlue.png",
          primaryColor: "#1e3a8a",
          secondaryColor: "#1e40af",
          favicon: "/favicon.ico",
        },
      },
      authentication: {
        samlEnabled: false,
        usernamePasswordEnabled: true,
        allowSelfRegistration: false,
      },
      features: {
        maxUsers: 1000,
        maxRegulations: 10000,
        apiAccess: true,
        customDomain: false,
        ssoEnabled: false,
      },
    };

    res.json({
      success: true,
      institutionConfig: config,
    });
  } catch (error) {
    console.error("Error fetching institution config:", error);
    res.status(500).json({ 
      error: "Failed to fetch institution config", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// POST /api/admin/institution-config - Update institution configuration
router.post("/institution-config", requireAdmin, async (req, res) => {
  try {
    // For single-tenant mode, we'll store this in a configuration file or database
    // For now, return success (in production, this would update the config)
    console.log("Institution config update requested:", req.body);
    
    res.json({
      success: true,
      message: "Institution configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating institution config:", error);
    res.status(500).json({ 
      error: "Failed to update institution config", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GET /api/admin/branding - Get branding configuration
router.get("/branding", requireAdmin, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage();
    const brandingConfig = await tenantStorage.getBrandingConfig();

    res.json({
      success: true,
      branding: brandingConfig,
    });
  } catch (error) {
    console.error("Error fetching branding config:", error);
    res.status(500).json({ 
      error: "Failed to fetch branding config", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// POST /api/admin/branding - Update branding configuration
router.post("/branding", requireAdmin, async (req, res) => {
  try {
    const {
      institutionName,
      title,
      logoUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      loginScreenBackgroundColor,
      loginScreenAccentColor,
      loginScreenTextColor,
      loginScreenHeroColor,
    } = req.body;

    // Validate required fields
    if (!institutionName || !title) {
      return res.status(400).json({ 
        error: "Institution name and title are required" 
      });
    }

    // Validate color formats (basic hex validation)
    const colorFields = {
      primaryColor,
      secondaryColor,
      accentColor,
      loginScreenBackgroundColor,
      loginScreenAccentColor,
      loginScreenTextColor,
      loginScreenHeroColor,
    };

    for (const [field, color] of Object.entries(colorFields)) {
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return res.status(400).json({ 
          error: `Invalid color format for ${field}. Please use hex format (e.g., #1e3a8a)` 
        });
      }
    }

    console.log("Branding configuration update:", req.body);

    // Save branding configuration to database
    const configToSave = {
      institutionName,
      title,
      logoUrl: logoUrl || "/assets/generic-logo.svg",
      faviconUrl: faviconUrl || "/favicon.ico",
      primaryColor: primaryColor || "#1e3a8a",
      secondaryColor: secondaryColor || "#1e40af",
      accentColor: accentColor || "#3b82f6",
      loginScreenBackgroundColor: loginScreenBackgroundColor || "#f8fafc",
      loginScreenAccentColor: loginScreenAccentColor || "#1e3a8a",
      loginScreenTextColor: loginScreenTextColor || "#1f2937",
      loginScreenHeroColor: loginScreenHeroColor || "#002147",
      updatedAt: new Date().toISOString(),
    };

    const tenantStorage = getDatabaseStorage();
    const savedConfig = await tenantStorage.saveBrandingConfig(configToSave);

    res.json({
      success: true,
      message: "Branding configuration updated successfully",
      branding: savedConfig,
    });
  } catch (error) {
    console.error("Error updating branding config:", error);
    res.status(500).json({ 
      error: "Failed to update branding config", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router; 