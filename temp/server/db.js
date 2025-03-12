"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isStaging = exports.isProduction = exports.isDevelopment = exports.db = exports.pool = void 0;
exports.initializeLogging = initializeLogging;
const serverless_1 = require("@neondatabase/serverless");
const neon_serverless_1 = require("drizzle-orm/neon-serverless");
const ws_1 = __importDefault(require("ws"));
const schema = __importStar(require("@shared/schema"));
const syslog_1 = require("./services/syslog");
serverless_1.neonConfig.webSocketConstructor = ws_1.default;
// Get the current environment
const currentEnv = process.env.NODE_ENV || 'development';
// Environment-specific database URLs
const dbUrls = {
    production: process.env.DATABASE_URL,
    staging: currentEnv === 'staging' ? process.env.DATABASE_URL : null,
    development: process.env.DATABASE_URL,
    test: currentEnv === 'test' ? process.env.DATABASE_URL : null
};
// Get the appropriate DATABASE_URL based on environment
const dbUrl = dbUrls[currentEnv];
if (!dbUrl) {
    throw new Error(`Database URL must be set for ${currentEnv} environment. Check environment variables.`);
}
// Create pool and db instances
exports.pool = new serverless_1.Pool({ connectionString: dbUrl });
exports.db = (0, neon_serverless_1.drizzle)({ client: exports.pool, schema });
// Export environment info for other modules
exports.isDevelopment = currentEnv === 'development';
exports.isProduction = currentEnv === 'production';
exports.isStaging = currentEnv === 'staging';
exports.isTest = currentEnv === 'test';
// Initialize logging after db setup
function initializeLogging() {
    console.log(`Database connected in ${currentEnv} environment`);
    if (currentEnv === 'production') {
        syslog_1.syslog.log(syslog_1.LogFacility.LOCAL0, syslog_1.LogLevel.WARNING, "Connecting to PRODUCTION database - ensure all operations are approved");
    }
    syslog_1.syslog.log(syslog_1.LogFacility.LOCAL0, syslog_1.LogLevel.INFO, `Database connection initialized for ${currentEnv} environment`);
}
