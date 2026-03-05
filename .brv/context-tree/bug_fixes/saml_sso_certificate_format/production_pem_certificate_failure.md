SAML SSO Access Methods for EdSteward Production:

1. Direct SAML Login: https://moravian.edsteward.ai/auth/saml/login/moravian
2. SAML Metadata: https://moravian.edsteward.ai/auth/saml/metadata  
3. Login page SSO button: https://moravian.edsteward.ai/auth
4. OKTA-initiated: https://login.moravian.edu/app/moravian_edstewardbeta_1/exk1c4nmsctSaNRIg0x8/sso/saml

Current issue: Docker image still has certificate format problems despite code fixes. Need to investigate why the full PEM certificate format isn't working in production when it works locally.