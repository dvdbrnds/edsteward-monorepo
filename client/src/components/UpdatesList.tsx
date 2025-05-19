import { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, FileText, PenTool, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

interface RegulationUpdate {
  id: number;
  regulationId: number;
  updatedContent: string;
  submittedAt: string;
  submittedBy: number;
  status: 'pending' | 'accepted' | 'rejected' | 'deferred';
  changeStats: {
    addedPercentage: number;
    removedPercentage: number;
    changedPercentage: number;
  };
}

export const UpdatesList: FC = () => {
  // Fetch pending regulation updates
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/regulation-updates/pending'],
    queryFn: () => apiRequest('/api/regulation-updates/pending'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center p-6 border rounded-lg bg-red-50 text-red-700">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <h3 className="text-lg font-medium">Error loading updates</h3>
        <p>{error?.message || 'Failed to load regulation updates'}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-12 border rounded-lg bg-gray-50">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <h3 className="text-xl font-medium">No pending updates</h3>
        <p className="text-gray-500 mt-2">There are currently no regulation updates awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Pending Regulation Updates</h2>
      <p className="text-muted-foreground">
        Review, accept or reject changes to regulations. Click on an update to view detailed changes.
      </p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((update: RegulationUpdate) => (
          <UpdateCard key={update.id} update={update} />
        ))}
      </div>
    </div>
  );
};

interface UpdateCardProps {
  update: RegulationUpdate;
}

const UpdateCard: FC<UpdateCardProps> = ({ update }) => {
  // Get change severity level based on percentage of changes
  const getChangeSeverity = (percentage: number) => {
    if (percentage < 10) return 'low';
    if (percentage < 30) return 'medium';
    return 'high';
  };

  const severity = getChangeSeverity(update.changeStats.changedPercentage);
  
  // Set colors based on severity
  const severityColors = {
    low: {
      badge: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      border: 'border-blue-200',
    },
    medium: {
      badge: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
      border: 'border-amber-200',
    },
    high: {
      badge: 'bg-red-100 text-red-800 hover:bg-red-200',
      border: 'border-red-200',
    },
  };

  return (
    <Card className={`overflow-hidden ${severityColors[severity].border}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">Update #{update.id}</CardTitle>
          <Badge variant="outline" className={severityColors[severity].badge}>
            {update.changeStats.changedPercentage}% Changed
          </Badge>
        </div>
        <CardDescription>
          Submitted {formatDistanceToNow(new Date(update.submittedAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Change Statistics</div>
            <div className="grid grid-cols-3 gap-1 text-center text-sm">
              <div>
                <div className="font-medium text-green-600">{update.changeStats.addedPercentage}%</div>
                <div className="text-xs text-muted-foreground">Added</div>
              </div>
              <div>
                <div className="font-medium text-red-600">{update.changeStats.removedPercentage}%</div>
                <div className="text-xs text-muted-foreground">Removed</div>
              </div>
              <div>
                <div className="font-medium text-blue-600">{update.changeStats.changedPercentage}%</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
          </div>
          
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${update.changeStats.changedPercentage}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
      
      <Separator />
      
      <CardFooter className="pt-4 pb-4 flex justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Regulation ID:</span> {update.regulationId}
        </div>
        <Button size="sm" asChild>
          <Link to={`/regulation-updates/${update.id}`}>
            <Sparkles className="mr-2 h-4 w-4" />
            View Changes
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default UpdatesList;