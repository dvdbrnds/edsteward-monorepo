Okta SAML SSO URL Update (January 7, 2026):

**Problem:** SSO login was returning 404 errors from Okta.

**Root Cause:** The Okta app was renamed/recreated:
- Old app: `moravian_edstewardbeta_1` (ID: `exk1c4nmsctSaNRIg0x8`) - returned 404
- New app: `moravian_edsteward_1` (ID: `exk1e0p7l67i9eQBu0x8`) - working

**Resolution:**
1. Got new metadata URL from Okta admin: `https://login.moravian.edu/app/exk1e0p7l67i9eQBu0x8/sso/saml/metadata`
2. Updated `AUTH_SAML_SSO_URL` in ECS task definition to: `https://login.moravian.edu/app/moravian_edsteward_1/exk1e0p7l67i9eQBu0x8/sso/saml`
3. Updated `AUTH_SAML_CERT` with new certificate from metadata
4. Updated local `.env` to match

**Lesson:** When Okta SSO returns 404, check with IT if the app was renamed/recreated and get the new metadata URL.