/**
 * Okta Group to EdSteward Role Mapping Configuration
 * Maps Okta groups to internal EdSteward roles with hierarchical permissions
 */

export interface RolePermissions {
  // Core permissions
  canViewRegulations: boolean;
  canEditRegulations: boolean;
  canDeleteRegulations: boolean;
  canCreateRegulations: boolean;
  
  // User management
  canViewUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canCreateUsers: boolean;
  
  // Reports and analytics
  canViewAllReports: boolean;
  canViewDepartmentReports: boolean;
  canExportReports: boolean;
  
  // System administration
  canAccessAdminPanel: boolean;
  canManageSystemSettings: boolean;
  canViewSystemLogs: boolean;
  
  // Compliance actions
  canApproveRegulationUpdates: boolean;
  canRejectRegulationUpdates: boolean;
  canSubmitComplianceReports: boolean;
  
  // Evidence and documentation
  canUploadEvidence: boolean;
  canDeleteEvidence: boolean;
  canViewAllEvidence: boolean;
  
  // Notifications and deadlines
  canManageNotifications: boolean;
  canSetDeadlines: boolean;
  canViewAllDeadlines: boolean;
}

export interface EdStewardRole {
  name: string;
  displayName: string;
  description: string;
  permissions: RolePermissions;
  hierarchy: number; // Higher number = more permissions
}

// Define EdSteward internal roles with their permissions
export const edStewardRoles: Record<string, EdStewardRole> = {
  admin: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with all administrative privileges',
    hierarchy: 100,
    permissions: {
      // Core permissions - full access
      canViewRegulations: true,
      canEditRegulations: true,
      canDeleteRegulations: true,
      canCreateRegulations: true,
      
      // User management - full access
      canViewUsers: true,
      canEditUsers: true,
      canDeleteUsers: true,
      canCreateUsers: true,
      
      // Reports - full access
      canViewAllReports: true,
      canViewDepartmentReports: true,
      canExportReports: true,
      
      // System administration - full access
      canAccessAdminPanel: true,
      canManageSystemSettings: true,
      canViewSystemLogs: true,
      
      // Compliance actions - full access
      canApproveRegulationUpdates: true,
      canRejectRegulationUpdates: true,
      canSubmitComplianceReports: true,
      
      // Evidence - full access
      canUploadEvidence: true,
      canDeleteEvidence: true,
      canViewAllEvidence: true,
      
      // Notifications - full access
      canManageNotifications: true,
      canSetDeadlines: true,
      canViewAllDeadlines: true,
    }
  },
  
  compliance_officer: {
    name: 'compliance_officer',
    displayName: 'Compliance Officer',
    description: 'Manage regulations and compliance reporting across all departments',
    hierarchy: 75,
    permissions: {
      // Core permissions - can manage regulations
      canViewRegulations: true,
      canEditRegulations: true,
      canDeleteRegulations: false, // Cannot delete
      canCreateRegulations: true,
      
      // User management - limited
      canViewUsers: true,
      canEditUsers: false,
      canDeleteUsers: false,
      canCreateUsers: false,
      
      // Reports - full access
      canViewAllReports: true,
      canViewDepartmentReports: true,
      canExportReports: true,
      
      // System administration - no access
      canAccessAdminPanel: false,
      canManageSystemSettings: false,
      canViewSystemLogs: false,
      
      // Compliance actions - full access
      canApproveRegulationUpdates: true,
      canRejectRegulationUpdates: true,
      canSubmitComplianceReports: true,
      
      // Evidence - full access
      canUploadEvidence: true,
      canDeleteEvidence: true,
      canViewAllEvidence: true,
      
      // Notifications - full access
      canManageNotifications: true,
      canSetDeadlines: true,
      canViewAllDeadlines: true,
    }
  },
  
  department_head: {
    name: 'department_head',
    displayName: 'Department Head',
    description: 'View and manage compliance for specific department only',
    hierarchy: 50,
    permissions: {
      // Core permissions - view only
      canViewRegulations: true,
      canEditRegulations: false,
      canDeleteRegulations: false,
      canCreateRegulations: false,
      
      // User management - view only
      canViewUsers: true,
      canEditUsers: false,
      canDeleteUsers: false,
      canCreateUsers: false,
      
      // Reports - department only
      canViewAllReports: false,
      canViewDepartmentReports: true,
      canExportReports: true,
      
      // System administration - no access
      canAccessAdminPanel: false,
      canManageSystemSettings: false,
      canViewSystemLogs: false,
      
      // Compliance actions - limited
      canApproveRegulationUpdates: false,
      canRejectRegulationUpdates: false,
      canSubmitComplianceReports: true,
      
      // Evidence - department scope
      canUploadEvidence: true,
      canDeleteEvidence: false,
      canViewAllEvidence: false,
      
      // Notifications - limited
      canManageNotifications: false,
      canSetDeadlines: false,
      canViewAllDeadlines: false,
    }
  },
  
  viewer: {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to assigned content',
    hierarchy: 25,
    permissions: {
      // Core permissions - read only
      canViewRegulations: true,
      canEditRegulations: false,
      canDeleteRegulations: false,
      canCreateRegulations: false,
      
      // User management - no access
      canViewUsers: false,
      canEditUsers: false,
      canDeleteUsers: false,
      canCreateUsers: false,
      
      // Reports - limited view
      canViewAllReports: false,
      canViewDepartmentReports: true,
      canExportReports: false,
      
      // System administration - no access
      canAccessAdminPanel: false,
      canManageSystemSettings: false,
      canViewSystemLogs: false,
      
      // Compliance actions - no access
      canApproveRegulationUpdates: false,
      canRejectRegulationUpdates: false,
      canSubmitComplianceReports: false,
      
      // Evidence - view only
      canUploadEvidence: false,
      canDeleteEvidence: false,
      canViewAllEvidence: false,
      
      // Notifications - view only
      canManageNotifications: false,
      canSetDeadlines: false,
      canViewAllDeadlines: false,
    }
  },
  
  // Legacy role for backwards compatibility
  user: {
    name: 'user',
    displayName: 'User',
    description: 'Basic user access (legacy role)',
    hierarchy: 25,
    permissions: {
      // Same as viewer for backwards compatibility
      canViewRegulations: true,
      canEditRegulations: false,
      canDeleteRegulations: false,
      canCreateRegulations: false,
      canViewUsers: false,
      canEditUsers: false,
      canDeleteUsers: false,
      canCreateUsers: false,
      canViewAllReports: false,
      canViewDepartmentReports: true,
      canExportReports: false,
      canAccessAdminPanel: false,
      canManageSystemSettings: false,
      canViewSystemLogs: false,
      canApproveRegulationUpdates: false,
      canRejectRegulationUpdates: false,
      canSubmitComplianceReports: false,
      canUploadEvidence: false,
      canDeleteEvidence: false,
      canViewAllEvidence: false,
      canManageNotifications: false,
      canSetDeadlines: false,
      canViewAllDeadlines: false,
    }
  }
};

// Okta group to EdSteward role mapping
export const oktaGroupMapping: Record<string, string> = {
  'EdSteward-Admin': 'admin',
  'EdSteward-ComplianceOfficer': 'compliance_officer',
  'EdSteward-DepartmentHead': 'department_head',
  'EdSteward-Viewer': 'viewer',
  
  // Alternative naming patterns (case variations)
  'edsteward-admin': 'admin',
  'edsteward-complianceofficer': 'compliance_officer',
  'edsteward-departmenthead': 'department_head',
  'edsteward-viewer': 'viewer',
  
  // Legacy mappings
  'EdSteward Admin': 'admin',
  'EdSteward Compliance Officer': 'compliance_officer',
  'EdSteward Department Head': 'department_head',
  'EdSteward Viewer': 'viewer',
};

/**
 * Extract and map Okta groups to EdSteward roles
 * @param oktaGroups Array of group names from Okta SAML assertion
 * @returns Array of EdSteward role names
 */
export function mapOktaGroupsToRoles(oktaGroups: string[]): string[] {
  if (!oktaGroups || !Array.isArray(oktaGroups)) {
    return ['viewer']; // Default to viewer role
  }

  const mappedRoles: string[] = [];
  
  for (const group of oktaGroups) {
    const role = oktaGroupMapping[group];
    if (role && edStewardRoles[role]) {
      mappedRoles.push(role);
    }
  }
  
  // If no valid roles found, default to viewer
  if (mappedRoles.length === 0) {
    return ['viewer'];
  }
  
  // Return unique roles sorted by hierarchy (highest first)
  const uniqueRoles = [...new Set(mappedRoles)];
  return uniqueRoles.sort((a, b) => 
    edStewardRoles[b].hierarchy - edStewardRoles[a].hierarchy
  );
}

/**
 * Get the highest priority role from a list of roles
 * @param roles Array of role names
 * @returns Highest priority role name
 */
export function getHighestPriorityRole(roles: string[]): string {
  if (!roles || roles.length === 0) {
    return 'viewer';
  }
  
  return roles.sort((a, b) => 
    edStewardRoles[b].hierarchy - edStewardRoles[a].hierarchy
  )[0];
}

/**
 * Check if user has specific permission
 * @param userRoles Array of user's role names
 * @param permission Permission to check
 * @returns True if user has the permission
 */
export function hasPermission(userRoles: string[], permission: keyof RolePermissions): boolean {
  if (!userRoles || userRoles.length === 0) {
    return false;
  }
  
  // Check if any of the user's roles has the permission
  return userRoles.some(roleName => {
    const role = edStewardRoles[roleName];
    return role && role.permissions[permission];
  });
}

/**
 * Get combined permissions for user based on all their roles
 * @param userRoles Array of user's role names
 * @returns Combined permissions object
 */
export function getCombinedPermissions(userRoles: string[]): RolePermissions {
  if (!userRoles || userRoles.length === 0) {
    return edStewardRoles.viewer.permissions;
  }
  
  // Start with no permissions
  const combinedPermissions: RolePermissions = {
    canViewRegulations: false,
    canEditRegulations: false,
    canDeleteRegulations: false,
    canCreateRegulations: false,
    canViewUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canCreateUsers: false,
    canViewAllReports: false,
    canViewDepartmentReports: false,
    canExportReports: false,
    canAccessAdminPanel: false,
    canManageSystemSettings: false,
    canViewSystemLogs: false,
    canApproveRegulationUpdates: false,
    canRejectRegulationUpdates: false,
    canSubmitComplianceReports: false,
    canUploadEvidence: false,
    canDeleteEvidence: false,
    canViewAllEvidence: false,
    canManageNotifications: false,
    canSetDeadlines: false,
    canViewAllDeadlines: false,
  };
  
  // Combine permissions from all roles (OR operation)
  for (const roleName of userRoles) {
    const role = edStewardRoles[roleName];
    if (role) {
      Object.keys(combinedPermissions).forEach(permission => {
        const key = permission as keyof RolePermissions;
        combinedPermissions[key] = combinedPermissions[key] || role.permissions[key];
      });
    }
  }
  
  return combinedPermissions;
}

export default {
  edStewardRoles,
  oktaGroupMapping,
  mapOktaGroupsToRoles,
  getHighestPriorityRole,
  hasPermission,
  getCombinedPermissions
};
