#!/usr/bin/env node
/**
 * Console Version Registry CLI
 * 
 * Manage versioned, immutable console artifacts for gold standard regulations.
 * 
 * Commands:
 *   certify <reg-key>              Certify current console as new gold version
 *   rollback <reg-key> <version>   Rollback to a previous gold version
 *   list <reg-key>                 List all versions for a regulation
 *   active [reg-key]               Show active gold version(s)
 *   verify <reg-key> [version]     Verify integrity of stored version
 *   audit <reg-key>                Show audit history
 *   status                         Show overall registry status
 * 
 * Examples:
 *   node scripts/console-version-cli.js certify REG-001
 *   node scripts/console-version-cli.js rollback REG-001 v1.0 --reason "Bug in v1.1"
 *   node scripts/console-version-cli.js list REG-001
 *   node scripts/console-version-cli.js active
 *   node scripts/console-version-cli.js verify REG-001
 */

import ConsoleVersionRegistry from '../src/services/console-version-registry.js';
import { query } from '../src/services/database.js';

const args = process.argv.slice(2);
const command = args[0];

// Parse flags
const flags = {};
args.forEach((arg, i) => {
    if (arg.startsWith('--')) {
        const key = arg.slice(2);
        flags[key] = args[i + 1] || true;
    }
});

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function printHeader(text) {
    console.log(`\n${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}  ${text}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function printSuccess(text) {
    console.log(`${colors.green}✅ ${text}${colors.reset}`);
}

function printError(text) {
    console.log(`${colors.red}❌ ${text}${colors.reset}`);
}

function printWarning(text) {
    console.log(`${colors.yellow}⚠️  ${text}${colors.reset}`);
}

function printInfo(text) {
    console.log(`${colors.blue}ℹ️  ${text}${colors.reset}`);
}

function printTable(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => {
        const maxRowWidth = Math.max(...rows.map(r => String(r[i] || '').length));
        return Math.max(h.length, maxRowWidth);
    });
    
    // Print header
    const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' │ ');
    const separator = widths.map(w => '─'.repeat(w)).join('─┼─');
    
    console.log(`${colors.bright}${headerRow}${colors.reset}`);
    console.log(`${colors.dim}${separator}${colors.reset}`);
    
    // Print rows
    rows.forEach(row => {
        const rowStr = row.map((cell, i) => {
            const str = String(cell || '-');
            return str.padEnd(widths[i]);
        }).join(' │ ');
        console.log(rowStr);
    });
}

async function certify(regKey) {
    printHeader(`CERTIFYING ${regKey} AS GOLD`);
    
    try {
        // Check if there's an active version
        const active = await ConsoleVersionRegistry.getActive(regKey);
        if (active) {
            printInfo(`Current active version: ${active.version} (score: ${active.workflowScore || 'N/A'})`);
        }
        
        // For now, we'll certify with minimal workflow results
        // In production, this would be called after running the full workflow
        const workflowResults = {
            scores: {
                overall: flags.score ? parseInt(flags.score) : 100,
                certaintyLevel: flags.certainty || 'A'
            },
            certificationNotes: flags.notes || 'Manual certification via CLI'
        };
        
        const result = await ConsoleVersionRegistry.certifyGold(
            regKey,
            workflowResults,
            flags.by || process.env.USER || 'cli-user',
            flags.notes || ''
        );
        
        printSuccess(`${regKey} ${result.version} certified as GOLD`);
        console.log(`\n   ${colors.dim}Version:${colors.reset}      ${result.version}`);
        console.log(`   ${colors.dim}Content Hash:${colors.reset} ${result.contentHash.substring(0, 16)}...`);
        console.log(`   ${colors.dim}Stored At:${colors.reset}    ${result.storedAt}`);
        console.log(`   ${colors.dim}Certified:${colors.reset}    ${result.certifiedAt}`);
        
    } catch (err) {
        printError(err.message);
        process.exit(1);
    }
}

async function rollback(regKey, targetVersion) {
    printHeader(`ROLLING BACK ${regKey} TO ${targetVersion}`);
    
    if (!targetVersion) {
        printError('Target version required. Usage: rollback <reg-key> <version>');
        process.exit(1);
    }
    
    try {
        const reason = flags.reason || '';
        
        const result = await ConsoleVersionRegistry.rollback(
            regKey,
            targetVersion,
            flags.by || process.env.USER || 'cli-user',
            reason
        );
        
        printSuccess(`${regKey} rolled back to ${targetVersion}`);
        if (result.rolledBackFrom) {
            console.log(`   ${colors.dim}From:${colors.reset}   ${result.rolledBackFrom}`);
        }
        if (reason) {
            console.log(`   ${colors.dim}Reason:${colors.reset} ${reason}`);
        }
        
    } catch (err) {
        printError(err.message);
        process.exit(1);
    }
}

async function list(regKey) {
    printHeader(`VERSION HISTORY: ${regKey}`);
    
    try {
        const versions = await ConsoleVersionRegistry.listVersions(regKey);
        
        if (versions.length === 0) {
            printWarning(`No versions found for ${regKey}`);
            return;
        }
        
        console.log(`${colors.dim}Regulation: ${versions[0].regulationName || regKey}${colors.reset}\n`);
        
        const headers = ['Version', 'Status', 'Active', 'Score', 'Tasks', 'Certified By', 'Certified At'];
        const rows = versions.map(v => [
            v.version,
            v.status.toUpperCase(),
            v.isActive ? '✅ YES' : '',
            v.workflowScore || '-',
            v.taskCount || '-',
            v.certifiedBy || '-',
            v.certifiedAt ? new Date(v.certifiedAt).toLocaleString() : '-'
        ]);
        
        printTable(headers, rows);
        
    } catch (err) {
        printError(err.message);
        process.exit(1);
    }
}

async function active(regKey) {
    if (regKey) {
        printHeader(`ACTIVE GOLD: ${regKey}`);
        
        try {
            const version = await ConsoleVersionRegistry.getActive(regKey);
            
            if (!version) {
                printWarning(`No active gold version for ${regKey}`);
                return;
            }
            
            console.log(`${colors.green}${colors.bright}${version.regulationName || regKey}${colors.reset}`);
            console.log(`   ${colors.dim}Version:${colors.reset}       ${version.version}`);
            console.log(`   ${colors.dim}Status:${colors.reset}        ${version.status.toUpperCase()}`);
            console.log(`   ${colors.dim}Score:${colors.reset}         ${version.workflowScore || 'N/A'}/100`);
            console.log(`   ${colors.dim}Certainty:${colors.reset}     ${version.certaintyLevel || 'N/A'}`);
            console.log(`   ${colors.dim}Tasks:${colors.reset}         ${version.taskCount}`);
            console.log(`   ${colors.dim}Deadlines:${colors.reset}     ${version.deadlineCount}`);
            console.log(`   ${colors.dim}Certified By:${colors.reset}  ${version.certifiedBy}`);
            console.log(`   ${colors.dim}Certified At:${colors.reset}  ${new Date(version.certifiedAt).toLocaleString()}`);
            console.log(`   ${colors.dim}Content Hash:${colors.reset}  ${version.contentHash.substring(0, 32)}...`);
            
        } catch (err) {
            printError(err.message);
            process.exit(1);
        }
    } else {
        printHeader('ALL ACTIVE GOLD STANDARDS');
        
        try {
            const allActive = await ConsoleVersionRegistry.getAllActive();
            
            if (allActive.length === 0) {
                printWarning('No active gold standards found');
                return;
            }
            
            const headers = ['REG-KEY', 'Version', 'Score', 'Tasks', 'Certified By', 'Regulation Name'];
            const rows = allActive.map(v => [
                v.reg_key,
                v.version,
                v.workflow_score || '-',
                v.task_count || '-',
                v.certified_by || '-',
                (v.regulation_name || '').substring(0, 40)
            ]);
            
            printTable(headers, rows);
            
            console.log(`\n${colors.dim}Total gold standards: ${allActive.length}${colors.reset}`);
            
        } catch (err) {
            printError(err.message);
            process.exit(1);
        }
    }
}

async function verify(regKey, version) {
    const targetVersion = version || 'active';
    printHeader(`VERIFYING INTEGRITY: ${regKey} ${targetVersion}`);
    
    try {
        let versionToVerify = version;
        
        if (!version) {
            const activeVersion = await ConsoleVersionRegistry.getActive(regKey);
            if (!activeVersion) {
                printError(`No active version found for ${regKey}`);
                process.exit(1);
            }
            versionToVerify = activeVersion.version;
        }
        
        const result = await ConsoleVersionRegistry.verifyIntegrity(regKey, versionToVerify);
        
        if (result.isValid) {
            printSuccess(result.message);
            console.log(`   ${colors.dim}Version:${colors.reset}     ${result.version}`);
            console.log(`   ${colors.dim}Hash:${colors.reset}        ${result.storedHash.substring(0, 32)}...`);
        } else {
            printError(result.message || result.error);
            if (result.storedHash && result.currentHash) {
                console.log(`   ${colors.dim}Stored Hash:${colors.reset}  ${result.storedHash.substring(0, 32)}...`);
                console.log(`   ${colors.dim}Current Hash:${colors.reset} ${result.currentHash.substring(0, 32)}...`);
            }
            process.exit(1);
        }
        
    } catch (err) {
        printError(err.message);
        process.exit(1);
    }
}

async function audit(regKey) {
    printHeader(`AUDIT HISTORY: ${regKey}`);
    
    try {
        const history = await ConsoleVersionRegistry.getAuditHistory(regKey);
        
        if (history.length === 0) {
            printWarning(`No audit history for ${regKey}`);
            return;
        }
        
        history.forEach(entry => {
            const timestamp = new Date(entry.performed_at).toLocaleString();
            const actionColor = {
                'created': colors.green,
                'certified': colors.cyan,
                'activated': colors.blue,
                'deactivated': colors.yellow,
                'rolled_back': colors.magenta,
                'superseded': colors.dim
            }[entry.action] || colors.reset;
            
            console.log(`${colors.dim}${timestamp}${colors.reset} ${actionColor}${entry.action.toUpperCase().padEnd(12)}${colors.reset} ${entry.version || ''} by ${entry.performed_by || 'system'}`);
            if (entry.notes) {
                console.log(`   ${colors.dim}Notes: ${entry.notes}${colors.reset}`);
            }
        });
        
    } catch (err) {
        printError(err.message);
        process.exit(1);
    }
}

async function status() {
    printHeader('CONSOLE VERSION REGISTRY STATUS');
    
    try {
        // Get counts
        const stats = await query(`
            SELECT 
                COUNT(*) as total_versions,
                COUNT(CASE WHEN status = 'gold' THEN 1 END) as gold_versions,
                COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_versions,
                COUNT(DISTINCT reg_key) as unique_regulations
            FROM console_versions
        `);
        
        const s = stats.rows[0];
        
        console.log(`${colors.bright}Registry Statistics${colors.reset}`);
        console.log(`   ${colors.dim}Total Versions:${colors.reset}       ${s.total_versions}`);
        console.log(`   ${colors.dim}Gold Versions:${colors.reset}        ${s.gold_versions}`);
        console.log(`   ${colors.dim}Active Versions:${colors.reset}      ${s.active_versions}`);
        console.log(`   ${colors.dim}Unique Regulations:${colors.reset}   ${s.unique_regulations}`);
        
        // List active gold standards
        const allActive = await ConsoleVersionRegistry.getAllActive();
        
        if (allActive.length > 0) {
            console.log(`\n${colors.bright}Active Gold Standards${colors.reset}`);
            allActive.forEach(v => {
                console.log(`   ${colors.green}${v.reg_key}${colors.reset} ${v.version} - ${v.regulation_name || 'Unknown'}`);
            });
        }
        
    } catch (err) {
        printError(err.message);
        process.exit(1);
    }
}

function showHelp() {
    printHeader('CONSOLE VERSION REGISTRY CLI');
    
    console.log(`${colors.bright}USAGE${colors.reset}`);
    console.log('  node scripts/console-version-cli.js <command> [args] [flags]\n');
    
    console.log(`${colors.bright}COMMANDS${colors.reset}`);
    console.log('  certify <reg-key>              Certify current console as new gold version');
    console.log('  rollback <reg-key> <version>   Rollback to a previous gold version');
    console.log('  list <reg-key>                 List all versions for a regulation');
    console.log('  active [reg-key]               Show active gold version(s)');
    console.log('  verify <reg-key> [version]     Verify integrity of stored version');
    console.log('  audit <reg-key>                Show audit history');
    console.log('  status                         Show overall registry status\n');
    
    console.log(`${colors.bright}FLAGS${colors.reset}`);
    console.log('  --by <user>        User performing the action');
    console.log('  --reason <text>    Reason for rollback');
    console.log('  --notes <text>     Certification notes');
    console.log('  --score <0-100>    Manual workflow score');
    console.log('  --certainty <A-D>  Certainty level\n');
    
    console.log(`${colors.bright}EXAMPLES${colors.reset}`);
    console.log('  # Certify Clery Act as gold standard');
    console.log('  node scripts/console-version-cli.js certify REG-001 --score 100 --by "admin"\n');
    
    console.log('  # Rollback Title IX to previous version');
    console.log('  node scripts/console-version-cli.js rollback REG-002 v1.0 --reason "Bug in v1.1"\n');
    
    console.log('  # List all versions for FERPA');
    console.log('  node scripts/console-version-cli.js list REG-004\n');
    
    console.log('  # Show all active gold standards');
    console.log('  node scripts/console-version-cli.js active\n');
    
    console.log('  # Verify integrity of stored version');
    console.log('  node scripts/console-version-cli.js verify REG-001\n');
}

// Main
async function main() {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        showHelp();
        process.exit(0);
    }
    
    try {
        switch (command) {
            case 'certify':
                await certify(args[1]);
                break;
            case 'rollback':
                await rollback(args[1], args[2]);
                break;
            case 'list':
                await list(args[1]);
                break;
            case 'active':
                await active(args[1]);
                break;
            case 'verify':
                await verify(args[1], args[2]);
                break;
            case 'audit':
                await audit(args[1]);
                break;
            case 'status':
                await status();
                break;
            default:
                printError(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (err) {
        printError(`Fatal error: ${err.message}`);
        console.error(err);
        process.exit(1);
    }
    
    process.exit(0);
}

main();
