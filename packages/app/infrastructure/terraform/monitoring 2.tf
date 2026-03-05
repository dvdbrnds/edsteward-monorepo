# EdSteward Monitoring Configuration
# Comprehensive CloudWatch monitoring, alerting, and dashboards

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
  
  tags = local.common_tags
}

# SNS Topic Subscription (Email alerts)
resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Alarms for ECS Service
resource "aws_cloudwatch_metric_alarm" "ecs_service_cpu_high" {
  alarm_name          = "${var.project_name}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS service CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = module.ecs_service.name
    ClusterName = module.ecs_cluster.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_service_memory_high" {
  alarm_name          = "${var.project_name}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS service memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = module.ecs_service.name
    ClusterName = module.ecs_cluster.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_service_running_tasks_low" {
  alarm_name          = "${var.project_name}-ecs-running-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "This metric monitors ECS service running task count"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = module.ecs_service.name
    ClusterName = module.ecs_cluster.name
  }

  tags = local.common_tags
}

# CloudWatch Alarms for Application Load Balancer
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  alarm_name          = "${var.project_name}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2"
  alarm_description   = "This metric monitors ALB response time"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_http_5xx_errors" {
  alarm_name          = "${var.project_name}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors ALB 5xx errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.project_name}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "This metric monitors ALB unhealthy hosts"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  tags = local.common_tags
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", module.ecs_service.name, "ClusterName", module.ecs_cluster.name],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "RunningTaskCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Service Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", aws_lb.main.arn_suffix, "TargetGroup", aws_lb_target_group.app.arn_suffix],
            [".", "UnHealthyHostCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Health Check Status"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          query   = "SOURCE '/aws/ecs/${var.project_name}' | fields @timestamp, @message | sort @timestamp desc | limit 50"
          region  = var.aws_region
          title   = "Recent Application Logs"
          view    = "table"
        }
      }
    ]
  })
}

# Custom CloudWatch Metrics for Application Performance
resource "aws_cloudwatch_log_metric_filter" "authentication_failures" {
  name           = "${var.project_name}-authentication-failures"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, level=\"ERROR\", message=\"Authentication failed*\"]"

  metric_transformation {
    name      = "AuthenticationFailures"
    namespace = "EdSteward/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "authentication_failures_high" {
  alarm_name          = "${var.project_name}-auth-failures-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "AuthenticationFailures"
  namespace           = "EdSteward/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High number of authentication failures detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_log_metric_filter" "database_connection_errors" {
  name           = "${var.project_name}-database-connection-errors"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, level=\"ERROR\", message=\"Database connection failed*\"]"

  metric_transformation {
    name      = "DatabaseConnectionErrors"
    namespace = "EdSteward/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connection_errors_high" {
  alarm_name          = "${var.project_name}-db-connection-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DatabaseConnectionErrors"
  namespace           = "EdSteward/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "Multiple database connection errors detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_log_metric_filter" "regulation_update_failures" {
  name           = "${var.project_name}-regulation-update-failures"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, level=\"ERROR\", message=\"*regulation update failed*\"]"

  metric_transformation {
    name      = "RegulationUpdateFailures"
    namespace = "EdSteward/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "regulation_update_failures_high" {
  alarm_name          = "${var.project_name}-regulation-update-failures-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RegulationUpdateFailures"
  namespace           = "EdSteward/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Multiple regulation update failures detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# Performance Insights for Enhanced Monitoring
resource "aws_cloudwatch_log_metric_filter" "slow_requests" {
  name           = "${var.project_name}-slow-requests"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, level, message=\"*response time*\", ..., response_time>2000]"

  metric_transformation {
    name      = "SlowRequests"
    namespace = "EdSteward/Performance"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "slow_requests_high" {
  alarm_name          = "${var.project_name}-slow-requests-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SlowRequests"
  namespace           = "EdSteward/Performance"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High number of slow requests detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# Multi-tenant specific monitoring
resource "aws_cloudwatch_log_metric_filter" "tenant_isolation_violations" {
  name           = "${var.project_name}-tenant-isolation-violations"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, level=\"ERROR\", message=\"*tenant isolation*\"]"

  metric_transformation {
    name      = "TenantIsolationViolations"
    namespace = "EdSteward/Security"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "tenant_isolation_violations" {
  alarm_name          = "${var.project_name}-tenant-isolation-violations"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "TenantIsolationViolations"
  namespace           = "EdSteward/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Critical: Tenant isolation violation detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# Health Check Monitoring
resource "aws_cloudwatch_metric_alarm" "health_check_failures" {
  alarm_name          = "${var.project_name}-health-check-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Application health check failures"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

# Outputs for monitoring
output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.project_name}-dashboard"
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "monitoring_alarms" {
  description = "List of CloudWatch alarms created"
  value = [
    aws_cloudwatch_metric_alarm.ecs_service_cpu_high.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_service_memory_high.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_service_running_tasks_low.alarm_name,
    aws_cloudwatch_metric_alarm.alb_response_time_high.alarm_name,
    aws_cloudwatch_metric_alarm.alb_http_5xx_errors.alarm_name,
    aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.alarm_name,
    aws_cloudwatch_metric_alarm.authentication_failures_high.alarm_name,
    aws_cloudwatch_metric_alarm.database_connection_errors_high.alarm_name,
    aws_cloudwatch_metric_alarm.regulation_update_failures_high.alarm_name,
    aws_cloudwatch_metric_alarm.slow_requests_high.alarm_name,
    aws_cloudwatch_metric_alarm.tenant_isolation_violations.alarm_name,
    aws_cloudwatch_metric_alarm.health_check_failures.alarm_name
  ]
} 