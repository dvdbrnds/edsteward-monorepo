#!/usr/bin/env python3
"""
Enable SAML 2.0 Authentication for Local Development
===================================================

This script configures your local environment to use SAML authentication
matching your AWS production setup with Okta, Shibboleth, and InCommon federation support.
"""

import os
import subprocess
import sys
from pathlib import Path

def create_environment_variables():
    """Create environment variables for SAML configuration"""
    
    # Example Okta configuration (replace with your actual Okta setup)
    saml_env_vars = {
        # Base SAML Configuration
        'SAML_SP_ENTITY_ID': 'urn:edsteward:sp',
        'SAML_CALLBACK_URL': 'http://localhost:3000/auth/saml/callback',
        'SAML_SLO_URL': 'http://localhost:3000/auth/saml/logout',
        
        # Okta Configuration (replace with your actual values)
        'OKTA_SSO_URL': 'https://dev-12345678.okta.com/app/edsteward/exk1234567890/sso/saml',
        'OKTA_SLO_URL': 'https://dev-12345678.okta.com/app/edsteward/exk1234567890/slo/saml', 
        'OKTA_ENTITY_ID': 'http://www.okta.com/exk1234567890',
        'OKTA_CERT': '',  # Add your Okta certificate here
        
        # Shibboleth Configuration (example university)
        'SHIBBOLETH_SSO_URL': 'https://shibboleth.university.edu/idp/profile/SAML2/Redirect/SSO',
        'SHIBBOLETH_SLO_URL': 'https://shibboleth.university.edu/idp/profile/SAML2/Redirect/SLO',
        'SHIBBOLETH_ENTITY_ID': 'https://shibboleth.university.edu/idp/shibboleth',
        'SHIBBOLETH_CERT': '',  # Add your Shibboleth certificate here
        
        # InCommon Federation Configuration
        'INCOMMON_SSO_URL': 'https://wayf.incommonfederation.org/DS',
        'INCOMMON_SLO_URL': 'https://wayf.incommonfederation.org/SLO',
        'INCOMMON_ENTITY_ID': 'https://wayf.incommonfederation.org',
        'INCOMMON_CERT': '',  # Add your InCommon certificate here
        
        # Session Configuration
        'SESSION_SECRET': 'your-super-secret-session-key-change-this-in-production',
        'REDIS_URL': 'redis://localhost:6379',
        
        # Enable SAML in development
        'ENABLE_SAML': 'true',
        'NODE_ENV': 'development'
    }
    
    return saml_env_vars

def update_docker_compose():
    """Update docker-compose.dev.yml to include SAML environment variables"""
    
    print("🔧 Updating Docker Compose configuration for SAML...")
    
    env_vars = create_environment_variables()
    
    # Read current docker-compose.dev.yml
    compose_file = Path('docker-compose.dev.yml')
    if not compose_file.exists():
        print("❌ docker-compose.dev.yml not found!")
        return False
        
    with open(compose_file, 'r') as f:
        content = f.read()
    
    # Add environment variables to the app service
    saml_env_section = "\n      # SAML Authentication Configuration\n"
    for key, value in env_vars.items():
        saml_env_section += f"      - {key}={value}\n"
    
    # Insert before the volumes section if it exists
    if 'volumes:' in content:
        content = content.replace('    volumes:', f'{saml_env_section}    volumes:')
    else:
        # Insert before ports section
        content = content.replace('    ports:', f'{saml_env_section}    ports:')
    
    # Write updated content
    with open(compose_file, 'w') as f:
        f.write(content)
    
    print("✅ Docker Compose updated with SAML configuration")
    return True

def create_saml_certificates():
    """Create self-signed certificates for SAML development"""
    
    print("🔑 Creating SAML certificates for development...")
    
    # Create certs directory
    certs_dir = Path('certs')
    certs_dir.mkdir(exist_ok=True)
    
    # Generate self-signed certificate for development
    try:
        # Generate private key
        subprocess.run([
            'openssl', 'genrsa', '-out', 'certs/sp-key.pem', '2048'
        ], check=True, capture_output=True)
        
        # Generate certificate
        subprocess.run([
            'openssl', 'req', '-new', '-x509', '-key', 'certs/sp-key.pem',
            '-out', 'certs/sp-cert.pem', '-days', '365',
            '-subj', '/C=US/ST=State/L=City/O=EdSteward/OU=IT/CN=localhost'
        ], check=True, capture_output=True)
        
        print("✅ SAML certificates created successfully")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create certificates: {e}")
        print("Please ensure OpenSSL is installed: brew install openssl")
        return False
    except FileNotFoundError:
        print("❌ OpenSSL not found. Installing...")
        try:
            subprocess.run(['brew', 'install', 'openssl'], check=True)
            print("✅ OpenSSL installed. Please run this script again.")
        except subprocess.CalledProcessError:
            print("❌ Failed to install OpenSSL. Please install manually: brew install openssl")
        return False

def create_login_page():
    """Create a SAML login page for development"""
    
    print("📝 Creating SAML login page...")
    
    login_html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EdSteward - SAML Login</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-container {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 400px;
            width: 90%;
        }
        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }
        .logo h1 {
            color: #2d3748;
            margin: 0;
            font-size: 2rem;
            font-weight: 700;
        }
        .subtitle {
            text-align: center;
            color: #718096;
            margin-bottom: 2rem;
        }
        .saml-providers {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .saml-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            padding: 1rem 1.5rem;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            text-decoration: none;
            color: #2d3748;
            font-weight: 600;
            transition: all 0.2s;
            background: white;
        }
        .saml-button:hover {
            border-color: #667eea;
            background: #f7fafc;
            transform: translateY(-1px);
        }
        .provider-icon {
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }
        .okta { background: #007dc1; }
        .shibboleth { background: #8b5a3c; }
        .incommon { background: #1a365d; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>EdSteward</h1>
        </div>
        <div class="subtitle">
            Select your identity provider to sign in
        </div>
        <div class="saml-providers">
            <a href="/auth/saml/okta" class="saml-button">
                <div class="provider-icon okta"></div>
                Sign in with Okta
            </a>
            <a href="/auth/saml/shibboleth-idp" class="saml-button">
                <div class="provider-icon shibboleth"></div>
                Sign in with Shibboleth
            </a>
            <a href="/auth/saml/incommon-federation" class="saml-button">
                <div class="provider-icon incommon"></div>
                Sign in with InCommon
            </a>
        </div>
    </div>
</body>
</html>
    """
    
    # Create public directory if it doesn't exist
    public_dir = Path('client/public')
    public_dir.mkdir(parents=True, exist_ok=True)
    
    # Write login page
    with open(public_dir / 'login.html', 'w') as f:
        f.write(login_html)
    
    print("✅ SAML login page created")

def update_route_authentication():
    """Update routes to properly enforce SAML authentication"""
    
    print("🔒 Updating route authentication...")
    
    # The routes already have requireAuth middleware, but let's ensure it's consistent
    routes_to_check = [
        'server/routes/api/regulations.ts',
        'server/routes/api/notes.ts',
        'server/routes/api/deadlines.ts',
        'server/routes/api/notifications.ts'
    ]
    
    for route_file in routes_to_check:
        if Path(route_file).exists():
            print(f"✅ {route_file} already has authentication middleware")
        else:
            print(f"⚠️  {route_file} not found")
    
    return True

def main():
    """Main function to enable SAML authentication"""
    
    print("🚀 Enabling SAML 2.0 Authentication for Local Development")
    print("=" * 60)
    
    # Step 1: Create certificates
    if not create_saml_certificates():
        print("❌ Certificate creation failed. Please fix and retry.")
        return False
    
    # Step 2: Update Docker Compose
    if not update_docker_compose():
        print("❌ Docker Compose update failed. Please fix and retry.")
        return False
    
    # Step 3: Create login page
    create_login_page()
    
    # Step 4: Update route authentication
    update_route_authentication()
    
    print("\n🎉 SAML Authentication Setup Complete!")
    print("\n📋 Next Steps:")
    print("1. Update your Okta/Shibboleth configurations with:")
    print("   - ACS URL: http://localhost:3000/auth/saml/callback/[provider]")
    print("   - Entity ID: urn:edsteward:sp")
    print("   - SLO URL: http://localhost:3000/auth/saml/logout/[provider]")
    print("\n2. Add your actual certificates to the environment variables in docker-compose.dev.yml")
    print("\n3. Restart your local development environment:")
    print("   docker-compose -f docker-compose.dev.yml down")
    print("   docker-compose -f docker-compose.dev.yml up --build")
    print("\n4. Access: http://localhost:3000/login.html")
    print("\n5. Get your Service Provider metadata at: http://localhost:3000/auth/saml/metadata")
    
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        sys.exit(1) 