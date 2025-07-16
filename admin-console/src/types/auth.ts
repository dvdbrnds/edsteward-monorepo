export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin';
  permissions: string[];
  lastLogin?: Date;
  createdAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: AdminUser | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export interface Permission {
    id: string;
    name: string;
    description: string;
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'admin';
}

export interface LoginResponse {
    user: AdminUser;
    token: string;
    refreshToken: string;
    expiresAt: Date;
}

export interface PasswordResetRequest {
    email: string;
}

export interface PasswordReset {
    token: string;
    password: string;
    confirmPassword: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface MFASetupResponse {
    secret: string;
    qrCode: string;
    backupCodes: string[];
}

export interface MFAVerification {
    code: string;
} 