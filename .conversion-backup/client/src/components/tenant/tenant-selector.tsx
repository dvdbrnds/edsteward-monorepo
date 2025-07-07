import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Search, ArrowRight, Shield, Users, CheckCircle } from 'lucide-react';

interface TenantOption {
  id: string;
  name: string;
  domain: string;
  description: string;
  userCount: number;
  status: 'active' | 'setup' | 'maintenance';
  logoUrl?: string;
  samlEnabled: boolean;
}

interface TenantSelectorProps {
  onTenantSelect?: (tenant: TenantOption) => void;
  userEmail?: string;
}

export default function TenantSelector({ onTenantSelect, userEmail }: TenantSelectorProps) {
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<TenantOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoDetectedTenant, setAutoDetectedTenant] = useState<TenantOption | null>(null);

  // Mock data - in production, this would come from API
  useEffect(() => {
    const mockTenants: TenantOption[] = [
      {
        id: 'moravian',
        name: 'Moravian University',
        domain: 'moravian.edu',
        description: 'Private university in Bethlehem, Pennsylvania',
        userCount: 0,
        status: 'setup',
        samlEnabled: false
      },
      {
        id: 'demo-university',
        name: 'Demo University',
        domain: 'demo.edu',
        description: 'Demo tenant for testing purposes',
        userCount: 25,
        status: 'active',
        samlEnabled: true
      },
      {
        id: 'admin',
        name: 'EdSteward Admin',
        domain: 'edsteward.ai',
        description: 'EdSteward administrative tenant',
        userCount: 1,
        status: 'active',
        samlEnabled: false
      }
    ];

    // Auto-detect tenant based on email domain
    if (userEmail) {
      const emailDomain = userEmail.split('@')[1];
      const autoDetected = mockTenants.find(t => t.domain === emailDomain);
      setAutoDetectedTenant(autoDetected || null);
    }

    setTimeout(() => {
      setAvailableTenants(mockTenants);
      setFilteredTenants(mockTenants);
      setIsLoading(false);
    }, 800);
  }, [userEmail]);

  // Filter tenants based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTenants(availableTenants);
    } else {
      const filtered = availableTenants.filter(tenant =>
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTenants(filtered);
    }
  }, [searchQuery, availableTenants]);

  const handleTenantSelect = (tenant: TenantOption) => {
    setSelectedTenant(tenant);
    onTenantSelect?.(tenant);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'setup': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Select Your Organization</h1>
        <p className="text-muted-foreground">
          Choose your organization to access EdSteward compliance tracking
        </p>
      </div>

      {/* Auto-detected tenant alert */}
      {autoDetectedTenant && (
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            We detected you might belong to <strong>{autoDetectedTenant.name}</strong> based on your email domain ({autoDetectedTenant.domain}).
            <Button
              variant="link"
              className="p-0 h-auto ml-2 text-blue-600"
              onClick={() => handleTenantSelect(autoDetectedTenant)}
            >
              Select this organization
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Search Organizations</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search by name, domain, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tenant Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredTenants.map((tenant) => (
          <Card
            key={tenant.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTenant?.id === tenant.id
                ? 'ring-2 ring-blue-500 border-blue-200'
                : 'hover:border-gray-300'
            }`}
            onClick={() => handleTenantSelect(tenant)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tenant.name}</CardTitle>
                    <CardDescription className="text-sm">{tenant.domain}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(tenant.status)}>
                    {tenant.status}
                  </Badge>
                  {tenant.samlEnabled && (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      SSO
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-3">
                {tenant.description}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{tenant.userCount} users</span>
                  </div>
                  {tenant.samlEnabled && (
                    <div className="flex items-center space-x-1">
                      <Shield className="h-4 w-4" />
                      <span>SAML SSO</span>
                    </div>
                  )}
                </div>
                
                {selectedTenant?.id === tenant.id && (
                  <div className="flex items-center space-x-1 text-blue-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No results */}
      {filteredTenants.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No organizations found</h3>
          <p className="text-muted-foreground mb-4">
            No organizations match your search criteria.
          </p>
          <Button variant="outline" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </div>
      )}

      {/* Continue button */}
      {selectedTenant && (
        <div className="flex justify-center pt-6">
          <Button size="lg" className="min-w-[200px]">
            Continue to {selectedTenant.name}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Help text */}
      <div className="text-center text-sm text-muted-foreground">
        Don't see your organization? Contact your administrator or{' '}
        <Button variant="link" className="p-0 h-auto">
          request access
        </Button>
      </div>
    </div>
  );
} 