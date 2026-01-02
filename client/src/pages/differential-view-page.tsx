import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { diffWords } from 'diff';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckIcon, XIcon, ClockIcon, PlayCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// interface RegulationUpdate {
//   id: number;
//   regulationId: number;
//   name: string;
//   originalContent: string;
//   updatedContent: string;
//   status: string;
//   updateDate: string;
// }

// interface RegulationDetail {
//   id: number;
//   name: string;
//   jurisdiction: string;
//   agency_name?: string;
//   agency_department?: string;
//   lastUpdated?: string;
// }

// interface DiffData {
//   addedChars: number;
//   removedChars: number;
//   changedChars: number;
//   originalLength: number;
//   updatedLength: number;
//   addedPercentage: number;
//   removedPercentage: number;
//   changedPercentage: number;
//   differences: any[];
// }

interface DifferentialViewPageProps {
  isDemo?: boolean;
}

const DifferentialViewPage: React.FC<DifferentialViewPageProps> = ({ isDemo = false }) => {
  const [match, params] = useRoute<{ id: string }>('/regulations/updates/:id');
  const [, setLocation] = useLocation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'defer' | null>(null);
  const [reason, setReason] = useState('');
  
  // Parse query parameters to see if we should show a dialog
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const actionParam = queryParams.get('action');
    
    if (actionParam === 'approve') {
      setAction('approve');
      setShowConfirmDialog(true);
    } else if (actionParam === 'reject') {
      setAction('reject');
      setShowConfirmDialog(true);
    } else if (actionParam === 'defer') {
      setAction('defer');
      setShowConfirmDialog(true);
    }
    
    // Clean up the URL
    if (actionParam) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);
  
  const updateId = match ? parseInt(params.id) : null;

  // Demo data for showcasing the differential view
  const demoData = {
    update: {
      id: 'demo',
      name: 'Title IX Educational Amendments - 2024 Update',
      content: `# Title IX Compliance Requirements - Updated 2024

## Purpose
This document outlines the requirements for compliance with Title IX of the Education Amendments of 1972, which prohibits discrimination on the basis of sex in education programs and activities that receive federal financial assistance.

## Scope
These requirements apply to all educational institutions receiving federal funding, including colleges, universities, and K-12 schools.

## General Requirements

1. Each institution must designate at least one employee as the Title IX Coordinator to oversee compliance efforts and investigate any complaints of sex discrimination.

2. Institutions must adopt and publish grievance procedures that provide for the prompt and equitable resolution of student and employee complaints alleging sex discrimination.

3. **NEW 2024**: Institutions must implement enhanced digital reporting systems that allow anonymous reporting of incidents and provide real-time case tracking for complainants.

4. Institutions must notify all students, employees, applicants for admission and employment, and unions or professional organizations holding collective bargaining agreements with the institution about their Title IX rights and procedures.

## Reporting Requirements

### Annual Reporting
- Submit comprehensive annual reports to the Department of Education by October 1st each year
- **UPDATED 2024**: Reports must now include detailed analytics on case resolution times and outcomes
- Include statistical data on complaints received, investigations conducted, and remedial actions taken

### Incident Reporting
- **NEW 2024**: All incidents must be reported within 24 hours using the new federal digital reporting portal
- Maintain detailed records of all complaints and investigations for a minimum of seven years
- Provide quarterly updates to the Office for Civil Rights on ongoing investigations

## Training and Education

### Staff Training
- All employees must receive annual Title IX training
- **ENHANCED 2024**: Training must now include modules on trauma-informed investigation techniques and digital evidence handling
- Specialized training required for Title IX Coordinators, investigators, and decision-makers

### Student Education
- Provide comprehensive orientation programs for all new students
- **NEW 2024**: Implement ongoing awareness campaigns using digital platforms and social media
- Distribute educational materials in multiple languages as appropriate

## Investigation Procedures

### Timeline Requirements
- Initial response within 24 hours of receiving a complaint
- **UPDATED 2024**: Complete investigations within 60 days (reduced from 90 days)
- Provide written determination within 10 days of investigation completion

### Due Process Protections
- Ensure both parties have equal opportunity to present evidence and witnesses
- **NEW 2024**: Implement standardized evidence collection protocols for digital communications
- Provide both parties with trained advisors throughout the process

## Remedial Actions and Support Services

### Immediate Support Measures
- Provide counseling and mental health services
- **ENHANCED 2024**: Offer virtual counseling options and 24/7 crisis support hotlines
- Implement academic accommodations as needed
- Ensure campus safety measures are in place

### Long-term Remedies
- **NEW 2024**: Develop individualized safety plans for all parties involved
- Provide ongoing monitoring and support services
- Implement systemic changes to prevent future incidents

## Compliance Monitoring

### Internal Monitoring
- Conduct annual self-assessments of Title IX compliance
- **NEW 2024**: Implement continuous monitoring systems using data analytics
- Regular review of policies and procedures

### External Oversight
- Cooperate fully with Office for Civil Rights investigations
- **UPDATED 2024**: Participate in new federal compliance verification program
- Submit to periodic compliance audits

## Resources and Support

### Contact Information
- Title IX Coordinator: Available 24/7 via secure portal
- **NEW 2024**: Multi-language support hotline: 1-800-TITLEIX
- Emergency response team: Available for immediate safety concerns

### Additional Resources
- **NEW 2024**: Comprehensive online resource center with interactive training modules
- Legal assistance fund for complainants who meet eligibility criteria
- Peer support networks and survivor advocacy groups

---

*This document was last updated on ${new Date().toLocaleDateString()} to reflect the latest federal requirements and best practices in Title IX compliance.*`,
      status: 'pending',
      updateDate: new Date().toISOString()
    },
    original: {
      content: `# Title IX Compliance Requirements

## Purpose
This document outlines the requirements for compliance with Title IX of the Education Amendments of 1972, which prohibits discrimination on the basis of sex in education programs and activities that receive federal financial assistance.

## Scope
These requirements apply to all educational institutions receiving federal funding, including colleges, universities, and K-12 schools.

## General Requirements

1. Each institution must designate at least one employee as the Title IX Coordinator to oversee compliance efforts and investigate any complaints of sex discrimination.

2. Institutions must adopt and publish grievance procedures that provide for the prompt and equitable resolution of student and employee complaints alleging sex discrimination.

3. Institutions must notify all students, employees, applicants for admission and employment, and unions or professional organizations holding collective bargaining agreements with the institution about their Title IX rights and procedures.

## Reporting Requirements

### Annual Reporting
- Submit annual reports to the Department of Education by December 31st each year
- Include statistical data on complaints received, investigations conducted, and remedial actions taken

### Incident Reporting
- Maintain detailed records of all complaints and investigations for a minimum of five years
- Provide annual updates to the Office for Civil Rights on ongoing investigations

## Training and Education

### Staff Training
- All employees must receive annual Title IX training
- Specialized training required for Title IX Coordinators, investigators, and decision-makers

### Student Education
- Provide orientation programs for all new students
- Distribute educational materials as appropriate

## Investigation Procedures

### Timeline Requirements
- Initial response within 48 hours of receiving a complaint
- Complete investigations within 90 days
- Provide written determination within 15 days of investigation completion

### Due Process Protections
- Ensure both parties have equal opportunity to present evidence and witnesses
- Provide both parties with advisors throughout the process

## Remedial Actions and Support Services

### Immediate Support Measures
- Provide counseling and mental health services
- Implement academic accommodations as needed
- Ensure campus safety measures are in place

### Long-term Remedies
- Provide ongoing support services
- Implement systemic changes to prevent future incidents

## Compliance Monitoring

### Internal Monitoring
- Conduct annual self-assessments of Title IX compliance
- Regular review of policies and procedures

### External Oversight
- Cooperate fully with Office for Civil Rights investigations
- Submit to periodic compliance audits

## Resources and Support

### Contact Information
- Title IX Coordinator: Available during business hours
- Emergency response team: Available for immediate safety concerns

### Additional Resources
- Legal assistance information
- Support group referrals

---

*This document was last updated on January 1, 2023.*`
    },
    diffData: {
      addedChars: 2847,
      removedChars: 423,
      changedChars: 2424,
      originalLength: 3421,
      updatedLength: 5845,
      addedPercentage: 8,
      removedPercentage: 3,
      changedPercentage: 15,
      differences: [] // Will be calculated below
    }
  };

  // Calculate diff for demo data
  if (isDemo && demoData.diffData.differences.length === 0) {
    demoData.diffData.differences = diffWords(demoData.original.content, demoData.update.content);
  }
  
  const { data, isLoading, error } = useQuery({
    queryKey: isDemo ? ['demo-regulation-update'] : [`/api/regulation-updates/${updateId}`],
    queryFn: async () => {
      try {
        // Return demo data if in demo mode
        if (isDemo) {
          return demoData;
        }
        
        if (!updateId) throw new Error('No update ID provided');
        
        const response = await fetch(`/api/regulation-updates/${updateId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch regulation update: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Calculate diff data if not provided by the API
        if (!data.diffData) {
          const differences = diffWords(data.original.content, data.update.content);
          
          let addedChars = 0;
          let removedChars = 0;
          
          differences.forEach(part => {
            if (part.added) {
              addedChars += part.value.length;
            } else if (part.removed) {
              removedChars += part.value.length;
            } else {
              // unchanged
            }
          });
          
          const originalLength = data.original.content.length;
          const updatedLength = data.update.content.length;
          
          data.diffData = {
            addedChars,
            removedChars,
            changedChars: Math.abs(updatedLength - originalLength),
            originalLength,
            updatedLength,
            addedPercentage: Math.round((addedChars / originalLength) * 100),
            removedPercentage: Math.round((removedChars / originalLength) * 100),
            changedPercentage: Math.round(
              ((addedChars + removedChars) / originalLength) * 100
            ),
            differences
          };
        }
        
        return data;
      } catch (err) {
        console.error('Error fetching regulation update:', err);
        throw err;
      }
    },
    enabled: isDemo || !!updateId
  });
  
  const handleApproveUpdate = async () => {
    try {
      setShowConfirmDialog(false);
      
      if (isDemo) {
        // Demo mode - show success message and redirect
        alert('✅ Demo: Update approved successfully!\n\nIn production, this would update the regulation in the database and notify relevant stakeholders.');
        setLocation('/regulations/updates');
        return;
      }
      
      // API call to approve the update (signature is auto-generated on backend)
      const response = await fetch(`/api/regulation-updates/${updateId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Approval failed:', response.status, errorData);
        throw new Error(`Failed to approve update: ${response.status} ${errorData.error || response.statusText}`);
      }
      
      console.log('✅ Update approved successfully');
      
      // Redirect to success page or list
      setLocation('/regulations/updates');
      
    } catch (err) {
      console.error('Error approving update:', err);
      alert(`Error approving update: ${err.message}`);
    }
  };
  
  const handleRejectUpdate = async () => {
    try {
      setShowConfirmDialog(false);
      
      if (isDemo) {
        // Demo mode - show success message and redirect
        alert(`❌ Demo: Update rejected successfully!\n\nReason: ${reason}\n\nIn production, this would mark the update as rejected and notify the submitter.`);
        setLocation('/regulations/updates');
        return;
      }
      
      // API call to reject the update (signature is auto-generated on backend)
      const response = await fetch(`/api/regulation-updates/${updateId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          reason
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Rejection failed:', response.status, errorData);
        throw new Error(`Failed to reject update: ${response.status} ${errorData.error || response.statusText}`);
      }
      
      console.log('✅ Update rejected successfully');
      
      // Redirect to list
      setLocation('/regulations/updates');
      
    } catch (err) {
      console.error('Error rejecting update:', err);
      alert(`Error rejecting update: ${err.message}`);
    }
  };
  
  const handleDeferUpdate = async () => {
    try {
      setShowConfirmDialog(false);
      
      if (isDemo) {
        // Demo mode - show success message and redirect
        alert(`⏰ Demo: Update deferred successfully!\n\nReason: ${reason}\n\nIn production, this would schedule the update for later review.`);
        setLocation('/regulations/updates');
        return;
      }
      
      // API call to defer the update (signature is auto-generated on backend)
      const response = await fetch(`/api/regulation-updates/${updateId}/defer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          reason
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to defer update');
      }
      
      // Redirect to list
      setLocation('/regulations/updates');
      
    } catch (err) {
      console.error('Error deferring update:', err);
      // Show error notification
    }
  };
  
  const handleConfirmAction = () => {
    setShowConfirmDialog(false);
    
    if (action === 'approve') {
      handleApproveUpdate();
    } else if (action === 'reject' || action === 'defer') {
      // Show reason dialog for reject and defer actions
      setShowReasonDialog(true);
    }
  };
  
  const handleReasonSubmit = () => {
    setShowReasonDialog(false);
    
    if (action === 'reject') {
      handleRejectUpdate();
    } else if (action === 'defer') {
      handleDeferUpdate();
    }
  };
  
  const renderDiffContent = () => {
    if (!data || !data.diffData) return null;
    
    return data.diffData.differences.map((part, index) => {
      if (part.added) {
        return <span key={index} className="bg-green-100 text-green-800">{part.value}</span>;
      }
      if (part.removed) {
        return <span key={index} className="bg-red-100 text-red-800 line-through">{part.value}</span>;
      }
      return <span key={index}>{part.value}</span>;
    });
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-24" />
            </div>
            
            <Card className="mb-6">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
            
            <Tabs defaultValue="diff" className="mb-6">
              <TabsList>
                <Skeleton className="h-10 w-20 mr-2" />
                <Skeleton className="h-10 w-20 mr-2" />
                <Skeleton className="h-10 w-20" />
              </TabsList>
              <Skeleton className="h-64 w-full mt-4" />
            </Tabs>
            
            <div className="flex justify-end space-x-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-red-300">
              <CardHeader>
                <CardTitle className="text-red-600">Error Loading Update</CardTitle>
                <CardDescription>
                  We encountered an issue loading the regulation update.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Please try again later or contact support if the issue persists.</p>
              </CardContent>
              <CardFooter>
                <Button onClick={() => setLocation('/regulations/updates')}>
                  Return to Updates List
                </Button>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  
  const { update, original, diffData } = data;
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Regulation Update Review</h1>
              {isDemo && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  <PlayCircle className="h-3 w-3 mr-1" />
                  Demo Mode
                </Badge>
              )}
            </div>
            {diffData && (
              <Badge
                variant={
                  diffData.changedPercentage > 50 
                    ? 'destructive' 
                    : diffData.changedPercentage > 25 
                      ? 'warning' 
                      : 'secondary'
                }
                className="text-sm"
              >
                {diffData.changedPercentage}% Changed
              </Badge>
            )}
          </div>
      
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{update.name}</CardTitle>
              <CardDescription>
                Last updated: {new Date(update.updateDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Content Added:</p>
                  <p className="font-medium text-green-600">+{diffData.addedPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Content Removed:</p>
                  <p className="font-medium text-red-600">-{diffData.removedPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status:</p>
                  <p className="font-medium">{update.status.charAt(0).toUpperCase() + update.status.slice(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 📋 SUMMARY SECTION - Most Important! */}
          {update.summary && (
            <Card className="mb-6" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none'
            }}>
              <CardHeader>
                <CardTitle className="text-white">📋 Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p style={{fontSize: '1.1rem', lineHeight: '1.6', margin: 0}}>
                  {update.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* ✅ REQUIREMENTS SECTION */}
          {update.requirements && (
            <Card className="mb-6" style={{
              borderLeft: '4px solid #28a745'
            }}>
              <CardHeader>
                <CardTitle>✅ Compliance Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  margin: 0,
                  lineHeight: '1.6'
                }}>
                  {update.requirements}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* 📅 DEADLINES SECTION */}
          {update.filingDeadlines && (() => {
            try {
              const deadlines = typeof update.filingDeadlines === 'string' 
                ? JSON.parse(update.filingDeadlines) 
                : update.filingDeadlines;
              
              return (
                <Card className="mb-6" style={{
                  background: '#fff3cd',
                  borderLeft: '4px solid #ffc107'
                }}>
                  <CardHeader>
                    <CardTitle>📅 Important Deadlines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {deadlines.map((deadline: any, idx: number) => (
                        <div key={idx} style={{
                          background: 'white',
                          padding: '1rem',
                          borderRadius: '4px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{marginBottom: '0.5rem'}}>
                            <Badge variant="default" className="mr-2">
                              {deadline.type}
                            </Badge>
                            {deadline.recurring && (
                              <Badge variant="secondary">
                                🔁 Recurring
                              </Badge>
                            )}
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}>
                            <strong>{deadline.description}</strong>
                            <span style={{color: '#666', fontStyle: 'italic'}}>
                              {deadline.date}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            } catch (e) {
              return (
                <Card className="mb-6">
                  <CardContent>
                    <p className="text-red-600">Error parsing deadlines: {(e as Error).message}</p>
                  </CardContent>
                </Card>
              );
            }
          })()}

          {/* ℹ️ UPDATE METADATA */}
          {update.metadata && (
            <div className="mb-6 p-4 bg-gray-100 rounded-lg text-sm">
              <strong>Update Info:</strong> 
              {' '}ID #{update.id}
              {' • '}Source: {update.metadata.source || 'MCP_ENGINE'}
              {' • '}Received: {new Date(update.updateDate).toLocaleString()}
            </div>
          )}
          
          <Tabs defaultValue="diff" className="mb-6">
            <TabsList>
              <TabsTrigger value="diff">Differential View</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="updated">Updated</TabsTrigger>
            </TabsList>
            <TabsContent value="diff" className="p-4 border rounded-md min-h-[400px] whitespace-pre-wrap">
              {renderDiffContent()}
            </TabsContent>
            <TabsContent value="original" className="p-4 border rounded-md min-h-[400px] whitespace-pre-wrap">
              {original.content}
            </TabsContent>
            <TabsContent value="updated" className="p-4 border rounded-md min-h-[400px] whitespace-pre-wrap">
              {update.content}
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/regulations/updates')}
            >
              Back to List
            </Button>
            <Button 
              variant="secondary"
              onClick={() => {
                setAction('defer');
                setShowConfirmDialog(true);
              }}
            >
              <ClockIcon className="mr-2 h-4 w-4" />
              Defer
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                setAction('reject');
                setShowConfirmDialog(true);
              }}
            >
              <XIcon className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button 
              variant="success"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setAction('approve');
                setShowConfirmDialog(true);
              }}
            >
              <CheckIcon className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      </main>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Defer'} Regulation Update
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'approve' 
                ? 'Are you sure you want to approve this regulation update? This will mark it as accepted and apply the changes.' 
                : action === 'reject'
                  ? 'Are you sure you want to reject this regulation update? This will mark it as rejected.'
                  : 'Are you sure you want to defer this regulation update? This will mark it for later review.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Reason Dialog for Reject/Defer */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {action === 'reject' ? 'Reject' : 'Defer'} Regulation Update
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this action. Your signature will be automatically generated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  action === 'reject'
                    ? 'Reason for rejection...'
                    : 'Reason for deferral...'
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReasonSubmit}
              disabled={action === 'reject' && !reason.trim()}
            >
              {action === 'reject' ? 'Reject' : 'Defer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DifferentialViewPage;