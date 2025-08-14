import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export default class RegulationVersioningService {
    constructor() {
        this.cache = null;
        this.cacheExpiry = null;
        this.cacheDuration = 10 * 60 * 1000; // 10 minutes cache for regulation data
    }

    async getRegulationVersionInfo() {
        // Check cache
        if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
            console.log('📋 Serving cached regulation versioning data');
            return this.cache;
        }

        console.log('🔄 Fetching real TEACH Act regulation versioning data...');

        try {
            // Get current USC 17 Section 110 version by checking last modification
            const currentRegulationData = await this.getCurrentRegulationVersion();
            
            // Get CFR regulation version status  
            const cfrVersionData = await this.getCFRVersionStatus();
            
            // Get regulation deployment history
            const deploymentHistory = await this.getRegulationDeploymentHistory();
            
            // Check for regulation updates/changes
            const updateActivity = await this.getRegulationUpdateActivity();

            const regulationVersionData = {
                currentRegulation: {
                    version: currentRegulationData.version,
                    lastUpdated: currentRegulationData.lastUpdated,
                    status: 'DEPLOYED',
                    sources: {
                        usc: currentRegulationData.uscStatus,
                        cfr: cfrVersionData.status,
                        copyrightOffice: cfrVersionData.copyrightOfficeStatus
                    }
                },
                stagingRegulation: {
                    version: await this.getStagingRegulationVersion(),
                    status: 'MONITORING',
                    note: 'Monitoring for USC/CFR changes',
                    lastCheck: new Date().toISOString()
                },
                customerDistribution: {
                    note: "Customer regulation sync requires real customer database",
                    displayMessage: "Connect customer database to track regulation distribution"
                },
                updateActivity: updateActivity,
                regulationSources: {
                    usc17_110: {
                        lastFetched: currentRegulationData.lastFetched,
                        source: 'uscode.house.gov',
                        status: 'active'
                    },
                    cfrGuidance: {
                        lastFetched: cfrVersionData.lastFetched,
                        source: 'copyright.gov',
                        status: 'active'
                    }
                },
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    source: 'Real regulation monitoring system',
                    isReal: true,
                    type: 'regulation_versioning'
                }
            };

            // Cache the result
            this.cache = regulationVersionData;
            this.cacheExpiry = Date.now() + this.cacheDuration;

            console.log(`✅ Real regulation versioning data fetched - Current: ${currentRegulationData.version}`);
            return regulationVersionData;

        } catch (error) {
            console.error('❌ Error fetching regulation versioning data:', error);
            throw error;
        }
    }

    async getCurrentRegulationVersion() {
        // Generate regulation version based on last USC/CFR fetch timestamps
        try {
            // Get USC data to determine version
            const { default: USCService } = await import('./usc-service.js');
            const uscService = new USCService();
            const uscData = await uscService.fetchUSC17Section110();
            
            // Create version based on USC content hash
            const contentHash = this.generateContentHash(uscData.content);
            const shortHash = contentHash.substring(0, 8);
            const version = `REG-110.${shortHash}`;
            
            return {
                version: version,
                lastUpdated: uscData.metadata.lastFetched || new Date().toISOString(),
                lastFetched: uscData.metadata.lastFetched || new Date().toISOString(),
                uscStatus: 'current',
                contentHash: contentHash
            };
        } catch (error) {
            console.warn('Could not fetch USC data for versioning, using fallback');
            return {
                version: 'REG-110.unknown',
                lastUpdated: new Date().toISOString(),
                lastFetched: new Date().toISOString(),
                uscStatus: 'error',
                contentHash: 'unknown'
            };
        }
    }

    async getCFRVersionStatus() {
        try {
            // Get CFR data to check version
            const { default: CFRService } = await import('./cfr-service.js');
            const cfrService = new CFRService();
            const cfrData = await cfrService.fetchTeachActGuidance();
            
            return {
                status: 'current',
                lastFetched: cfrData.metadata.lastFetched,
                copyrightOfficeStatus: 'active'
            };
        } catch (error) {
            console.warn('Could not fetch CFR data for versioning');
            return {
                status: 'error',
                lastFetched: new Date().toISOString(),
                copyrightOfficeStatus: 'unknown'
            };
        }
    }

    async getStagingRegulationVersion() {
        // For staging, we increment the current version or indicate monitoring status
        try {
            const current = await this.getCurrentRegulationVersion();
            // Since we're monitoring for changes, staging version is "next" when changes detected
            return `${current.version}.staging`;
        } catch {
            return 'REG-110.staging';
        }
    }

    async getRegulationDeploymentHistory() {
        // Get real deployment history from git commits related to regulation updates
        try {
            const gitLog = execSync('git log --oneline -10 --grep="USC\\|CFR\\|regulation\\|TEACH" --format="%ad|%s" --date=short', { encoding: 'utf8' });
            if (gitLog.trim()) {
                const lines = gitLog.trim().split('\n');
                return lines.slice(0, 5).map(line => {
                    const [date, ...messageParts] = line.split('|');
                    const message = messageParts.join('|');
                    return {
                        date: date,
                        event: message,
                        type: 'regulation_update'
                    };
                });
            }
        } catch (error) {
            console.warn('Could not get regulation deployment history from git');
        }
        
        return [{
            date: new Date().toISOString().split('T')[0],
            event: 'Regulation monitoring system active',
            type: 'system_status'
        }];
    }

    async getRegulationUpdateActivity() {
        // Get recent regulation-related activity
        const activity = [];
        const now = new Date();
        
        // Check USC service activity
        try {
            const { default: USCService } = await import('./usc-service.js');
            const uscService = new USCService();
            const uscData = await uscService.fetchUSC17Section110();
            
            activity.push({
                timestamp: uscData.metadata.lastFetched,
                date: new Date(uscData.metadata.lastFetched).toISOString().split('T')[0],
                time: new Date(uscData.metadata.lastFetched).toTimeString().split(' ')[0].substring(0, 5),
                action: 'Fetched',
                detail: `USC 17 Section 110 content validated (confidence: ${uscData.metadata.confidence}%)`
            });
        } catch (error) {
            activity.push({
                timestamp: now.toISOString(),
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].substring(0, 5),
                action: 'Error',
                detail: 'USC 17 Section 110 fetch failed - check source availability'
            });
        }

        // Check CFR service activity
        try {
            const { default: CFRService } = await import('./cfr-service.js');
            const cfrService = new CFRService();
            const cfrData = await cfrService.fetchTeachActGuidance();
            
            activity.push({
                timestamp: cfrData.metadata.lastFetched,
                date: new Date(cfrData.metadata.lastFetched).toISOString().split('T')[0],
                time: new Date(cfrData.metadata.lastFetched).toTimeString().split(' ')[0].substring(0, 5),
                action: 'Validated',
                detail: `CFR TEACH Act guidance current (confidence: ${cfrData.metadata.confidence}%)`
            });
        } catch (error) {
            activity.push({
                timestamp: now.toISOString(),
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].substring(0, 5),
                action: 'Error',
                detail: 'CFR guidance fetch failed - check Copyright Office availability'
            });
        }

        return activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    generateContentHash(content) {
        // Simple hash for content versioning
        let hash = 0;
        if (content.length === 0) return hash.toString();
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    // Health check method
    getServiceHealth() {
        return {
            status: 'healthy',
            details: {
                cacheStatus: this.cache ? 'active' : 'empty',
                cacheExpiry: this.cacheExpiry,
                lastGenerated: this.cache?.metadata?.lastUpdated || null,
                type: 'regulation_versioning'
            }
        };
    }
}
