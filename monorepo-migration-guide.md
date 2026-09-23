# EdSteward Monorepo Migration Guide

**What we're doing:** Creating a brand new Git repo that contains both MCP-Engine and EdSteward as subfolders, with full commit history preserved. Your original repos are never touched.

---

## Phase 1: Create the New Empty Monorepo

Open your terminal. Pick wherever you want this to live.

```bash
mkdir edsteward-monorepo && cd edsteward-monorepo
git init
mkdir packages
git commit --allow-empty -m "Initial commit: empty monorepo"
```

**Checkpoint:** `ls -la` should show just `.git` and `packages`.

---

## Phase 2: Pull In the MCP Engine Repo

```bash
git remote add engine-origin https://github.com/dvdbrnds/MCP-Engine.git
git fetch engine-origin
git subtree add --prefix=packages/engine engine-origin main
```

**Checkpoint:** `ls packages/engine/` should show your engine files (package.json, src/, ecosystem.config.cjs, mcp-start.js, etc.). Run `git log --oneline | head -20` to verify commit history came through.

---

## Phase 3: Pull In the EdSteward App Repo

```bash
git remote add app-origin https://github.com/dvdbrnds/EdSteward.git
git fetch app-origin
git subtree add --prefix=packages/app app-origin main
```

**Checkpoint:** `ls packages/app/` should show your EdSteward files (client/, server/, drizzle.config.ts, etc.). Run `git log --oneline | head -30` — you should see commits from both repos.

---

## Phase 4: Root Workspace Config

### 4.1 — Create root package.json

```bash
cat > package.json << 'EOF'
{
  "name": "edsteward-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev:engine": "npm run dev --workspace=packages/engine",
    "dev:app": "npm run dev --workspace=packages/app",
    "dev": "concurrently \"npm run dev:engine\" \"npm run dev:app\"",
    "start:engine": "npm run start --workspace=packages/engine",
    "start:app": "npm run start --workspace=packages/app",
    "build:app": "npm run build --workspace=packages/app",
    "test:app": "npm run test --workspace=packages/app"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
EOF
```

**What changed from the original guide:** Added `start:engine`, `start:app`, `build:app`, and `test:app` scripts so you can access each project's full script set from the root.

### 4.2 — Create root .gitignore

```bash
cat > .gitignore << 'EOF'
node_modules/
.env
.env.*
!.env.example
.DS_Store
dist/
build/
logs/
*.log
EOF
```

### 4.3 — Delete existing package-lock.json files (avoids conflicts during workspace install)

```bash
rm -f packages/engine/package-lock.json packages/app/package-lock.json
```

### 4.4 — Install dependencies

```bash
npm install
```

This hoists shared dependencies to the root `node_modules/`. You may see warnings about version mismatches — that's expected since the engine and app use slightly different versions of some shared packages (e.g. React 18.2 vs 18.3, Express 4.21.2 vs 4.21.1). As long as `npm install` completes without errors, you're fine.

### 4.5 — Set up .env files

Both projects need their environment variables. Copy your existing `.env` files into the new locations:

```bash
# Copy from wherever your current .env files live, e.g.:
cp /path/to/your/MCP-Engine/.env packages/engine/.env
cp /path/to/your/EdSteward/.env packages/app/.env
```

**Don't skip this** — the engine and app won't start without their config.

### 4.6 — Commit

```bash
git add .
git commit -m "Add npm workspace config, root package.json, and .gitignore"
```

**Checkpoint:** `npm ls --workspaces --depth=0` should list both workspaces.

---

## Phase 5: Push to a New GitHub Repo

1. Go to [github.com/new](https://github.com/new) — create a **private** repo named `edsteward-monorepo`. Do NOT add a README, .gitignore, or license.
2. Add the remote and push:

```bash
git remote add origin https://github.com/dvdbrnds/edsteward-monorepo.git
git push -u origin main
```

**Checkpoint:** Visit the repo on GitHub. You should see `packages/engine/`, `packages/app/`, `package.json`, and `.gitignore`. Commit history should include commits from both original repos.

---

## Phase 6: Clean Up Remotes (Optional)

The subtree remotes are no longer needed. Remove them for a tidy setup:

```bash
git remote remove engine-origin
git remote remove app-origin
```

This doesn't affect any files or history — just removes the remote references.

---

## Phase 7: Open in Cursor and Test

1. Close any existing Cursor sessions for MCP-Engine or EdSteward
2. File > Open Folder > select `edsteward-monorepo`
3. Verify both `packages/engine` and `packages/app` are visible in the file explorer

### Test the engine

The engine's `dev` script runs `node mcp-start.js` (not PM2), so this should work:

```bash
npm run dev:engine
```

For production mode with PM2:

```bash
cd packages/engine && pm2 start ecosystem.config.cjs
```

### Test the app

In a new terminal:

```bash
npm run dev:app
```

This runs `tsx server/index.ts`. The app should come up on port 3000.

### Test connectivity

Open the app in your browser and confirm it can reach the engine endpoints.

---

## What About the Old Repos?

Your original repos on GitHub are untouched. Archive them when you're confident the monorepo is solid — no rush.

---

## Quick Reference

| Task | Command |
|---|---|
| Start everything | `npm run dev` |
| Start just the engine | `npm run dev:engine` |
| Start just the app | `npm run dev:app` |
| Build the app | `npm run build:app` |
| Run app tests | `npm run test:app` |
| Install a package for engine | `npm install somepackage -w packages/engine` |
| Install a package for app | `npm install somepackage -w packages/app` |
| Install a shared dev dep | `npm install somepackage -D` (from root) |

## Known Version Overlaps

These packages exist in both projects at slightly different versions. npm workspaces handles this by hoisting one version to root and nesting the other. Watch for issues here:

| Package | Engine | App |
|---|---|---|
| react | 18.2.0 | 18.3.1 |
| express | 4.21.2 | 4.21.1 |
| axios | 1.9.0 | 1.8.1 |
| cors | 2.8.5 | 2.8.5 |
| dotenv | 16.5.0 | 16.4.5 |
| helmet | 8.1.0 | 8.1.0 |
| lodash | 4.17.21 | 4.17.21 |
| pg | 8.16.0 | 8.16.2 |
| cheerio | 1.1.0 | 1.0.0 |
| @anthropic-ai/sdk | 0.71.0 | 0.37.0 |
