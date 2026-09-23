# Coolify Environment Variables Reference

All variables below should be set in the Coolify UI under **Environment Variables** for each service.

## App Service

### Required (app won't function without these)

| Variable | Value | Notes |
|----------|-------|-------|
| `SESSION_SECRET` | `QBVfQWgymRfqXPHubc+9Sj3bSlgJr52O0WubpzEzw2yoJJ5G18dGsPoYegk5urs0sZ8U+1i+Z+rMnnzQpt8gjQ==` | Copied from AWS ECS. Changing this logs out all users. |
| `MFA_ENCRYPTION_KEY` | `d19eda2bb9690e5fd937b52804803efffcff9ffd2f4acd7512f5a9ea4fb94ad7` | Copied from AWS ECS. Must match to preserve MFA enrollments. |
| `ATTESTATION_JWT_SECRET` | `af0c064bf64136db3008ed3ffda1b825dad9d18139b17ade1c7e82a9c56f250b` | Copied from AWS ECS. Changing this invalidates pending attestation tokens. |
| `INSTITUTION_NAME` | `Moravian University` | Use spaces (not underscores). |
| `INSTITUTION_DOMAIN` | `moravian.edu` | |
| `BASE_URL` | `https://edsteward.moravian.edu` | Must match the FQDN set on the app service. Update to final domain. |

### SAML / Okta SSO

| Variable | Value | Notes |
|----------|-------|-------|
| `AUTH_SAML_ENABLED` | `true` | |
| `AUTH_SAML_SSO_URL` | `https://login.moravian.edu/app/moravian_edsteward_1/exk1e0p7l67i9eQBu0x8/sso/saml` | |
| `AUTH_SAML_ENTITY_ID` | `https://edsteward.moravian.edu` | Update to new domain (was `https://moravian.edsteward.ai`). |
| `SAML_SP_ENTITY_ID` | `urn:edsteward:sp` | No change needed. |
| `SAML_CALLBACK_URL` | `https://edsteward.moravian.edu/auth/saml/callback` | Update to new domain. |
| `SAML_SLO_URL` | `https://edsteward.moravian.edu/auth/saml/logout` | Update to new domain. |
| `AUTH_SAML_CERT` | *(see below)* | The full PEM certificate from Okta. Paste the entire block including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`. |

<details>
<summary>AUTH_SAML_CERT value (click to expand)</summary>

```
-----BEGIN CERTIFICATE-----
MIIDoDCCAoigAwIBAgIGAZksC8CSMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQG
EwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNj
bzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxETAPBgNVBAMM
CG1vcmF2aWFuMRwwGgYJKoZIhvcNAQkBFg1pbmZvQG9rdGEuY29tMB4XDTI1MDkw
OTAxMTUzMVoXDTM1MDkwOTAxMTYzMVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
DApDYWxpZm9ybmlhMRYwFAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ0wCwYDVQQKDARP
a3RhMRQwEgYDVQQLDAtTU09Qcm92aWRlcjERMA8GA1UEAwwIbW9yYXZpYW4xHDAa
BgkqhkiG9w0BCQEWDWluZm9Ab2t0YS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQCXbykp1wLETF2GeeVxniEgqJjDK4ESqD4UbbDYRQ8rooEF8AI3
p0UuN7gWtagKB/00w1O4a/vB1NvWhPUjLjGKYign9EMBxKCWtREFkn2ByxcLFX8x
YeW7R4pvtPcRDo37EInOed08TnFk0V8oCSNcRBndhL2YELIXOQJX5E5SGtNC7D/G
r61uBV/yh7ZGXk46YoTK1/AWeysQBysBk/0mo1qSXlbilmwxyV9Euq+3hV22rzPQ
+lBy/BecegtOcCBrxdkPfKTQ2B+P5lRpUL+ZCb0o+R8ZrXbhxTi7vr2jPwZQNLL2
PipKodb2F/b1wRwLl7P3z7IH3Je2ECuWQzA9AgMBAAEwDQYJKoZIhvcNAQELBQAD
ggEBAJTe6U0e1veP4YmVmrYkNrKX4IbAjYWYRn20IzcbS2iReJDJWFz187VjgPc9
3BnQWSutrpThguWliS1FwTdNTWON6yjzgu052IZVAhDWAP0pioBhDobnb5VQ5eFNE
ZQjBBbTwWK6XQEarvnildwZCt90jBPI5pCwyxvU5x6H01B8yi54hCbEtYQyVdJa6G
prQzwNQaxuD66Dma1vzlfT1aA+Etta1yOJHKEREPWHCsnYTyYkIKSO/xGPX3glhg
KzNlLT8UntqxW18FsIBd0feneSK8TSSo9Hq2BI6XGj7FW3oI9E4M9GQNnkmx73tP
P3mxnosWMF+hNsJjynH8Irsio=
-----END CERTIFICATE-----
```
</details>

### Observability (Sentry + Axiom)

| Variable | Value | Notes |
|----------|-------|-------|
| `SENTRY_DSN` | `https://ab022acbb1272dba87ceadebc73392ba@o4511224468275200.ingest.us.sentry.io/4511224474763264` | Sentry org: `moravian-university`, project: `node` |
| `VITE_SENTRY_DSN` | *(same as SENTRY_DSN)* | Used by the React frontend |
| `AXIOM_API_TOKEN` | `xaat-ab2165ad-6357-4424-bec3-8d203e1fe27a` | Created 2026-09-23 |
| `AXIOM_DATASET` | `edsteward-traces` | Create the dataset first in Axiom UI |

### Email (SMTP)

| Variable | Value | Notes |
|----------|-------|-------|
| `EMAIL_HOST` | *(Moravian SMTP server)* | Ask Moravian IT. Likely `smtp.moravian.edu` or Office 365 relay. |
| `EMAIL_PORT` | `587` | Standard STARTTLS port |
| `EMAIL_USER` | *(SMTP username)* | e.g., `edsteward@moravian.edu` |
| `EMAIL_PASS` | *(SMTP password)* | |
| `EMAIL_FROM` | `edsteward@moravian.edu` | |
| `ENABLE_TASK_SCHEDULER` | `true` | Only set to `true` after email is confirmed working. Currently `false` in compose. |

### Engine Integration

| Variable | Value | Notes |
|----------|-------|-------|
| `MCP_ENGINE_USERNAME` | `mcp-engine` | Must match `EDSTEWARD_USERNAME` on engine-delivery |
| `MCP_ENGINE_PASSWORD` | *(generate)* | `openssl rand -hex 32`. Must match `EDSTEWARD_PASSWORD` on engine-delivery. |

---

## Engine Services

### engine-llm (LLM Gateway)

| Variable | Value | Notes |
|----------|-------|-------|
| `ANTHROPIC_API_KEY` | *(your key)* | For Claude-based regulation analysis |
| `OPENAI_API_KEY` | *(your key)* | For GPT-based tasks |
| `CONGRESS_API_KEY` | *(your key)* | For Congress.gov API access |

### engine-delivery (Delivery Server)

| Variable | Value | Notes |
|----------|-------|-------|
| `EDSTEWARD_URL` | `http://app:3000` | Internal Docker network URL |
| `EDSTEWARD_USERNAME` | `mcp-engine` | Must match `MCP_ENGINE_USERNAME` on app |
| `EDSTEWARD_PASSWORD` | *(same as MCP_ENGINE_PASSWORD)* | Must match app's `MCP_ENGINE_PASSWORD` |

---

## Admin Console

### admin-backend

| Variable | Value | Notes |
|----------|-------|-------|
| `SESSION_SECRET` | *(generate)* | `openssl rand -hex 32`. Can be different from app's. |
| `REGISTRY_API_SECRET` | *(generate)* | `openssl rand -hex 32` |

---

## Okta SAML Reconfiguration

When the domain changes from `moravian.edsteward.ai` to `edsteward.moravian.edu`, update these in **Okta Admin Console**:

1. Go to **Applications** → **EdSteward** → **General** → **SAML Settings** → **Edit**
2. Click **Next** to the SAML settings page
3. Update:
   - **Single Sign-On URL**: `https://edsteward.moravian.edu/auth/saml/callback/okta`
   - **Recipient URL**: `https://edsteward.moravian.edu/auth/saml/callback/okta`
   - **Destination URL**: `https://edsteward.moravian.edu/auth/saml/callback/okta`
   - **Audience URI** stays: `urn:edsteward:sp`
4. Click **Next** → **Finish**

---

## DNS Setup for Moravian IT

Request an internal DNS A record:

```
edsteward.moravian.edu → 10.232.1.50
```

If external access is needed later (for Let's Encrypt SSL):
- Point a public A record to the Coolify server's external IP
- Or use Moravian's internal CA with Traefik

For internal-only access (current setup):
- Use a self-signed or internal CA certificate
- Configure in Coolify: Settings → SSL → Custom Certificate
- Or run without HTTPS on the internal network (http://edsteward.moravian.edu)
