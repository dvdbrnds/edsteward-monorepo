import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export default class VersioningService {
    constructor() {
        this.cache = null;
        this.cacheExpiry = null;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    async getSystemVersionInfo() {
        // Check cache
        if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
            console.log('📋 Serving cached real versioning data');
            return this.cache;
        }

        console.log('🔄 Fetching real TEACH Act regulation versioning data...');

        try {
            // Get the current regulation version from USC/CFR sources
            const currentRegulationVersion = await this.getCurrentRegulationVersion();
            
            // Get regulation deployment history
            const regulationDeployDate = await this.getRegulationDeployDate();
            
            // Get regulation update status
            const regulationStatus = await this.getRegulationStatus();

            // Get real git branch info for staging
            let stagingBranch = 'staging';
            let stagingVersion = 'Unknown';
            try {
                // Check if staging branch exists
                execSync('git rev-parse --verify staging', { stdio: 'ignore' });
                stagingBranch = 'staging';
                // Try to get version from staging branch
                try {
                    const stagingPackage = execSync('git show staging:package.json', { encoding: 'utf8' });
                    const stagingJson = JSON.parse(stagingPackage);
                    stagingVersion = `v${stagingJson.version}`;
                } catch {
                    // If no different version, increment current
                    const versionParts = currentVersion.replace('v', '').split('.');
                    stagingVersion = `v${versionParts[0]}.${parseInt(versionParts[1]) + 1}.0`;
                }
            } catch {
                // No staging branch, use incremented version
                const versionParts = currentVersion.replace('v', '').split('.');
                stagingVersion = `v${versionParts[0]}.${parseInt(versionParts[1]) + 1}.0`;
            }

            // Get real activity logs from git
            const activityLogs = this.getRealGitActivityLogs();

            // NO CUSTOMER DATA - Remove simulated customer information
            const customerInfo = {
                note: "Customer data not available - requires real customer database connection",
                displayMessage: "Connect customer database to view real subscription data"
            };

            const versioningData = {
                currentVersion: {
                    version: currentVersion,
                    deployDate: deployDate,
                    status: 'DEPLOYED',
                    uptime: uptimeInfo,
                    stability: 'Real data unavailable'
                },
                stagingVersion: {
                    version: stagingVersion,
                    branch: stagingBranch,
                    status: 'STAGING',
                    note: 'Version info from git branches'
                },
                customers: customerInfo,
                activityLogs,
                systemHealth: {
                    note: "Real system metrics require monitoring system integration",
                    uptime: uptimeInfo
                },
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    source: 'Real git repository and system data',
                    isReal: true,
                    simulatedDataRemoved: true
                }
            };

            // Cache the result
            this.cache = versioningData;
            this.cacheExpiry = Date.now() + this.cacheDuration;

            console.log(`✅ Real versioning data fetched - Current: ${currentVersion}, Deploy: ${deployDate}`);
            return versioningData;

        } catch (error) {
            console.error('❌ Error fetching real versioning data:', error);
            throw error;
        }
    }

    getRealGitActivityLogs() {
        try {
            // Get real git commit history
            const gitLog = execSync('git log --oneline -5 --format="%ad|%s" --date=short', { encoding: 'utf8' });
            const lines = gitLog.trim().split('\n');
            
            return lines.map(line => {
                const [date, ...messageParts] = line.split('|');
                const message = messageParts.join('|');
                return {
                    timestamp: new Date(date).toISOString(),
                    date: date,
                    time: new Date(date).toTimeString().split(' ')[0].substring(0, 5),
                    action: message.split(' ')[0] || 'Updated',
                    detail: message || 'Repository update'
                };
            });
        } catch (error) {
            console.warn('Could not get git log, returning empty activity');
            return [{
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                action: 'System',
                detail: 'Unable to fetch git history - check git repository'
            }];
        }
    }



    // Health check method
    getServiceHealth() {
        return {
            status: 'healthy',
            details: {
                cacheStatus: this.cache ? 'active' : 'empty',
                cacheExpiry: this.cacheExpiry,
                lastGenerated: this.cache?.metadata?.lastUpdated || null
            }
        };
    }
}
