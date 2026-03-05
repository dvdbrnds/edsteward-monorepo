/**
 * Executive Orders Admin Page
 * 
 * Administrative view of all Executive Orders and their impacts.
 * MCP Engine Integration - January 2026
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link } from 'wouter';
import {
  Scale,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  FileText,
  Filter,
  Search,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ExecutiveOrder {
  id: number;
  eoNumber: string;
  title: string;
  signedDate: string;
  status: string;
  president: string | null;
  term: string | null;
  summary: string | null;
  fullTextUrl: string | null;
  impactCount: number;
  criticalCount: number;
  highCount: number;
}

interface EOStats {
  executiveOrders: {
    total: number;
    active: number;
    enjoined: number;
  };
  impacts: {
    total: number;
    critical: number;
    high: number;
    pendingReview: number;
    regulationsAffected: number;
  };
}

// Severity config for future use in EO detail views
const _severityConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: <AlertCircle className="h-4 w-4 text-orange-600" />,
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
  },
  low: {
    label: 'Low',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: <Shield className="h-4 w-4 text-gray-600" />,
  },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  enjoined: { label: 'Enjoined', className: 'bg-red-100 text-red-800' },
  revoked: { label: 'Revoked', className: 'bg-gray-100 text-gray-800' },
  superseded: { label: 'Superseded', className: 'bg-amber-100 text-amber-800' },
};

export default function ExecutiveOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedEO, setExpandedEO] = useState<number | null>(null);

  // Fetch EO stats
  const { data: stats } = useQuery<EOStats>({
    queryKey: ['eo-stats'],
    queryFn: async () => {
      const res = await fetch('/api/executive-orders/stats/summary', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Fetch all EOs
  const { data: executiveOrders, isLoading } = useQuery<ExecutiveOrder[]>({
    queryKey: ['executive-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await fetch(`/api/executive-orders?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch executive orders');
      return res.json();
    },
  });

  // Filter by search
  const filteredEOs = executiveOrders?.filter(eo => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      eo.eoNumber.toLowerCase().includes(query) ||
      eo.title.toLowerCase().includes(query) ||
      eo.president?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            Executive Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            Presidential Executive Orders affecting your compliance regulations
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total EOs</CardDescription>
            <CardTitle className="text-3xl">
              {stats?.executiveOrders.total ?? <Skeleton className="h-8 w-12" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {stats?.executiveOrders.active} active
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(stats?.impacts.critical && stats.impacts.critical > 0 && "border-red-300")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              Critical Impacts
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {stats?.impacts.critical ?? <Skeleton className="h-8 w-12" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-red-600">
              Require immediate review
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(stats?.impacts.high && stats.impacts.high > 0 && "border-orange-300")}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-orange-500" />
              High Impacts
            </CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {stats?.impacts.high ?? <Skeleton className="h-8 w-12" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-orange-600">
              Review within 30 days
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Pending Review
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {stats?.impacts.pendingReview ?? <Skeleton className="h-8 w-12" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Awaiting CCO action
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Regulations Affected
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats?.impacts.regulationsAffected ?? <Skeleton className="h-8 w-12" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total impacted
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search EOs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="enjoined">Enjoined</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* EO List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredEOs && filteredEOs.length > 0 ? (
        <div className="space-y-3">
          {filteredEOs.map((eo) => {
            const status = statusConfig[eo.status] || statusConfig.active;
            const isExpanded = expandedEO === eo.id;
            
            return (
              <Card key={eo.id} className={cn(
                eo.criticalCount > 0 && "border-red-300",
                eo.criticalCount === 0 && eo.highCount > 0 && "border-orange-300"
              )}>
                <Collapsible open={isExpanded} onOpenChange={() => setExpandedEO(isExpanded ? null : eo.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {eo.eoNumber}
                              <Badge variant="outline" className={status.className}>
                                {status.label}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1">{eo.title}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {eo.criticalCount > 0 && (
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                              {eo.criticalCount} Critical
                            </Badge>
                          )}
                          {eo.highCount > 0 && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                              {eo.highCount} High
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {eo.impactCount} regulation{eo.impactCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {/* EO Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 bg-muted/50 rounded-lg">
                        <div>
                          <span className="text-muted-foreground">Signed:</span>{' '}
                          {format(new Date(eo.signedDate), 'MMM d, yyyy')}
                        </div>
                        <div>
                          <span className="text-muted-foreground">President:</span>{' '}
                          {eo.president || 'N/A'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Term:</span>{' '}
                          {eo.term || 'N/A'}
                        </div>
                        <div>
                          {eo.fullTextUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => window.open(eo.fullTextUrl!, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Federal Register
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {eo.summary && (
                        <div className="text-sm text-muted-foreground">
                          {eo.summary}
                        </div>
                      )}
                      
                      <div className="flex justify-end">
                        <Link href={`/executive-orders/${eo.eoNumber}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            View Details & Impacts
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Executive Orders Found</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Executive Orders affecting your regulations will appear here'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
