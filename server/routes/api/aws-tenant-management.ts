import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();
const execAsync = promisify(exec);

// Admin authentication middleware
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
};

interface TenantDeploymentConfig {
    tenantId: string;
    institutionName: string;
    domain: string;
    databaseUrl: string;
    sessionSecret: string;
    port?: number;
    nodeEnv?: string;
    additionalEnvVars?: Record<string, string>;
}

interface AWSInfrastructure {
    clusterId: string;
    serviceId: string;
    taskDefinitionArn: string;
    targetGroupArn: string;
    listenerRuleArn?: string;
}

// In-memory storage for tenant deployments (in production, this would be in a database)
const deployedTenants: Map<string, {
    config: TenantDeploymentConfig;
    infrastructure: AWSInfrastructure;
    status: 'provisioning' | 'active' | 'failed' | 'stopping' | 'stopped';
    lastUpdated: Date;
}> = new Map();

/**
 * GET /api/aws-tenant-management/tenants - List all managed tenants
 */
router.get('/tenants', requireAdmin, async (req, res) => {
    try {
        const tenants = Array.from(deployedTenants.entries()).map(([tenantId, data]) => ({
            id: tenantId,
            institutionName: data.config.institutionName,
            domain: data.config.domain,
            status: data.status,
            lastUpdated: data.lastUpdated,
            infrastructure: {
                clusterId: data.infrastructure.clusterId,
                serviceId: data.infrastructure.serviceId,
                hasTaskDefinition: !!data.infrastructure.taskDefinitionArn,
                hasTargetGroup: !!data.infrastructure.targetGroupArn,
                hasListenerRule: !!data.infrastructure.listenerRuleArn
            }
        }));

        res.json({
            success: true,
            tenants
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to list tenants',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * POST /api/aws-tenant-management/tenants - Create new tenant deployment
 */
router.post('/tenants', requireAdmin, async (req, res) => {
    try {
        const {
            tenantId,
            institutionName,
            domain,
            databaseUrl,
            sessionSecret,
            port = 3000,
            nodeEnv = 'production',
            additionalEnvVars = {}
        } = req.body;

        // Validate required fields
        if (!tenantId || !institutionName || !domain || !databaseUrl || !sessionSecret) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'tenantId, institutionName, domain, databaseUrl, and sessionSecret are required'
            });
        }

        // Check if tenant already exists
        if (deployedTenants.has(tenantId)) {
            return res.status(409).json({
                error: 'Tenant already exists',
                message: `Tenant ${tenantId} is already deployed`
            });
        }

        const config: TenantDeploymentConfig = {
            tenantId,
            institutionName,
            domain,
            databaseUrl,
            sessionSecret,
            port,
            nodeEnv,
            additionalEnvVars
        };

        // Initialize tenant record
        deployedTenants.set(tenantId, {
            config,
            infrastructure: {
                clusterId: '',
                serviceId: '',
                taskDefinitionArn: '',
                targetGroupArn: '',
            },
            status: 'provisioning',
            lastUpdated: new Date()
        });

        // Start provisioning process asynchronously
        provisionTenantInfrastructure(tenantId, config).catch(error => {
            console.error(`Failed to provision tenant ${tenantId}:`, error);
            const tenant = deployedTenants.get(tenantId);
            if (tenant) {
                tenant.status = 'failed';
                tenant.lastUpdated = new Date();
            }
        });

        res.status(202).json({
            success: true,
            message: `Tenant ${tenantId} provisioning started`,
            tenantId,
            status: 'provisioning'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create tenant',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * GET /api/aws-tenant-management/tenants/:tenantId - Get tenant details
 */
router.get('/tenants/:tenantId', requireAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = deployedTenants.get(tenantId);

        if (!tenant) {
            return res.status(404).json({
                error: 'Tenant not found',
                message: `Tenant ${tenantId} not found`
            });
        }

        // Get current ECS service status
        let serviceStatus = 'unknown';
        try {
            const { stdout } = await execAsync(`aws ecs describe-services --cluster ${tenant.infrastructure.clusterId} --services ${tenant.infrastructure.serviceId} --query 'services[0].status' --output text`);
            serviceStatus = stdout.trim();
        } catch (error) {
            console.warn(`Failed to get service status for ${tenantId}:`, error);
        }

        res.json({
            success: true,
            tenant: {
                id: tenantId,
                config: {
                    institutionName: tenant.config.institutionName,
                    domain: tenant.config.domain,
                    port: tenant.config.port,
                    nodeEnv: tenant.config.nodeEnv,
                    additionalEnvVars: tenant.config.additionalEnvVars
                },
                infrastructure: tenant.infrastructure,
                status: tenant.status,
                serviceStatus,
                lastUpdated: tenant.lastUpdated
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get tenant details',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * DELETE /api/aws-tenant-management/tenants/:tenantId - Delete tenant deployment
 */
router.delete('/tenants/:tenantId', requireAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = deployedTenants.get(tenantId);

        if (!tenant) {
            return res.status(404).json({
                error: 'Tenant not found',
                message: `Tenant ${tenantId} not found`
            });
        }

        // Set status to stopping
        tenant.status = 'stopping';
        tenant.lastUpdated = new Date();

        // Start deprovisioning process asynchronously
        deprovisionTenantInfrastructure(tenantId, tenant.infrastructure).catch(error => {
            console.error(`Failed to deprovision tenant ${tenantId}:`, error);
        });

        res.json({
            success: true,
            message: `Tenant ${tenantId} deprovisioning started`,
            tenantId,
            status: 'stopping'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete tenant',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * POST /api/aws-tenant-management/tenants/:tenantId/restart - Restart tenant service
 */
router.post('/tenants/:tenantId/restart', requireAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = deployedTenants.get(tenantId);

        if (!tenant) {
            return res.status(404).json({
                error: 'Tenant not found',
                message: `Tenant ${tenantId} not found`
            });
        }

        // Force new deployment
        const { stdout, stderr } = await execAsync(`aws ecs update-service --cluster ${tenant.infrastructure.clusterId} --service ${tenant.infrastructure.serviceId} --force-new-deployment`);

        if (stderr) {
            console.warn(`ECS update-service stderr for ${tenantId}:`, stderr);
        }

        tenant.lastUpdated = new Date();

        res.json({
            success: true,
            message: `Tenant ${tenantId} restart initiated`,
            tenantId,
            output: stdout
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to restart tenant',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * GET /api/aws-tenant-management/tenants/:tenantId/logs - Get tenant logs
 */
router.get('/tenants/:tenantId/logs', requireAdmin, async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = deployedTenants.get(tenantId);

        if (!tenant) {
            return res.status(404).json({
                error: 'Tenant not found',
                message: `Tenant ${tenantId} not found`
            });
        }

        // Get logs from CloudWatch
        const logGroupName = `/ecs/${tenant.infrastructure.clusterId}`;
        const { stdout } = await execAsync(`aws logs describe-log-streams --log-group-name ${logGroupName} --order-by LastEventTime --descending --max-items 1 --query 'logStreams[0].logStreamName' --output text`);

        const logStreamName = stdout.trim();

        if (logStreamName && logStreamName !== 'None') {
            const { stdout: logOutput } = await execAsync(`aws logs get-log-events --log-group-name ${logGroupName} --log-stream-name ${logStreamName} --limit 100 --query 'events[].[timestamp,message]' --output json`);

            const logs = JSON.parse(logOutput);

            res.json({
                success: true,
                tenantId,
                logs: logs.map(([timestamp, message]: [number, string]) => ({
                    timestamp: new Date(timestamp),
                    message: message.trim()
                }))
            });
        } else {
            res.json({
                success: true,
                tenantId,
                logs: [],
                message: 'No logs found'
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get tenant logs',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Internal function to provision tenant infrastructure
async function provisionTenantInfrastructure(tenantId: string, config: TenantDeploymentConfig) {
    const tenant = deployedTenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    try {
        // Step 1: Create ECS cluster
        const clusterName = `edsteward-${tenantId}-cluster`;
        await execAsync(`aws ecs create-cluster --cluster-name ${clusterName}`);
        tenant.infrastructure.clusterId = clusterName;

        // Step 2: Create target group
        const targetGroupName = `edsteward-${tenantId}-tg`;
        const { stdout: tgOutput } = await execAsync(`aws elbv2 create-target-group --name ${targetGroupName} --protocol HTTP --port 3000 --vpc-id vpc-041c944b5c7d7b97d --health-check-path /health --health-check-interval-seconds 30 --health-check-timeout-seconds 5 --healthy-threshold-count 2 --unhealthy-threshold-count 3 --query 'TargetGroups[0].TargetGroupArn' --output text`);
        tenant.infrastructure.targetGroupArn = tgOutput.trim();

        // Step 3: Create task definition
        const taskDefinition = createTaskDefinition(tenantId, config);
        const taskDefPath = path.join(__dirname, '../../temp', `${tenantId}-task-definition.json`);

        // Ensure temp directory exists
        const tempDir = path.dirname(taskDefPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(taskDefPath, JSON.stringify(taskDefinition, null, 2));

        const { stdout: taskDefOutput } = await execAsync(`aws ecs register-task-definition --cli-input-json file://${taskDefPath}`);
        const taskDefArn = JSON.parse(taskDefOutput).taskDefinition.taskDefinitionArn;
        tenant.infrastructure.taskDefinitionArn = taskDefArn;

        // Step 4: Create ECS service
        const serviceName = `edsteward-${tenantId}-service`;
        await execAsync(`aws ecs create-service --cluster ${clusterName} --service-name ${serviceName} --task-definition ${taskDefArn} --desired-count 1 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[subnet-0d3f65a1b8e7c9f2a,subnet-0e4f76b2c9d8a0e3b],securityGroups=[sg-0a1b2c3d4e5f6],assignPublicIp=ENABLED}" --load-balancers "targetGroupArn=${tenant.infrastructure.targetGroupArn},containerName=edsteward-${tenantId},containerPort=3000"`);
        tenant.infrastructure.serviceId = serviceName;

        // Step 5: Create ALB listener rule
        const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:259661441422:listener/app/edsteward-alb/f0c8e7d6a5b4c3d2/a1b2c3d4e5f6';
        const { stdout: ruleOutput } = await execAsync(`aws elbv2 create-rule --listener-arn ${listenerArn} --priority ${await getNextPriority()} --conditions Field=host-header,Values=${config.domain} --actions Type=forward,TargetGroupArn=${tenant.infrastructure.targetGroupArn} --query 'Rules[0].RuleArn' --output text`);
        tenant.infrastructure.listenerRuleArn = ruleOutput.trim();

        // Clean up temp file
        fs.unlinkSync(taskDefPath);

        // Update status
        tenant.status = 'active';
        tenant.lastUpdated = new Date();

        console.log(`✅ Successfully provisioned tenant ${tenantId}`);
    } catch (error) {
        console.error(`❌ Failed to provision tenant ${tenantId}:`, error);
        tenant.status = 'failed';
        tenant.lastUpdated = new Date();
        throw error;
    }
}

// Internal function to deprovision tenant infrastructure
async function deprovisionTenantInfrastructure(tenantId: string, infrastructure: AWSInfrastructure) {
    try {
        // Delete in reverse order

        // Step 1: Delete ALB listener rule
        if (infrastructure.listenerRuleArn) {
            await execAsync(`aws elbv2 delete-rule --rule-arn ${infrastructure.listenerRuleArn}`);
        }

        // Step 2: Delete ECS service
        if (infrastructure.serviceId && infrastructure.clusterId) {
            await execAsync(`aws ecs update-service --cluster ${infrastructure.clusterId} --service ${infrastructure.serviceId} --desired-count 0`);
            await execAsync(`aws ecs delete-service --cluster ${infrastructure.clusterId} --service ${infrastructure.serviceId}`);
        }

        // Step 3: Delete target group
        if (infrastructure.targetGroupArn) {
            await execAsync(`aws elbv2 delete-target-group --target-group-arn ${infrastructure.targetGroupArn}`);
        }

        // Step 4: Delete ECS cluster
        if (infrastructure.clusterId) {
            await execAsync(`aws ecs delete-cluster --cluster ${infrastructure.clusterId}`);
        }

        // Step 5: Deregister task definition (optional, they don't cost anything)
        // Task definitions can't be deleted, only deregistered

        // Remove from memory
        deployedTenants.delete(tenantId);

        console.log(`✅ Successfully deprovisioned tenant ${tenantId}`);
    } catch (error) {
        console.error(`❌ Failed to deprovision tenant ${tenantId}:`, error);
        throw error;
    }
}

// Helper function to create task definition
function createTaskDefinition(tenantId: string, config: TenantDeploymentConfig) {
    const environmentVariables = [
        { name: 'NODE_ENV', value: config.nodeEnv },
        { name: 'PORT', value: config.port.toString() },
        { name: 'MULTI_TENANT', value: 'false' },
        { name: 'INSTITUTION_NAME', value: config.institutionName },
        { name: 'DATABASE_URL', value: config.databaseUrl },
        { name: 'SESSION_SECRET', value: config.sessionSecret },
        ...Object.entries(config.additionalEnvVars || {}).map(([name, value]) => ({ name, value }))
    ];

    return {
        family: `edsteward-${tenantId}`,
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: '256',
        memory: '512',
        executionRoleArn: 'arn:aws:iam::259661441422:role/ecsTaskExecutionRole',
        taskRoleArn: 'arn:aws:iam::259661441422:role/ecsTaskRole',
        containerDefinitions: [
            {
                name: `edsteward-${tenantId}`,
                image: '259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:latest',
                portMappings: [
                    {
                        containerPort: 3000,
                        protocol: 'tcp'
                    }
                ],
                environment: environmentVariables,
                logConfiguration: {
                    logDriver: 'awslogs',
                    options: {
                        'awslogs-group': `/ecs/edsteward-${tenantId}-cluster`,
                        'awslogs-region': 'us-east-1',
                        'awslogs-stream-prefix': 'ecs'
                    }
                },
                essential: true,
                healthCheck: {
                    command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
                    interval: 30,
                    timeout: 5,
                    retries: 3,
                    startPeriod: 60
                }
            }
        ]
    };
}

// Helper function to get next available priority for ALB listener rules
async function getNextPriority(): Promise<number> {
    try {
        const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:259661441422:listener/app/edsteward-alb/f0c8e7d6a5b4c3d2/a1b2c3d4e5f6';
        const { stdout } = await execAsync(`aws elbv2 describe-rules --listener-arn ${listenerArn} --query 'Rules[].Priority' --output json`);
        const priorities = JSON.parse(stdout).filter((p: string) => p !== 'default').map((p: string) => parseInt(p));
        const maxPriority = Math.max(...priorities, 0);
        return maxPriority + 1;
    } catch (error) {
        console.warn('Failed to get next priority, using default:', error);
        return 1000; // Default priority
    }
}

export default router; 