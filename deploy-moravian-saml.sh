#!/bin/zsh

echo "🎓 Deploying Moravian University SAML SSO Configuration"
echo "=================================================="

# Check if required environment variables are set
if [[ -z "$MORAVIAN_OKTA_SSO_URL" ]]; then
    echo "❌ Error: MORAVIAN_OKTA_SSO_URL environment variable is not set"
    echo "Please set the Okta SSO URL before running this script"
    exit 1
fi

if [[ -z "$MORAVIAN_OKTA_CERT" ]]; then
    echo "❌ Error: MORAVIAN_OKTA_CERT environment variable is not set"
    echo "Please set the Okta certificate before running this script"
    exit 1
fi

echo "✅ Environment variables validated"

# Create certs directory if it doesn't exist
echo "📁 Creating certificates directory..."
mkdir -p certs

# Generate service provider certificates if they don't exist
if [[ ! -f "certs/sp-key.pem" ]] || [[ ! -f "certs/sp-cert.pem" ]]; then
    echo "🔑 Generating SAML service provider certificates..."
    
    # Generate private key
    openssl genrsa -out certs/sp-key.pem 2048
    
    # Generate certificate
    openssl req -new -x509 -key certs/sp-key.pem \
        -out certs/sp-cert.pem -days 365 \
        -subj "/C=US/ST=Pennsylvania/L=Bethlehem/O=Moravian University/OU=IT/CN=moravian.edsteward.ai"
    
    echo "✅ Service provider certificates generated"
else
    echo "✅ Service provider certificates already exist"
fi

# Build for AWS with correct platform
echo "🐳 Building Docker image for AWS deployment..."
if [[ -f "build-for-aws.sh" ]]; then
    chmod +x build-for-aws.sh
    ./build-for-aws.sh
else
    echo "⚠️  build-for-aws.sh not found, building with docker directly"
    docker build --platform linux/amd64 -t regulatory-trackr .
fi

# Run tenant migration to update Moravian configuration
echo "🏢 Updating Moravian tenant configuration..."
if command -v npm >/dev/null 2>&1; then
    npm run migrate:tenants
else
    echo "⚠️  npm not found, skipping tenant migration"
    echo "Please run 'npm run migrate:tenants' manually after deployment"
fi

# Test SAML metadata generation
echo "🔍 Testing SAML metadata generation..."
curl -s http://localhost:3000/auth/saml/metadata/moravian > /dev/null
if [[ $? -eq 0 ]]; then
    echo "✅ SAML metadata endpoint is accessible"
else
    echo "⚠️  SAML metadata endpoint test failed (server may not be running)"
fi

# Display configuration summary
echo ""
echo "📋 SAML Configuration Summary"
echo "=============================="
echo "Entity ID: urn:edsteward:sp:moravian"
echo "ACS URL: https://moravian.edsteward.ai/auth/saml/callback"
echo "Metadata URL: https://moravian.edsteward.ai/auth/saml/metadata/moravian"
echo "SSO Login URL: https://moravian.edsteward.ai/auth/saml/login/moravian"
echo ""
echo "Okta Configuration:"
echo "- SSO URL: $MORAVIAN_OKTA_SSO_URL"
echo "- Entity ID: ${MORAVIAN_OKTA_ENTITY_ID:-'Not set'}"
echo "- Certificate: ${MORAVIAN_OKTA_CERT:0:50}..." 
echo ""

# Display next steps
echo "🚀 Next Steps"
echo "============="
echo "1. Configure your Okta application with these settings:"
echo "   - Single sign on URL: https://moravian.edsteward.ai/auth/saml/callback"
echo "   - Audience URI: urn:edsteward:sp:moravian"
echo "   - Default RelayState: moravian"
echo ""
echo "2. Import the Service Provider metadata into Okta:"
echo "   - Access: https://moravian.edsteward.ai/auth/saml/metadata/moravian"
echo ""
echo "3. Create Okta groups for role mapping:"
echo "   - EdSteward-Moravian-Users"
echo "   - EdSteward-Moravian-Officers" 
echo "   - EdSteward-Moravian-Admins"
echo ""
echo "4. Test the SAML login:"
echo "   - Visit: https://moravian.edsteward.ai/login"
echo "   - Click 'Sign in with Moravian University SSO'"
echo ""
echo "✅ Moravian University SAML SSO deployment completed!"
echo "📚 For detailed setup instructions, see: MORAVIAN_SAML_SETUP_GUIDE.md" 