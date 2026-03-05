Successfully deployed EdSteward to AWS ECS on November 17, 2025. Deployment details:
- Git commit: 168b7fb1
- Docker image tag: deploy-20251117-083057-168b7fb1
- Task definition: edsteward-saml-step3:17
- Deployment script: scripts/deploy-ecs-proper.sh
- Changes deployed: Evidence upload fixes (multer), action update fixes (database columns + JSONB parsing), enhanced regulation timeline with version control, regulation ID display fixes, MCP structured fields support, UX/UI improvements on regulation detail page
- Previous deployment: September 30, 2025 (49 days ago)
- All db reference bugs fixed in storage.ts
- Deployment completed successfully with rollout state COMPLETED
- Service health: 1/1 tasks running, service is healthy