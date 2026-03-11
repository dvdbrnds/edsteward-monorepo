import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', '..', 'config', 'canonical-roles.json');
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

const aliasMap = new Map();
const canonicalSet = new Set();

for (const role of config.roles) {
  const canonical = role.canonical;
  canonicalSet.add(canonical.toLowerCase());
  aliasMap.set(canonical.toLowerCase(), canonical);
  for (const alias of role.aliases) {
    aliasMap.set(alias.toLowerCase().trim(), canonical);
  }
}

/**
 * Normalize a raw role string to its canonical form.
 * Returns the original string if no mapping is found.
 */
export function normalizeRole(rawRole) {
  if (!rawRole) return null;

  const key = rawRole.toLowerCase().trim();

  // Direct match (canonical name or known alias)
  if (aliasMap.has(key)) {
    return aliasMap.get(key);
  }

  // Partial match: check if the input contains a known alias
  for (const [alias, canonical] of aliasMap) {
    if (alias.length > 3 && key.includes(alias)) {
      return canonical;
    }
  }

  return rawRole;
}

/**
 * Get the canonical role list (for LLM prompt injection).
 */
export function getCanonicalRoleList() {
  return config.roles.map(r => r.canonical);
}

/**
 * Check if a role is already canonical.
 */
export function isCanonical(role) {
  if (!role) return false;
  return canonicalSet.has(role.toLowerCase().trim());
}

export default { normalizeRole, getCanonicalRoleList, isCanonical };
