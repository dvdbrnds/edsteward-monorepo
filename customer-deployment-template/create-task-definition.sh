#!/bin/zsh

# Create ECS Task Definition for Customer Deployment
# Usage: ./create-task-definition.sh [customer-config.json] [docker-image-uri]

set -e

if [[ -z "$1" || -z "$2" ]]; then
    echo "Usage: ./create-task-definition.sh [customer-config.json] [docker-image-uri]"
    exit 1
fi

CONFIG_FILE="$1"
DOCKER_IMAGE_URI="$2"

# Load configuration
CUSTOMER_NAME=$(jq -r '.customer.name' "$CONFIG_FILE")
# Sanitize customer name for container name (remove spaces and special chars)
CUSTOMER_CONTAINER_NAME=$(echo "$CUSTOMER_NAME" | sed 's/[^a-zA-Z0-9-]/-/g' | tr '[:upper:]' '[:lower:]')
TASK_FAMILY=$(jq -r '.deployment.taskDefinitionFamily' "$CONFIG_FILE")
AWS_REGION=$(jq -r '.aws.region' "$CONFIG_FILE")
LOG_GROUP=$(jq -r '.aws.logGroup' "$CONFIG_FILE")
CPU=$(jq -r '.deployment.cpu' "$CONFIG_FILE")
MEMORY=$(jq -r '.deployment.memory' "$CONFIG_FILE")

# Extract environment variables from config
DATABASE_URL=$(jq -r '.database.connectionString' "$CONFIG_FILE")
SESSION_SECRET=$(jq -r '.environment.sessionSecret' "$CONFIG_FILE")
NODE_ENV=$(jq -r '.environment.nodeEnv' "$CONFIG_FILE")
PORT=$(jq -r '.environment.port' "$CONFIG_FILE")
MULTI_TENANT=$(jq -r '.environment.multiTenant' "$CONFIG_FILE")

# Extract branding configuration
INSTITUTION_NAME=$(jq -r '.branding.institutionName' "$CONFIG_FILE")
INSTITUTION_TITLE=$(jq -r '.branding.title' "$CONFIG_FILE")
LOGO_URL=$(jq -r '.branding.logoUrl' "$CONFIG_FILE")
FAVICON_URL=$(jq -r '.branding.faviconUrl' "$CONFIG_FILE")
PRIMARY_COLOR=$(jq -r '.branding.primaryColor' "$CONFIG_FILE")
SECONDARY_COLOR=$(jq -r '.branding.secondaryColor' "$CONFIG_FILE")
ACCENT_COLOR=$(jq -r '.branding.accentColor' "$CONFIG_FILE")
LOGIN_BG_COLOR=$(jq -r '.branding.loginScreenBackgroundColor' "$CONFIG_FILE")
LOGIN_ACCENT_COLOR=$(jq -r '.branding.loginScreenAccentColor' "$CONFIG_FILE")
LOGIN_TEXT_COLOR=$(jq -r '.branding.loginScreenTextColor' "$CONFIG_FILE")
LOGIN_HERO_COLOR=$(jq -r '.branding.loginScreenHeroColor' "$CONFIG_FILE")

# Extract contact information
SUPPORT_EMAIL=$(jq -r '.customer.contact.supportEmail' "$CONFIG_FILE")
ADMIN_EMAIL=$(jq -r '.customer.contact.adminEmail' "$CONFIG_FILE")
ORGANIZATION_URL=$(jq -r '.customer.contact.organizationUrl' "$CONFIG_FILE")

# Extract authentication settings
SAML_ENABLED=$(jq -r '.authentication.samlEnabled' "$CONFIG_FILE")
SAML_ENTITY_ID=$(jq -r '.authentication.samlEntityId' "$CONFIG_FILE")
SAML_SSO_URL=$(jq -r '.authentication.samlSsoUrl' "$CONFIG_FILE")
USERNAME_PASSWORD_ENABLED=$(jq -r '.authentication.usernamePasswordEnabled' "$CONFIG_FILE")
ALLOW_SELF_REGISTRATION=$(jq -r '.authentication.allowSelfRegistration' "$CONFIG_FILE")

# Extract feature settings
MAX_USERS=$(jq -r '.features.maxUsers' "$CONFIG_FILE")
MAX_REGULATIONS=$(jq -r '.features.maxRegulations' "$CONFIG_FILE")
API_ACCESS=$(jq -r '.features.apiAccess' "$CONFIG_FILE")
CUSTOM_DOMAIN=$(jq -r '.features.customDomain' "$CONFIG_FILE")
SSO_ENABLED=$(jq -r '.features.ssoEnabled' "$CONFIG_FILE")

# Generate task definition using jq to ensure proper JSON formatting
jq -n \
  --arg family "$TASK_FAMILY" \
  --arg cpu "$CPU" \
  --arg memory "$MEMORY" \
  --arg accountId "$(jq -r '.aws.accountId' "$CONFIG_FILE")" \
  --arg containerName "edsteward-$CUSTOMER_CONTAINER_NAME" \
  --arg image "$DOCKER_IMAGE_URI" \
  --arg port "$PORT" \
  --arg logGroup "$LOG_GROUP" \
  --arg region "$AWS_REGION" \
  --arg nodeEnv "$NODE_ENV" \
  --arg databaseUrl "$DATABASE_URL" \
  --arg sessionSecret "$SESSION_SECRET" \
  --arg multiTenant "$MULTI_TENANT" \
  --arg institutionName "$INSTITUTION_NAME" \
  --arg institutionTitle "$INSTITUTION_TITLE" \
  --arg logoUrl "$LOGO_URL" \
  --arg faviconUrl "$FAVICON_URL" \
  --arg primaryColor "$PRIMARY_COLOR" \
  --arg secondaryColor "$SECONDARY_COLOR" \
  --arg accentColor "$ACCENT_COLOR" \
  --arg loginBgColor "$LOGIN_BG_COLOR" \
  --arg loginAccentColor "$LOGIN_ACCENT_COLOR" \
  --arg loginTextColor "$LOGIN_TEXT_COLOR" \
  --arg loginHeroColor "$LOGIN_HERO_COLOR" \
  --arg supportEmail "$SUPPORT_EMAIL" \
  --arg adminEmail "$ADMIN_EMAIL" \
  --arg organizationUrl "$ORGANIZATION_URL" \
  --arg samlEnabled "$SAML_ENABLED" \
  --arg samlEntityId "$SAML_ENTITY_ID" \
  --arg samlSsoUrl "$SAML_SSO_URL" \
  --arg usernamePasswordEnabled "$USERNAME_PASSWORD_ENABLED" \
  --arg allowSelfRegistration "$ALLOW_SELF_REGISTRATION" \
  --arg maxUsers "$MAX_USERS" \
  --arg maxRegulations "$MAX_REGULATIONS" \
  --arg apiAccess "$API_ACCESS" \
  --arg customDomain "$CUSTOM_DOMAIN" \
  --arg ssoEnabled "$SSO_ENABLED" \
  '{
    family: $family,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: $cpu,
    memory: $memory,
    executionRoleArn: ("arn:aws:iam::" + $accountId + ":role/ecsTaskExecutionRole"),
    containerDefinitions: [
      {
        name: $containerName,
        image: $image,
        portMappings: [
          {
            containerPort: ($port | tonumber),
            protocol: "tcp"
          }
        ],
        environment: [
          { name: "NODE_ENV", value: $nodeEnv },
          { name: "PORT", value: $port },
          { name: "DATABASE_URL", value: $databaseUrl },
          { name: "SESSION_SECRET", value: $sessionSecret },
          { name: "MULTI_TENANT", value: $multiTenant },
          { name: "INSTITUTION_NAME", value: $institutionName },
          { name: "INSTITUTION_TITLE", value: $institutionTitle },
          { name: "INSTITUTION_LOGO_URL", value: $logoUrl },
          { name: "INSTITUTION_FAVICON_URL", value: $faviconUrl },
          { name: "INSTITUTION_PRIMARY_COLOR", value: $primaryColor },
          { name: "INSTITUTION_SECONDARY_COLOR", value: $secondaryColor },
          { name: "INSTITUTION_ACCENT_COLOR", value: $accentColor },
          { name: "LOGIN_SCREEN_BACKGROUND_COLOR", value: $loginBgColor },
          { name: "LOGIN_SCREEN_ACCENT_COLOR", value: $loginAccentColor },
          { name: "LOGIN_SCREEN_TEXT_COLOR", value: $loginTextColor },
          { name: "LOGIN_SCREEN_HERO_COLOR", value: $loginHeroColor },
          { name: "SUPPORT_EMAIL", value: $supportEmail },
          { name: "ADMIN_EMAIL", value: $adminEmail },
          { name: "ORGANIZATION_URL", value: $organizationUrl },
          { name: "AUTH_SAML_ENABLED", value: $samlEnabled },
          { name: "AUTH_SAML_ENTITY_ID", value: $samlEntityId },
          { name: "AUTH_SAML_SSO_URL", value: $samlSsoUrl },
          { name: "AUTH_USERNAME_PASSWORD_ENABLED", value: $usernamePasswordEnabled },
          { name: "AUTH_ALLOW_SELF_REGISTRATION", value: $allowSelfRegistration },
          { name: "FEATURE_MAX_USERS", value: $maxUsers },
          { name: "FEATURE_MAX_REGULATIONS", value: $maxRegulations },
          { name: "FEATURE_API_ACCESS", value: $apiAccess },
          { name: "FEATURE_CUSTOM_DOMAIN", value: $customDomain },
          { name: "FEATURE_SSO_ENABLED", value: $ssoEnabled }
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": $logGroup,
            "awslogs-region": $region,
            "awslogs-stream-prefix": $containerName
          }
        },
        healthCheck: {
          command: [
            "CMD-SHELL",
            ("curl -f http://localhost:" + $port + "/health || exit 1")
          ],
          interval: 30,
          timeout: 5,
          retries: 3,
          startPeriod: 60
        },
        essential: true
      }
    ]
  }' 