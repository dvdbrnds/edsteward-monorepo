import type { IStorage } from "./storage";
import type {
  User,
  InsertUser,
  Regulation,
  InsertRegulation,
  Notification,
  InsertNotification,
  Deadline,
  InsertDeadline,
  Guide,
  InsertGuide,
  CsvSchema,
  InsertCsvSchema,
  ValidationRule,
  InsertValidationRule,
  FieldMapping,
  InsertFieldMapping,
  Note,
  InsertNote,
  EvidenceFile,
  InsertEvidenceFile,
  RegulationVersion,
  InsertRegulationVersion,
  ValidationStatus,
  InsertValidationStatus,
  SyncControl,
  InsertSyncControl,
  NotificationQueue,
  InsertNotificationQueue,
  VersionConflict,
  InsertVersionConflict,
  MCPVersionConflict,
  RegulationUpdate,
  InsertRegulationUpdate
} from "@shared/schema";
import session from "express-session";

// Mock data
const mockUsers: User[] = [
  {
    id: 1,
    username: "admin",
    password: "$2b$10$dummy.hash.for.testing", // bcrypt hash for "password"
    role: "admin",
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    department: "IT",
    externalId: null,
    providerId: null,
    identityProvider: null,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    username: "compliance",
    password: "$2b$10$dummy.hash.for.testing",
    role: "compliance_officer",
    email: "compliance@test.com",
    firstName: "Compliance",
    lastName: "Officer",
    department: "Legal",
    externalId: null,
    providerId: null,
    identityProvider: null,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockRegulations: Regulation[] = [
  {
    id: 1,
    itemId: "REG-001",
    name: "Title IX Education Programs",
    topic: "Education and Civil Rights",
    statute: "Title IX of the Education Amendments of 1972",
    statuteIds: "20 U.S.C. §1681",
    summary: "Prohibits sex-based discrimination in education programs and activities",
    requirements: "Must have Title IX coordinator, grievance procedures, and anti-discrimination policies",
    category: "Civil Rights",
    jurisdiction: "federal",
    dro: "Department of Education",
    isApplicable: true,
    originationDate: new Date("2020-01-01"),
    effectiveDate: new Date("2020-08-14"),
    lastUpdated: new Date("2024-01-15"),
    lastVerified: new Date("2024-01-15"),
    nextReviewDate: new Date("2025-01-15"),
    versionNumber: 2,
    previousVersionId: null,
    versionDate: new Date("2024-01-15"),
    changeSummary: "Updated grievance procedures",
    isCurrent: true,
    versionMetadata: null,
    filingDeadlines: [
      {
        type: "Annual Report",
        date: "2024-12-31",
        frequency: "Annual",
        description: "Submit annual Title IX compliance report"
      }
    ],
    reportingFrequency: "Annual",
    agency_url: "https://www.ed.gov",
    agency_name: "Department of Education",
    agency_contact: "titleix@ed.gov",
    agency_department: "Office for Civil Rights",
    regulationUrl: "https://www.ed.gov/titleix",
    requirementsUrl: "https://www.ed.gov/titleix/requirements",
    submissionGuideUrl: "https://www.ed.gov/titleix/guide",
    formsUrl: "https://www.ed.gov/titleix/forms",
    submissionGuidelines: "Submit via online portal by deadline",
    regulationText: "Full regulation text would go here...",
    applicableforms: ["Title IX Complaint Form", "Annual Report Form"],
    relatedRegulations: ["REG-002"],
    complianceNotes: "Regular training required for all staff",
    verificationMethod: "Annual audit",
    notificationSchedule: {
      initialReminder: 90,
      weeklyReminder: 30,
      dailyReminder: 7,
      finalDayReminders: true
    },
    notificationOverride: null,
    sections: [
      {
        title: "Overview",
        content: "Title IX compliance requirements overview",
        identifiers: ["IX-1", "IX-2"]
      }
    ],
    sources: [
      {
        url: "https://www.ed.gov/titleix",
        type: "agency-api",
        title: "Official Title IX Guidance"
      }
    ],
    actions: [
      {
        type: "attestation",
        enabled: true,
        required: true,
        status: "pending",
        dueDate: new Date("2024-12-31"),
        notes: "Annual compliance attestation required"
      }
    ]
  },
  {
    id: 2,
    itemId: "REG-002", 
    name: "FERPA Privacy Rights",
    topic: "Student Privacy",
    statute: "Family Educational Rights and Privacy Act",
    statuteIds: "20 U.S.C. §1232g",
    summary: "Protects privacy of student education records",
    requirements: "Written consent for disclosure, annual notification to students",
    category: "Privacy",
    jurisdiction: "federal",
    dro: "Department of Education",
    isApplicable: true,
    originationDate: new Date("1974-01-01"),
    effectiveDate: new Date("1974-12-31"),
    lastUpdated: new Date("2023-06-01"),
    lastVerified: new Date("2024-01-01"),
    nextReviewDate: new Date("2024-12-31"),
    versionNumber: 1,
    previousVersionId: null,
    versionDate: new Date("2023-06-01"),
    changeSummary: "Initial implementation",
    isCurrent: true,
    versionMetadata: null,
    filingDeadlines: null,
    reportingFrequency: "As needed",
    agency_url: "https://www.ed.gov",
    agency_name: "Department of Education",
    agency_contact: "ferpa@ed.gov",
    agency_department: "Student Privacy Office",
    regulationUrl: "https://www.ed.gov/ferpa",
    requirementsUrl: "https://www.ed.gov/ferpa/requirements",
    submissionGuideUrl: null,
    formsUrl: null,
    submissionGuidelines: null,
    regulationText: "FERPA regulation text...",
    applicableforms: null,
    relatedRegulations: ["REG-001"],
    complianceNotes: "Maintain student consent records",
    verificationMethod: "Policy review",
    notificationSchedule: {
      initialReminder: 60,
      weeklyReminder: 14,
      dailyReminder: 3,
      finalDayReminders: true
    },
    notificationOverride: null,
    sections: null,
    sources: null,
    actions: [
      {
        type: "website_publish",
        enabled: true,
        required: false,
        status: "completed",
        completedDate: new Date("2024-01-01"),
        notes: "Privacy policy published on website"
      }
    ]
  }
];

export class MockStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Simple memory store for sessions
    this.sessionStore = new session.MemoryStore();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return mockUsers.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return mockUsers.find(u => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: mockUsers.length + 1,
      username: user.username,
      password: user.password || "mock-password",
      role: user.role || "user",
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      department: user.department || null,
      externalId: user.externalId || null,
      providerId: user.providerId || null,
      identityProvider: user.identityProvider || null,
      lastLogin: user.lastLogin || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockUsers.push(newUser);
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return mockUsers;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const index = mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error("User not found");
    
    mockUsers[index] = { ...mockUsers[index], ...user, updatedAt: new Date() };
    return mockUsers[index];
  }

  async deleteUser(id: number): Promise<void> {
    const index = mockUsers.findIndex(u => u.id === id);
    if (index !== -1) {
      mockUsers.splice(index, 1);
    }
  }

  // Regulation methods
  async getRegulations(): Promise<Regulation[]> {
    return mockRegulations;
  }

  async getRegulation(id: number): Promise<Regulation | undefined> {
    return mockRegulations.find(r => r.id === id);
  }

  async getRegulationById(regulationId: string): Promise<Regulation | null> {
    return mockRegulations.find(r => r.itemId === regulationId) || null;
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    const newRegulation: Regulation = {
      id: mockRegulations.length + 1,
      itemId: regulation.itemId,
      name: regulation.name,
      topic: regulation.topic,
      statute: regulation.statute,
      statuteIds: regulation.statuteIds || null,
      summary: regulation.summary || null,
      requirements: regulation.requirements || null,
      category: regulation.category,
      jurisdiction: regulation.jurisdiction || "federal",
      dro: regulation.dro || "",
      isApplicable: regulation.isApplicable !== undefined ? regulation.isApplicable : true,
      originationDate: regulation.originationDate || null,
      effectiveDate: regulation.effectiveDate || null,
      lastUpdated: regulation.lastUpdated || null,
      lastVerified: regulation.lastVerified || null,
      nextReviewDate: regulation.nextReviewDate || null,
      versionNumber: regulation.versionNumber || 1,
      previousVersionId: regulation.previousVersionId || null,
      versionDate: regulation.versionDate || new Date(),
      changeSummary: regulation.changeSummary || null,
      isCurrent: regulation.isCurrent !== undefined ? regulation.isCurrent : true,
      versionMetadata: regulation.versionMetadata || null,
      filingDeadlines: regulation.filingDeadlines || null,
      reportingFrequency: regulation.reportingFrequency || null,
      agency_url: regulation.agency_url || null,
      agency_name: regulation.agency_name || null,
      agency_contact: regulation.agency_contact || null,
      agency_department: regulation.agency_department || null,
      regulationUrl: regulation.regulationUrl || null,
      requirementsUrl: regulation.requirementsUrl || null,
      submissionGuideUrl: regulation.submissionGuideUrl || null,
      formsUrl: regulation.formsUrl || null,
      submissionGuidelines: regulation.submissionGuidelines || null,
      regulationText: regulation.regulationText || null,
      applicableforms: regulation.applicableforms || null,
      relatedRegulations: regulation.relatedRegulations || null,
      complianceNotes: regulation.complianceNotes || null,
      verificationMethod: regulation.verificationMethod || null,
      notificationSchedule: regulation.notificationSchedule || null,
      notificationOverride: regulation.notificationOverride || null,
      sections: regulation.sections || null,
      sources: regulation.sources || null,
      actions: regulation.actions || null
    };
    mockRegulations.push(newRegulation);
    return newRegulation;
  }

  async updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation> {
    const index = mockRegulations.findIndex(r => r.id === id);
    if (index === -1) throw new Error("Regulation not found");
    
    mockRegulations[index] = { ...mockRegulations[index], ...regulation };
    return mockRegulations[index];
  }

  async setRegulationApplicability(id: number, isApplicable: boolean): Promise<Regulation> {
    return this.updateRegulation(id, { isApplicable });
  }

  async getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]> {
    return mockRegulations.filter(r => r.jurisdiction === jurisdiction);
  }

  async searchRegulations(searchTerm: string): Promise<Regulation[]> {
    const term = searchTerm.toLowerCase();
    return mockRegulations.filter(r => 
      r.name.toLowerCase().includes(term) ||
      r.topic.toLowerCase().includes(term) ||
      r.statute.toLowerCase().includes(term)
    );
  }

  async deleteRegulation(id: number): Promise<void> {
    const index = mockRegulations.findIndex(r => r.id === id);
    if (index !== -1) {
      mockRegulations.splice(index, 1);
    }
  }

  // RegulationUpdate methods (simplified)
  async getPendingRegulationUpdates(): Promise<RegulationUpdate[]> {
    return [];
  }

  async createRegulationUpdate(data: InsertRegulationUpdate): Promise<RegulationUpdate> {
    // Mock implementation - just return a basic regulation update
    return {
      id: Math.floor(Math.random() * 1000),
      regulationId: data.regulationId,
      name: data.name,
      originalContent: data.originalContent,
      updatedContent: data.updatedContent,
      status: data.status || "pending",
      updateDate: new Date(),
      signature: data.signature,
      userId: data.userId,
      rejectionReason: data.rejectionReason,
      processedAt: data.processedAt
    };
  }

  async getRegulationUpdateById(id: number): Promise<RegulationUpdate | null> {
    return null;
  }

  async acceptRegulationUpdate(id: number, userId: number, signature: string): Promise<void> {
    // Mock implementation
  }

  async rejectRegulationUpdate(id: number, userId: number, signature: string, reason: string): Promise<void> {
    // Mock implementation
  }

  async deferRegulationUpdate(id: number, userId: number, signature: string): Promise<void> {
    // Mock implementation
  }

  // Notification methods
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return [];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    return {
      id: 1,
      regulationId: notification.regulationId,
      userId: notification.userId,
      type: notification.type,
      frequency: notification.frequency,
      enabled: notification.enabled !== undefined ? notification.enabled : true,
      phoneNumber: notification.phoneNumber || null
    };
  }

  async sendEmailNotification(userId: number, subject: string, message: string): Promise<boolean> {
    return true;
  }

  // Deadline methods
  async getDeadlines(): Promise<Deadline[]> {
    return [];
  }

  async getAllIncompleteDeadlines(): Promise<Deadline[]> {
    return [];
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    return {
      id: 1,
      regulationId: deadline.regulationId,
      dueDate: deadline.dueDate,
      status: deadline.status,
      assignedTo: deadline.assignedTo
    };
  }

  // Guide methods
  async getGuides(): Promise<Guide[]> {
    return [];
  }

  async getGuidesByCategory(category: string): Promise<Guide[]> {
    return [];
  }

  async getGuide(id: number): Promise<Guide | undefined> {
    return undefined;
  }

  async createGuide(guide: InsertGuide): Promise<Guide> {
    return {
      id: 1,
      title: guide.title,
      content: guide.content,
      category: guide.category,
      lastUpdated: guide.lastUpdated || null,
      createdBy: guide.createdBy
    };
  }

  async updateGuide(id: number, guide: Partial<InsertGuide>): Promise<Guide> {
    throw new Error("Mock not implemented");
  }

  // ETL methods (simplified mocks)
  async getCsvSchemas(): Promise<CsvSchema[]> { return []; }
  async getCsvSchema(id: number): Promise<CsvSchema | undefined> { return undefined; }
  async createCsvSchema(schema: InsertCsvSchema): Promise<CsvSchema> { throw new Error("Mock not implemented"); }
  async getValidationRules(schemaId: number): Promise<ValidationRule[]> { return []; }
  async createValidationRule(rule: InsertValidationRule): Promise<ValidationRule> { throw new Error("Mock not implemented"); }
  async createFieldMapping(mapping: InsertFieldMapping): Promise<FieldMapping> { throw new Error("Mock not implemented"); }

  async hasAdmin(): Promise<boolean> {
    return mockUsers.some(u => u.role === "admin");
  }

  // Note methods
  async getNotesByRegulation(regulationId: number): Promise<Note[]> {
    return [];
  }

  async getNotesByUser(userId: number): Promise<Note[]> {
    return [];
  }

  async getNote(id: number): Promise<Note | null> {
    return null;
  }

  async createNote(note: InsertNote): Promise<Note> {
    return {
      id: 1,
      regulationId: note.regulationId,
      userId: note.userId,
      title: note.title,
      content: note.content,
      category: note.category || "general",
      status: note.status || "active",
      isPrivate: note.isPrivate !== undefined ? note.isPrivate : false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateNote(id: number, note: Partial<InsertNote>): Promise<Note> {
    throw new Error("Mock not implemented");
  }

  async deleteNote(id: number): Promise<void> {
    // Mock implementation
  }

  // Evidence file methods
  async createEvidenceFile(file: InsertEvidenceFile): Promise<EvidenceFile> {
    return {
      id: 1,
      regulationId: file.regulationId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      description: file.description || null,
      uploadedBy: file.uploadedBy,
      uploadedAt: new Date(),
      status: file.status || "pending",
      storagePath: file.storagePath,
      isOfficial: file.isOfficial !== undefined ? file.isOfficial : false
    };
  }

  async getEvidenceFilesByRegulation(regulationId: number): Promise<EvidenceFile[]> {
    return [];
  }

  async getEvidenceFile(id: number): Promise<EvidenceFile | undefined> {
    return undefined;
  }

  async updateEvidenceFileStatus(id: number, status: string): Promise<EvidenceFile> {
    throw new Error("Mock not implemented");
  }

  // MCP methods (simplified mocks)
  async getRegulationVersions(regulationId: number): Promise<RegulationVersion[]> { return []; }
  async getRegulationVersion(id: number): Promise<RegulationVersion | null> { return null; }
  async createRegulationVersion(version: InsertRegulationVersion): Promise<RegulationVersion> { throw new Error("Mock not implemented"); }
  async getLatestRegulationVersion(regulationId: number): Promise<RegulationVersion | null> { return null; }
  async compareRegulationVersions(versionIdA: number, versionIdB: number): Promise<any> { return { changes: [] }; }
  async getValidationStatus(regulationId: number, versionId?: number): Promise<ValidationStatus[]> { return []; }
  async createValidationStatus(status: InsertValidationStatus): Promise<ValidationStatus> { throw new Error("Mock not implemented"); }
  async updateValidationStatus(id: number, status: Partial<InsertValidationStatus>): Promise<ValidationStatus> { throw new Error("Mock not implemented"); }
  async validateRegulationVersion(versionId: number, userId: number): Promise<ValidationStatus[]> { return []; }
  async getSyncControl(regulationId: number): Promise<SyncControl | null> { return null; }
  async createSyncControl(control: InsertSyncControl): Promise<SyncControl> { throw new Error("Mock not implemented"); }
  async updateSyncControl(id: number, control: Partial<InsertSyncControl>): Promise<SyncControl> { throw new Error("Mock not implemented"); }
  async scheduleSyncForRegulation(regulationId: number, nextSync: Date): Promise<SyncControl> { throw new Error("Mock not implemented"); }
  async recordSyncAttempt(regulationId: number, success: boolean, error?: string): Promise<SyncControl> { throw new Error("Mock not implemented"); }
  async getNotificationQueue(status?: 'pending' | 'sent' | 'failed'): Promise<NotificationQueue[]> { return []; }
  async createNotificationQueueItem(item: InsertNotificationQueue): Promise<NotificationQueue> { throw new Error("Mock not implemented"); }
  async updateNotificationQueueItem(id: number, item: Partial<InsertNotificationQueue>): Promise<NotificationQueue> { throw new Error("Mock not implemented"); }
  async markNotificationAsSent(id: number): Promise<NotificationQueue> { throw new Error("Mock not implemented"); }
  async getVersionConflicts(status?: 'pending' | 'resolved' | 'rejected'): Promise<VersionConflict[]> { return []; }
  async getVersionConflictsForRegulation(regulationId: number): Promise<VersionConflict[]> { return []; }
  async createVersionConflict(conflict: InsertVersionConflict): Promise<VersionConflict> { throw new Error("Mock not implemented"); }
  async resolveVersionConflict(id: number, resolutions: MCPVersionConflict[], userId: number): Promise<VersionConflict> { throw new Error("Mock not implemented"); }
  async rejectVersionConflict(id: number, userId: number): Promise<VersionConflict> { throw new Error("Mock not implemented"); }
} 