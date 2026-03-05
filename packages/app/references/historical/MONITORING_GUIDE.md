# EdSteward Monitoring & Alerting Guide

## 🎯 Overview

This guide covers the comprehensive monitoring and alerting infrastructure for EdSteward. The monitoring system provides real-time visibility into application performance, security, and operational metrics.

## 📊 Monitoring Architecture

### Components
- **CloudWatch Metrics**: AWS service metrics (ECS, ALB, RDS)
- **Custom Metrics**: Application-specific metrics from logs
- **CloudWatch Alarms**: Automated alerting based on thresholds
- **CloudWatch Dashboard**: Visual monitoring interface
- **SNS Alerts**: Email notifications for critical issues
- **Log Monitoring**: Real-time log analysis and alerting

### Key Metrics Monitored

#### Infrastructure Metrics
- **ECS Service**: CPU, Memory, Running Tasks
- **Load Balancer**: Response time, Error rates, Health status
- **Database**: Connection health, Performance metrics
- **Network**: Request counts, Traffic patterns

#### Application Metrics
- **Authentication**: Failed login attempts, Security events
- **Database**: Connection errors, Query performance
- **Regulation Updates**: Update failures, Processing errors
- **Performance**: Slow requests, Response times
- **Security**: Tenant isolation violations, Access violations

---

## 🚀 Getting Started

### 1. Deploy Monitoring Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure/terraform

# Update terraform.tfvars with your alert email
echo 'alert_email = "your-email@company.com"' >> terraform.tfvars

# Apply monitoring configuration
terraform apply
```

### 2. Confirm Email Subscription

After deployment, you'll receive an email to confirm your SNS subscription:
1. Check your email for "AWS Notification - Subscription Confirmation"
2. Click the confirmation link
3. You'll now receive CloudWatch alerts

### 3. Access the Dashboard

```bash
# Get dashboard URL
terraform output cloudwatch_dashboard_url

# Open in browser
open "$(terraform output -raw cloudwatch_dashboard_url)"
```

---

## 📋 Monitoring Dashboard

### Dashboard Sections

#### 1. ECS Service Metrics
- **CPU Utilization**: Application CPU usage
- **Memory Utilization**: Application memory usage
- **Running Task Count**: Number of active containers

#### 2. Load Balancer Metrics
- **Request Count**: Total requests per minute
- **Response Time**: Average response time
- **HTTP Status Codes**: Success/error rates

#### 3. Health Check Status
- **Healthy Hosts**: Number of healthy containers
- **Unhealthy Hosts**: Number of failed containers

#### 4. Recent Application Logs
- **Real-time Logs**: Latest 50 log entries
- **Error Filtering**: Highlighted error messages

---

## 🚨 Alert Configuration

### Alert Types

#### Infrastructure Alerts
| Alert | Threshold | Description |
|-------|-----------|-------------|
| **High CPU** | >80% for 10 minutes | ECS service CPU usage |
| **High Memory** | >80% for 10 minutes | ECS service memory usage |
| **Low Running Tasks** | <1 tasks | Service availability |
| **High Response Time** | >2 seconds | Application performance |
| **5xx Errors** | >5 errors in 5 minutes | Application errors |
| **Unhealthy Hosts** | >0 unhealthy hosts | Health check failures |

#### Application Alerts
| Alert | Threshold | Description |
|-------|-----------|-------------|
| **Authentication Failures** | >10 failures in 5 minutes | Security concern |
| **Database Connection Errors** | >3 errors in 5 minutes | Database issues |
| **Regulation Update Failures** | >5 failures in 5 minutes | Core functionality |
| **Slow Requests** | >10 requests >2s in 5 minutes | Performance degradation |
| **Tenant Isolation Violations** | >0 violations | Critical security |

### Alert Severity Levels

#### 🔴 Critical (Immediate Action Required)
- **Tenant Isolation Violations**: Security breach
- **Database Connection Errors**: Service unavailable
- **Unhealthy Hosts**: Service degradation

#### 🟡 Warning (Monitor and Plan)
- **High CPU/Memory**: Resource constraints
- **Slow Requests**: Performance issues
- **Authentication Failures**: Potential security concern

#### 🔵 Info (Awareness)
- **Regulation Update Failures**: Feature degradation
- **5xx Errors**: Application errors

---

## 📈 Performance Monitoring

### Key Performance Indicators (KPIs)

#### Response Time Targets
- **API Requests**: <500ms average
- **Page Loads**: <2s average
- **Database Queries**: <100ms average

#### Availability Targets
- **Uptime**: 99.9% (8.77 hours downtime/year)
- **Success Rate**: >99.5% (HTTP 2xx responses)
- **Health Check**: 100% healthy hosts

#### Resource Utilization
- **CPU**: <70% average, <90% peak
- **Memory**: <80% average, <95% peak
- **Database Connections**: <80% of pool

### Performance Analysis

```bash
# Check current performance metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=edsteward-service \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 300 \
  --statistics Average

# View recent application logs
aws logs tail /aws/ecs/edsteward --follow
```

---

## 🔍 Troubleshooting Guide

### Common Alert Scenarios

#### High CPU Usage
```bash
# 1. Check current tasks
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service

# 2. Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=edsteward-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# 3. Scale up if needed
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --desired-count 2
```

#### Database Connection Errors
```bash
# 1. Check database health
curl https://edsteward.ai/health

# 2. Review database logs
aws logs tail /aws/ecs/edsteward --follow | grep -i database

# 3. Check database connection pool
aws rds describe-db-instances --db-instance-identifier edsteward-db
```

#### Authentication Failures
```bash
# 1. Check recent authentication logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/edsteward \
  --filter-pattern "Authentication failed" \
  --start-time $(date -d '1 hour ago' +%s)000

# 2. Check for brute force attacks
aws logs filter-log-events \
  --log-group-name /aws/ecs/edsteward \
  --filter-pattern "[timestamp, level=\"ERROR\", message=\"Authentication failed*\"]" \
  --start-time $(date -d '1 hour ago' +%s)000
```

---

## 🛠️ Custom Monitoring

### Adding Custom Metrics

#### 1. Application Code
```typescript
// Add to your application code
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

async function recordCustomMetric(metricName: string, value: number) {
  await cloudwatch.putMetricData({
    Namespace: 'EdSteward/Custom',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: 'Count',
      Timestamp: new Date()
    }]
  }).promise();
}

// Example usage
await recordCustomMetric('UserRegistrations', 1);
await recordCustomMetric('RegulationUpdates', 1);
```

#### 2. Log-based Metrics
```hcl
# Add to monitoring.tf
resource "aws_cloudwatch_log_metric_filter" "user_registrations" {
  name           = "user-registrations"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, level=\"INFO\", message=\"User registered*\"]"

  metric_transformation {
    name      = "UserRegistrations"
    namespace = "EdSteward/Custom"
    value     = "1"
  }
}
```

#### 3. Custom Alarms
```hcl
resource "aws_cloudwatch_metric_alarm" "user_registrations_low" {
  alarm_name          = "user-registrations-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UserRegistrations"
  namespace           = "EdSteward/Custom"
  period              = "3600"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Low user registration activity"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

---

## 📱 Mobile Monitoring

### AWS Mobile App
1. Download "AWS Console" mobile app
2. Configure with your AWS credentials
3. Set up CloudWatch notifications
4. Monitor critical metrics on-the-go

### SNS SMS Alerts
```hcl
# Add to monitoring.tf for SMS alerts
resource "aws_sns_topic_subscription" "sms_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "sms"
  endpoint  = "+1234567890"  # Your phone number
}
```

---

## 📊 Monitoring Best Practices

### 1. Alert Fatigue Prevention
- **Use appropriate thresholds**: Avoid too many false positives
- **Set evaluation periods**: Allow time for temporary spikes
- **Group related alerts**: Use composite alarms when possible

### 2. Monitoring Hierarchy
```
Critical → Immediate response (5 minutes)
Warning → Response within 1 hour
Info → Review within 24 hours
```

### 3. Regular Reviews
- **Weekly**: Review dashboard and trends
- **Monthly**: Analyze performance patterns
- **Quarterly**: Adjust thresholds and add new metrics

### 4. Documentation
- **Runbooks**: Document response procedures
- **Post-mortems**: Learn from incidents
- **Metrics catalog**: Maintain list of all metrics

---

## 🔧 Monitoring Maintenance

### Monthly Tasks
```bash
# Check alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name edsteward-ecs-cpu-high \
  --start-date $(date -d '1 month ago' +%Y-%m-%d)

# Review metric filters
aws logs describe-metric-filters \
  --log-group-name /aws/ecs/edsteward

# Cleanup old log data
aws logs delete-log-group --log-group-name /aws/ecs/edsteward-old
```

### Quarterly Reviews
- **Threshold Tuning**: Adjust alarm thresholds based on patterns
- **New Metrics**: Add monitoring for new features
- **Cost Optimization**: Review CloudWatch costs
- **Performance Baseline**: Update performance expectations

---

## 🎯 Monitoring Metrics Reference

### AWS Service Metrics

#### ECS Service Metrics
- `CPUUtilization`: Percentage CPU usage
- `MemoryUtilization`: Percentage memory usage
- `RunningTaskCount`: Number of healthy tasks
- `PendingTaskCount`: Number of pending tasks

#### ALB Metrics
- `RequestCount`: Total requests
- `TargetResponseTime`: Average response time
- `HTTPCode_Target_2XX_Count`: Successful responses
- `HTTPCode_Target_4XX_Count`: Client errors
- `HTTPCode_Target_5XX_Count`: Server errors
- `HealthyHostCount`: Number of healthy targets
- `UnHealthyHostCount`: Number of unhealthy targets

### Custom Application Metrics
- `AuthenticationFailures`: Failed login attempts
- `DatabaseConnectionErrors`: Database connection issues
- `RegulationUpdateFailures`: Update processing errors
- `SlowRequests`: Requests exceeding time threshold
- `TenantIsolationViolations`: Security violations

---

## 🆘 Emergency Procedures

### Incident Response Checklist

#### 1. Immediate Assessment (0-5 minutes)
- [ ] Acknowledge the alert
- [ ] Check the dashboard for context
- [ ] Verify the scope of the issue
- [ ] Initiate incident response if needed

#### 2. Containment (5-15 minutes)
- [ ] Scale resources if needed
- [ ] Rollback if recent deployment
- [ ] Enable additional logging
- [ ] Communicate status to stakeholders

#### 3. Investigation (15-60 minutes)
- [ ] Analyze logs and metrics
- [ ] Identify root cause
- [ ] Document findings
- [ ] Implement temporary fixes

#### 4. Resolution (Variable)
- [ ] Implement permanent fix
- [ ] Verify resolution
- [ ] Update monitoring if needed
- [ ] Conduct post-incident review

---

## 📚 Additional Resources

### AWS Documentation
- [CloudWatch User Guide](https://docs.aws.amazon.com/cloudwatch/)
- [ECS Monitoring](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-metrics.html)
- [ALB Monitoring](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-monitoring.html)

### Terraform Resources
- [CloudWatch Alarms](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm)
- [Log Metric Filters](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_log_metric_filter)
- [SNS Topics](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic)

### Commands Quick Reference
```bash
# View dashboard
terraform output cloudwatch_dashboard_url

# Check all alarms
aws cloudwatch describe-alarms

# View recent logs
aws logs tail /aws/ecs/edsteward --follow

# Check service health
curl https://edsteward.ai/health

# Scale ECS service
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --desired-count 2
```

---

*Last updated: December 2024* 