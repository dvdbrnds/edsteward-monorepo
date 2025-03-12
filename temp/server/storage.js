"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_1 = require("@shared/schema");
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const db_2 = require("./db");
const PostgresSessionStore = (0, connect_pg_simple_1.default)(express_session_1.default);
const email_1 = require("./services/email");
class DatabaseStorage {
    constructor() {
        this.sessionStore = new PostgresSessionStore({
            pool: db_2.pool,
            createTableIfMissing: true,
        });
    }
    async getUser(id) {
        try {
            const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
            return user;
        }
        catch (error) {
            console.error("Error in getUser:", error);
            return undefined;
        }
    }
    async getUserByUsername(username) {
        try {
            console.log(`Looking up user with username: ${username}`);
            const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.username, username));
            console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
            return user;
        }
        catch (error) {
            console.error(`Error in getUserByUsername for ${username}:`, error);
            throw error;
        }
    }
    async createUser(insertUser) {
        const [user] = await db_1.db.insert(schema_1.users).values(insertUser).returning();
        return user;
    }
    async getAllUsers() {
        return await db_1.db.select().from(schema_1.users);
    }
    async updateUser(id, userData) {
        const [user] = await db_1.db
            .update(schema_1.users)
            .set(userData)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
            .returning();
        return user;
    }
    async deleteUser(id) {
        await db_1.db.delete(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
    }
    async getRegulations() {
        try {
            console.log("Fetching regulations from database...");
            // Add more detailed logging
            const result = await db_1.db
                .select()
                .from(schema_1.regulations)
                .orderBy((0, drizzle_orm_1.desc)(schema_1.regulations.lastUpdated));
            console.log(`Successfully fetched ${result.length} regulations from database`);
            return result;
        }
        catch (error) {
            console.error("Error in getRegulations:", error);
            // Return empty array instead of throwing to prevent frontend from getting stuck
            return [];
        }
    }
    async getRegulation(id) {
        const [regulation] = await db_1.db.select().from(schema_1.regulations).where((0, drizzle_orm_1.eq)(schema_1.regulations.id, id));
        return regulation;
    }
    async getRegulationById(regulationId) {
        try {
            console.log(`Looking up regulation with ID: ${regulationId}`);
            // First try to find by itemId (which is what the UI uses)
            const results = await db_1.db.select()
                .from(schema_1.regulations)
                .where((0, drizzle_orm_1.eq)(schema_1.regulations.itemId, regulationId));
            if (results.length > 0) {
                return results[0];
            }
            // Fallback to regular ID if itemId search fails
            const fallbackResults = await db_1.db.select()
                .from(schema_1.regulations)
                .where((0, drizzle_orm_1.eq)(schema_1.regulations.id, parseInt(regulationId, 10)));
            return fallbackResults.length > 0 ? fallbackResults[0] : null;
        }
        catch (error) {
            console.error(`Error fetching regulation with ID ${regulationId}:`, error);
            throw error;
        }
    }
    async createRegulation(regulation) {
        console.log("Creating new regulation:", regulation);
        const [newRegulation] = await db_1.db.insert(schema_1.regulations).values(regulation).returning();
        console.log("Created regulation:", newRegulation);
        return newRegulation;
    }
    async updateRegulation(id, regulation) {
        console.log(`Updating regulation ${id} with:`, regulation);
        const [updatedRegulation] = await db_1.db
            .update(schema_1.regulations)
            .set({
            ...regulation,
            lastUpdated: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.regulations.id, id))
            .returning();
        console.log("Updated regulation:", updatedRegulation);
        return updatedRegulation;
    }
    async setRegulationApplicability(id, isApplicable) {
        console.log(`Setting regulation ${id} applicability to: ${isApplicable}`);
        const [updatedRegulation] = await db_1.db
            .update(schema_1.regulations)
            .set({
            isApplicable,
            lastUpdated: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.regulations.id, id))
            .returning();
        console.log("Updated regulation:", updatedRegulation);
        return updatedRegulation;
    }
    async getRegulationsByJurisdiction(jurisdiction) {
        console.log(`Fetching regulations with jurisdiction: ${jurisdiction}`);
        const result = await db_1.db
            .select()
            .from(schema_1.regulations)
            .where((0, drizzle_orm_1.eq)(schema_1.regulations.jurisdiction, jurisdiction));
        console.log(`Found ${result.length} ${jurisdiction} regulations`);
        return result;
    }
    async searchRegulations(searchTerm) {
        try {
            console.log(`Searching for regulations with term: ${searchTerm}`);
            const results = await db_1.db.select()
                .from(schema_1.regulations)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.regulations.itemId, searchTerm), (0, drizzle_orm_1.like)(schema_1.regulations.name, `%${searchTerm}%`), (0, drizzle_orm_1.like)(schema_1.regulations.topic, `%${searchTerm}%`)));
            console.log(`Found ${results.length} matching regulations`);
            return results;
        }
        catch (error) {
            console.error("Error searching regulations:", error);
            return [];
        }
    }
    async deleteRegulation(id) {
        await db_1.db.delete(schema_1.regulations).where((0, drizzle_orm_1.eq)(schema_1.regulations.id, id));
    }
    async getNotificationsByUser(userId) {
        return await db_1.db
            .select()
            .from(schema_1.notifications)
            .where((0, drizzle_orm_1.eq)(schema_1.notifications.userId, userId));
    }
    async createNotification(notification) {
        const [newNotification] = await db_1.db
            .insert(schema_1.notifications)
            .values(notification)
            .returning();
        return newNotification;
    }
    async sendEmailNotification(userId, subject, message) {
        const user = await this.getUser(userId);
        if (!user)
            return false;
        const userNotifications = await this.getNotificationsByUser(userId);
        const emailEnabled = userNotifications.some(n => n.type === 'email' && n.enabled);
        if (!emailEnabled)
            return false;
        return email_1.emailService.sendEmail(user.email, subject, message);
    }
    async getDeadlines() {
        return await db_1.db.select().from(schema_1.deadlines);
    }
    async getAllIncompleteDeadlines() {
        return await db_1.db
            .select()
            .from(schema_1.deadlines)
            .where((0, drizzle_orm_1.eq)(schema_1.deadlines.status, "pending"));
    }
    async createDeadline(deadline) {
        const [newDeadline] = await db_1.db.insert(schema_1.deadlines).values(deadline).returning();
        return newDeadline;
    }
    async getGuides() {
        return await db_1.db.select().from(schema_1.guides);
    }
    async getGuidesByCategory(category) {
        return await db_1.db
            .select()
            .from(schema_1.guides)
            .where((0, drizzle_orm_1.eq)(schema_1.guides.category, category));
    }
    async getGuide(id) {
        const [guide] = await db_1.db.select().from(schema_1.guides).where((0, drizzle_orm_1.eq)(schema_1.guides.id, id));
        return guide;
    }
    async createGuide(guide) {
        const [newGuide] = await db_1.db.insert(schema_1.guides).values(guide).returning();
        return newGuide;
    }
    async updateGuide(id, guide) {
        const [updatedGuide] = await db_1.db
            .update(schema_1.guides)
            .set(guide)
            .where((0, drizzle_orm_1.eq)(schema_1.guides.id, id))
            .returning();
        return updatedGuide;
    }
    async hasAdmin() {
        const [adminUser] = await db_1.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.role, "admin"))
            .limit(1);
        return !!adminUser;
    }
    async getCsvSchemas() {
        return await db_1.db.select().from(schema_1.csvSchemas);
    }
    async getCsvSchema(id) {
        const [schema] = await db_1.db
            .select()
            .from(schema_1.csvSchemas)
            .where((0, drizzle_orm_1.eq)(schema_1.csvSchemas.id, id));
        return schema;
    }
    async createCsvSchema(schema) {
        const [newSchema] = await db_1.db
            .insert(schema_1.csvSchemas)
            .values(schema)
            .returning();
        return newSchema;
    }
    async getValidationRules(schemaId) {
        return await db_1.db
            .select()
            .from(schema_1.validationRules)
            .where((0, drizzle_orm_1.eq)(schema_1.validationRules.schemaId, schemaId));
    }
    async createValidationRule(rule) {
        const [newRule] = await db_1.db
            .insert(schema_1.validationRules)
            .values(rule)
            .returning();
        return newRule;
    }
    async createFieldMapping(mapping) {
        const [newMapping] = await db_1.db
            .insert(schema_1.fieldMappings)
            .values(mapping)
            .returning();
        return newMapping;
    }
    async getNotesByRegulation(regulationId) {
        return await db_1.db
            .select()
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.regulationId, regulationId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.notes.updatedAt));
    }
    async getNotesByUser(userId) {
        return await db_1.db
            .select()
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.notes.updatedAt));
    }
    async getNote(id) {
        const result = await db_1.db
            .select()
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.id, id))
            .then((res) => res[0]);
        return result || null;
    }
    async createNote(note) {
        const [newNote] = await db_1.db
            .insert(schema_1.notes)
            .values(note)
            .returning();
        return newNote;
    }
    async updateNote(id, noteData) {
        const [updatedNote] = await db_1.db
            .update(schema_1.notes)
            .set({
            ...noteData,
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.notes.id, id))
            .returning();
        return updatedNote;
    }
    async deleteNote(id) {
        await db_1.db.delete(schema_1.notes).where((0, drizzle_orm_1.eq)(schema_1.notes.id, id));
    }
    async getRegulationsByJurisdiction(jurisdiction) {
        console.log(`Fetching regulations with jurisdiction: ${jurisdiction}`);
        const result = await db_1.db
            .select()
            .from(schema_1.regulations)
            .where((0, drizzle_orm_1.eq)(schema_1.regulations.jurisdiction, jurisdiction));
        console.log(`Found ${result.length} ${jurisdiction} regulations`);
        return result;
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
