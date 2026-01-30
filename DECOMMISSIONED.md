# Decommissioned Services

This document tracks services and tools that have been removed from the
EdSteward project.

## ByteRover (Decommissioned: January 27, 2026)

**Reason**: Workflow automation limitations made it unsuitable for the project's
needs.

### What Was Removed:

#### Files Deleted:

- `BYTEROVER_DUAL_SETUP.md`
- `BYTEROVER_UPDATE_JAN27.md`
- `BYTEROVER_V3_QUICKREF.md`
- `BYTEROVER_V3_SETUP.md`
- `update-byterover.sh`
- `setup-byterover.sh`
- `check-byterover-setup.sh`
- `.cursor/rules/byterover-rules.mdc`

#### Directories Removed:

- `.brv/` (local context tree with 526 context files)

#### Configuration Cleaned:

- `CLAUDE.md` - Replaced ByteRover instructions with general AI assistant
  guidelines
- `.gitignore` - Added `.brv/` to prevent future accidental additions

### Global Installation:

**Note**: The global `byterover-cli` package remains installed on the system at
`/opt/homebrew/bin/brv` (version 1.2.1).

To uninstall globally:

```bash
npm uninstall -g byterover-cli
```

### Alternative Approaches:

Going forward, project context and knowledge management will be handled through:

- Documentation in `references/` directory
- `CLAUDE.md` for AI assistant guidelines
- `ROADMAP.md` for project planning
- `CHANGELOG.md` for historical tracking
- Git commit messages for change history
