#!/bin/zsh

echo "🔧 Setting up local domains for EdSteward subdomain testing..."

# Backup current hosts file
sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)

# Add EdSteward local domains
echo "
# EdSteward Local Development Domains
127.0.0.1    edsteward.local
127.0.0.1    admin.edsteward.local
127.0.0.1    moravian.edsteward.local
127.0.0.1    edsteward.edu
127.0.0.1    admin.edsteward.edu  
127.0.0.1    moravian.edsteward.edu" | sudo tee -a /etc/hosts

echo "✅ Local domains added to /etc/hosts"
echo ""
echo "You can now access:"
echo "  🌐 http://admin.edsteward.local"
echo "  🌐 http://moravian.edsteward.local"
echo "  🌐 http://admin.edsteward.edu"
echo "  🌐 http://moravian.edsteward.edu"
echo ""
echo "To remove these entries later, restore from backup:"
echo "  sudo cp /etc/hosts.backup.* /etc/hosts" 