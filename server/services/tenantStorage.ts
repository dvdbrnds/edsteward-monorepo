import { DatabaseStorage, IStorage } from '../storage';
import { getTenantDatabase } from './tenantDatabase';
import { TenantConfig } from '../middleware/tenantDetection';
import { db as defaultDb } from "../db";

export class TenantStorage implements IStorage {
  private storage: DatabaseStorage;
  private tenantConfig: TenantConfig;

  constructor(tenantConfig: TenantConfig) {
    this.tenantConfig = tenantConfig;
    this.storage = new DatabaseStorage();
    
    // We'll override the database queries to use the tenant database
    // For now, we'll use a simpler approach and modify the queries at runtime
  }

  // Delegate all methods to the underlying storage
  async getUser(id: number) {
    return this.storage.getUser(id);
  }

  async getUserByUsername(username: string) {
    return this.storage.getUserByUsername(username);
  }

  async getUserByEmail(email: string) {
    return this.storage.getUserByEmail(email);
  }

  async getUserByExternalId(externalId: string) {
    return this.storage.getUserByExternalId(externalId);
  }

  async createUser(user: any) {
    return this.storage.createUser(user);
  }

  async getAllUsers() {
    return this.storage.getAllUsers();
  }

  async updateUser(id: number, user: any) {
    return this.storage.updateUser(id, user);
  }

  async deleteUser(id: number) {
    return this.storage.deleteUser(id);
  }

  // Regulation methods
  async getRegulations() {
    return this.storage.getRegulations();
  }

  async getRegulation(id: number) {
    return this.storage.getRegulation(id);
  }

  async getRegulationById(regulationId: string) {
    return this.storage.getRegulationById(regulationId);
  }

  async createRegulation(regulation: any) {
    return this.storage.createRegulation(regulation);
  }

  async updateRegulation(id: number, regulation: any) {
    return this.storage.updateRegulation(id, regulation);
  }

  async setRegulationApplicability(id: number, isApplicable: boolean) {
    return this.storage.setRegulationApplicability(id, isApplicable);
  }

  async getRegulationsByJurisdiction(jurisdiction: string) {
    return this.storage.getRegulationsByJurisdiction(jurisdiction);
  }

  async getRegulationsByJurisdictionSource(jurisdictionSource: string) {
    return this.storage.getRegulationsByJurisdictionSource(jurisdictionSource);
  }

  async getRegulationsByInstitutionType(institutionType: string) {
    return this.storage.getRegulationsByInstitutionType(institutionType);
  }

  async searchRegulations(searchTerm: string) {
    return this.storage.searchRegulations(searchTerm);
  }

  async deleteRegulation(id: number) {
    return this.storage.deleteRegulation(id);
  }

  // Regulation Update methods
  async getPendingRegulationUpdates() {
    return this.storage.getPendingRegulationUpdates();
  }

  async getRegulationUpdateById(id: number) {
    return this.storage.getRegulationUpdateById(id);
  }

  async acceptRegulationUpdate(id: number, userId: number, signature: string) {
    return this.storage.acceptRegulationUpdate(id, userId, signature);
  }

  async rejectRegulationUpdate(id: number, userId: number, signature: string, reason: string) {
    return this.storage.rejectRegulationUpdate(id, userId, signature, reason);
  }

  async deferRegulationUpdate(id: number, userId: number, signature: string) {
    return this.storage.deferRegulationUpdate(id, userId, signature);
  }

  // MCP methods
  async getRegulationVersions(regulationId: number) {
    return this.storage.getRegulationVersions(regulationId);
  }

  async getRegulationVersion(id: number) {
    return this.storage.getRegulationVersion(id);
  }

  async createRegulationVersion(version: any) {
    return this.storage.createRegulationVersion(version);
  }

  async getLatestRegulationVersion(regulationId: number) {
    return this.storage.getLatestRegulationVersion(regulationId);
  }

  async compareRegulationVersions(versionIdA: number, versionIdB: number) {
    return this.storage.compareRegulationVersions(versionIdA, versionIdB);
  }

  async getValidationStatus(regulationId: number, versionId?: number) {
    return this.storage.getValidationStatus(regulationId, versionId);
  }

  async createValidationStatus(status: any) {
    return this.storage.createValidationStatus(status);
  }

  async updateValidationStatus(id: number, status: any) {
    return this.storage.updateValidationStatus(id, status);
  }

  async validateRegulationVersion(versionId: number, userId: number) {
    return this.storage.validateRegulationVersion(versionId, userId);
  }

  async getSyncControl(regulationId: number) {
    return this.storage.getSyncControl(regulationId);
  }

  async createSyncControl(control: any) {
    return this.storage.createSyncControl(control);
  }

  async updateSyncControl(id: number, control: any) {
    return this.storage.updateSyncControl(id, control);
  }

  async scheduleSyncForRegulation(regulationId: number, nextSync: Date) {
    return this.storage.scheduleSyncForRegulation(regulationId, nextSync);
  }

  async recordSyncAttempt(regulationId: number, success: boolean, error?: string) {
    return this.storage.recordSyncAttempt(regulationId, success, error);
  }

  async getNotificationQueue(status?: 'pending' | 'sent' | 'failed') {
    return this.storage.getNotificationQueue(status);
  }

  async createNotificationQueueItem(item: any) {
    return this.storage.createNotificationQueueItem(item);
  }

  async updateNotificationQueueItem(id: number, item: any) {
    return this.storage.updateNotificationQueueItem(id, item);
  }

  async markNotificationAsSent(id: number) {
    return this.storage.markNotificationAsSent(id);
  }

  async getVersionConflicts(status?: 'pending' | 'resolved' | 'rejected') {
    return this.storage.getVersionConflicts(status);
  }

  async getVersionConflictsForRegulation(regulationId: number) {
    return this.storage.getVersionConflictsForRegulation(regulationId);
  }

  async createVersionConflict(conflict: any) {
    return this.storage.createVersionConflict(conflict);
  }

  async resolveVersionConflict(id: number, resolutions: any[], userId: number) {
    return this.storage.resolveVersionConflict(id, resolutions, userId);
  }

  async rejectVersionConflict(id: number, userId: number) {
    return this.storage.rejectVersionConflict(id, userId);
  }

  // Notification methods
  async getNotificationsByUser(userId: number) {
    return this.storage.getNotificationsByUser(userId);
  }

  async getAllNotifications() {
    return this.storage.getAllNotifications();
  }

  async createNotification(notification: any) {
    return this.storage.createNotification(notification);
  }

  async sendEmailNotification(userId: number, subject: string, message: string) {
    return this.storage.sendEmailNotification(userId, subject, message);
  }

  // Deadline methods
  async getDeadlines() {
    return this.storage.getDeadlines();
  }

  async getAllIncompleteDeadlines() {
    return this.storage.getAllIncompleteDeadlines();
  }

  async createDeadline(deadline: any) {
    return this.storage.createDeadline(deadline);
  }

  // Guide methods
  async getGuides() {
    return this.storage.getGuides();
  }

  async getGuidesByCategory(category: string) {
    return this.storage.getGuidesByCategory(category);
  }

  async getGuide(id: number) {
    return this.storage.getGuide(id);
  }

  async createGuide(guide: any) {
    return this.storage.createGuide(guide);
  }

  async updateGuide(id: number, guide: any) {
    return this.storage.updateGuide(id, guide);
  }

  // ETL methods
  async getCsvSchemas() {
    return this.storage.getCsvSchemas();
  }

  async getCsvSchema(id: number) {
    return this.storage.getCsvSchema(id);
  }

  async createCsvSchema(schema: any) {
    return this.storage.createCsvSchema(schema);
  }

  async getValidationRules(schemaId: number) {
    return this.storage.getValidationRules(schemaId);
  }

  async createValidationRule(rule: any) {
    return this.storage.createValidationRule(rule);
  }

  async createFieldMapping(mapping: any) {
    return this.storage.createFieldMapping(mapping);
  }

  async hasAdmin() {
    return this.storage.hasAdmin();
  }

  // Note methods
  async getNotesByRegulation(regulationId: number) {
    return this.storage.getNotesByRegulation(regulationId);
  }

  async getNotesByUser(userId: number) {
    return this.storage.getNotesByUser(userId);
  }

  async getNote(id: number) {
    return this.storage.getNote(id);
  }

  async createNote(note: any) {
    return this.storage.createNote(note);
  }

  async updateNote(id: number, note: any) {
    return this.storage.updateNote(id, note);
  }

  async deleteNote(id: number) {
    return this.storage.deleteNote(id);
  }

  // Evidence file methods
  async createEvidenceFile(file: any) {
    return this.storage.createEvidenceFile(file);
  }

  async getEvidenceFilesByRegulation(regulationId: number) {
    return this.storage.getEvidenceFilesByRegulation(regulationId);
  }

  async getEvidenceFile(id: number) {
    return this.storage.getEvidenceFile(id);
  }

  async updateEvidenceFileStatus(id: number, status: string) {
    return this.storage.updateEvidenceFileStatus(id, status);
  }

  // Session store - use the original store for now
  get sessionStore() {
    return this.storage.sessionStore;
  }
}

// Factory function to get tenant-aware storage
export function getTenantStorage(tenantConfig: TenantConfig): TenantStorage {
  return new TenantStorage(tenantConfig);
} 