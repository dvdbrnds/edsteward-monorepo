// Repository interfaces - for now, we'll create a simplified approach
// that uses the existing storage.ts and gradually migrates functionality

import { UserRepository } from './user.repository';

// For now, let's create instances but continue using storage.ts for complex operations
export const userRepository = new UserRepository();

// Export the main repository types
export { UserRepository } from './user.repository';
export { BaseRepository } from './base';

// Repository factory (for future use when fully migrated)
export interface IRepositories {
  users: UserRepository;
  // regulations: RegulationRepository; // Will add when TypeScript issues are resolved
  // notes: NoteRepository;
  // etc...
}

export function createRepositories(): IRepositories {
  return {
    users: userRepository,
  };
} 