# EdSteward Multi-Tenant ECS Deployment - Current Best Practices from Context7
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC Configuration using current best practices
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-vpc"
  cidr = "10.0.0.0/16"

  azs             = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = local.common_tags
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${var.project_name}"
  retention_in_days = 7
  tags = local.common_tags
}

# ECS Cluster using current best practices
module "ecs_cluster" {
  source  = "terraform-aws-modules/ecs/aws//modules/cluster"
  version = "~> 5.0"

  cluster_name = "${var.project_name}-cluster"

  cluster_configuration = {
    execute_command_configuration = {
      logging = "OVERRIDE"
      log_configuration = {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs.name
      }
    }
  }

  fargate_capacity_providers = {
    FARGATE = {
      default_capacity_provider_strategy = {
        weight = 50
        base   = 20
      }
    }
    FARGATE_SPOT = {
      default_capacity_provider_strategy = {
        weight = 50
      }
    }
  }

  tags = local.common_tags
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = false

  tags = local.common_tags
}

resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "front_end" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ECS Service using current best practices
module "ecs_service" {
  source  = "terraform-aws-modules/ecs/aws//modules/service"
  version = "~> 5.0"

  name        = "${var.project_name}-service"
  cluster_arn = module.ecs_cluster.arn

  cpu    = 1024
  memory = 2048

  # Container definition using current best practices
  container_definitions = {
    "${var.project_name}-app" = {
      cpu       = 1024
      memory    = 2048
      essential = true
      image     = "${var.ecr_repository_url}:multi-tenant-latest"
      
      port_mappings = [
        {
          name          = "app-port"
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "DATABASE_URL"
          value = var.database_url
        },
        {
          name  = "SESSION_SECRET"
          value = var.session_secret
        },
        {
          name  = "MULTI_TENANT"
          value = "true"
        }
      ]

      # Enable CloudWatch logging
      enable_cloudwatch_logging = true
      cloudwatch_log_group_name = aws_cloudwatch_log_group.ecs.name
      
      readonly_root_filesystem = false
      memory_reservation = 512
    }
  }

  load_balancer = {
    service = {
      target_group_arn = aws_lb_target_group.app.arn
      container_name   = "${var.project_name}-app"
      container_port   = 3000
    }
  }

  subnet_ids = module.vpc.private_subnets
  
  security_group_rules = {
    alb_ingress_3000 = {
      type                     = "ingress"
      from_port                = 3000
      to_port                  = 3000
      protocol                 = "tcp"
      description              = "Service port"
      source_security_group_id = aws_security_group.alb.id
    }
    egress_all = {
      type        = "egress"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # Enable ECS Exec for debugging
  enable_execute_command = true

  tags = local.common_tags
}

# ECR Repository
resource "aws_ecr_repository" "app" {
  name                 = var.project_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# Local values
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Terraform   = "true"
    ManagedBy   = "terraform"
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "edsteward"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
  default     = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
  default     = "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
}

variable "session_secret" {
  description = "Session secret for authentication"
  type        = string
  default     = "9qbArxksSA8llE2Gpkt1Hs2jvFBPFE9G9ZEN"
}

# Outputs
output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs_cluster.arn
}

output "service_name" {
  description = "Name of the ECS service"
  value       = module.ecs_service.name
}

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.app.repository_url
} 