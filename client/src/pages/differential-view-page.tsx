import React, { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { diffWords } from 'diff';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckIcon, 
  XIcon, 
  ClockIcon, 
  AlertTriangle,
  FileText,
  Calendar,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  ListChecks,
  Hash,
  Globe,
  BookOpen,
  ArrowLeft,
  Info,
  Sparkles,
  ClipboardList,
  User,
  AlertCircle
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

interface DifferentialViewPageProps {
  isDemo?: boolean;
}

// Risk level color mapping
const getRiskColors = (level: string | null) => {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500', light: 'bg-red-50' };
    case 'SEVERE': return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', light: 'bg-orange-50' };
    case 'HIGH': return { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-500', light: 'bg-amber-50' };
    case 'MODERATE': return { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-500', light: 'bg-yellow-50' };
    case 'LOW': return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500', light: 'bg-green-50' };
    default: return { bg: 'bg-slate-500', text: 'text-white', border: 'border-slate-500', light: 'bg-slate-50' };
  }
};

const DifferentialViewPage: React.FC<DifferentialViewPageProps> = ({ isDemo = false }) => {
  const [match, params] = useRoute<{ id: string }>('/regulations/updates/:id');
  const [, setLocation] = useLocation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'defer' | null>(null);
  const [reason, setReason] = useState('');
  const [showDiffDetails, setShowDiffDetails] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  
  const updateId = match ? parseInt(params.id) : null;

  // Demo data
  const demoData = {
    update: {
      id: 'demo',
      name: 'Title IX Educational Amendments - 2024 Update',
      regulationName: 'Title IX of the Education Amendments',
      regKey: 'REG-002',
      summary: 'Major update to Title IX compliance requirements including new digital reporting systems, enhanced training requirements, and updated investigation timelines. This update reflects the 2024 federal requirements and best practices.',
      requirements: '• Implement enhanced digital reporting systems\n• Provide real-time case tracking for complainants\n• Complete investigations within 60 days (reduced from 90)\n• Implement trauma-informed investigation techniques\n• Offer virtual counseling options and 24/7 crisis support',
      filingDeadlines: JSON.stringify([
        { type: 'Annual Report', date: 'October 1st', description: 'Submit comprehensive annual report to Department of Education', recurring: true },
        { type: 'Incident Report', date: 'Within 24 hours', description: 'Report incidents via federal digital portal', recurring: false },
        { type: 'Training Certification', date: 'August 31st', description: 'Complete annual staff training certification', recurring: true }
      ]),
      updatedContent: 'Full updated regulation text would appear here...',
      originalContent: 'Original regulation text...',
      status: 'pending',
      updateDate: new Date().toISOString(),
      metadata: {
        source: 'MCP_ENGINE',
        federal_register_enhancement: { attempted: true, successful: true }
      }
    },
    original: {
      id: 2,
      name: 'Title IX of the Education Amendments',
      item_id: 'title-ix',
      reg_key: 'REG-002',
      category: 'Civil Rights & Non-Discrimination',
      topic: 'Civil Rights & Non-Discrimination',
      jurisdictionSource: 'federal',
      statute: '20 U.S.C. §§ 1681-1688',
      riskScore: 94,
      riskLevel: 'CRITICAL',
      agency_name: 'Department of Education',
      agency_url: 'https://www.ed.gov',
      requirements: 'Original requirements...',
      regulation_text: 'Original text...',
      content: 'Original content...'
    },
    diffData: {
      addedChars: 2847,
      removedChars: 423,
      changedChars: 2424,
      originalLength: 3421,
      updatedLength: 5845,
      addedPercentage: 83,
      removedPercentage: 12,
      changedPercentage: 71,
      differences: []
    }
  };
  
  const { data, isLoading, error } = useQuery({
    queryKey: isDemo ? ['demo-regulation-update'] : [`/api/regulation-updates/${updateId}`],
    queryFn: async () => {
      if (isDemo) {
        demoData.diffData.differences = diffWords(demoData.original.content, demoData.update.updatedContent);
        return demoData;
      }
      
      if (!updateId) throw new Error('No update ID provided');
      
      const response = await fetch(`/api/regulation-updates/${updateId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch regulation update: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const originalContent = data.original.requirements || data.original.regulation_text || data.original.content || '';
      const updatedContent = data.update.updatedContent || data.update.content || '';
      
      if (!data.diffData || !data.diffData.differences) {
        const differences = diffWords(originalContent, updatedContent);
        
        let addedChars = 0;
        let removedChars = 0;
        
        differences.forEach((part: any) => {
          if (part.added) addedChars += part.value.length;
          else if (part.removed) removedChars += part.value.length;
        });
        
        const originalLength = originalContent.length || 1;
        const updatedLength = updatedContent.length;
        
        data.diffData = {
          addedChars,
          removedChars,
          changedChars: Math.abs(updatedLength - originalLength),
          originalLength,
          updatedLength,
          addedPercentage: Math.round((addedChars / originalLength) * 100),
          removedPercentage: Math.round((removedChars / originalLength) * 100),
          changedPercentage: Math.round(((addedChars + removedChars) / originalLength) * 100),
          differences
        };
      }
      
      return data;
    },
    enabled: isDemo || !!updateId
  });
  
  // Action handlers
  const handleApproveUpdate = async () => {
    setShowConfirmDialog(false);
    if (isDemo) {
      alert('✅ Demo: Update approved!');
      setLocation('/regulations/updates');
      return;
    }
    
    try {
      const response = await fetch(`/api/regulation-updates/${updateId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      
      if (!response.ok) throw new Error('Failed to approve');
      setLocation('/regulations/updates');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const handleRejectUpdate = async () => {
    setShowConfirmDialog(false);
    if (isDemo) {
      alert(`❌ Demo: Update rejected!\nReason: ${reason}`);
      setLocation('/regulations/updates');
      return;
    }
    
    try {
      const response = await fetch(`/api/regulation-updates/${updateId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      
      if (!response.ok) throw new Error('Failed to reject');
      setLocation('/regulations/updates');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const handleDeferUpdate = async () => {
    setShowConfirmDialog(false);
    if (isDemo) {
      alert(`⏰ Demo: Update deferred!\nReason: ${reason}`);
      setLocation('/regulations/updates');
      return;
    }
    
    try {
      const response = await fetch(`/api/regulation-updates/${updateId}/defer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });
      
      if (!response.ok) throw new Error('Failed to defer');
      setLocation('/regulations/updates');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const handleConfirmAction = () => {
    setShowConfirmDialog(false);
    if (action === 'approve') handleApproveUpdate();
    else setShowReasonDialog(true);
  };
  
  const handleReasonSubmit = () => {
    setShowReasonDialog(false);
    if (action === 'reject') handleRejectUpdate();
    else if (action === 'defer') handleDeferUpdate();
  };

  // Parse deadlines
  const parseDeadlines = (deadlines: any) => {
    if (!deadlines) return [];
    try {
      return typeof deadlines === 'string' ? JSON.parse(deadlines) : deadlines;
    } catch {
      return [];
    }
  };

  // Render diff
  const renderDiff = () => {
    if (!data?.diffData?.differences) return null;
    return data.diffData.differences.map((part: any, i: number) => {
      if (part.added) return <span key={i} className="bg-green-200 text-green-900 px-0.5 rounded">{part.value}</span>;
      if (part.removed) return <span key={i} className="bg-red-200 text-red-900 px-0.5 rounded line-through">{part.value}</span>;
      return <span key={i}>{part.value}</span>;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Navigation />
        <main className="py-8">
          <div className="max-w-6xl mx-auto px-4">
            <Skeleton className="h-48 w-full mb-6 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-60 w-full rounded-xl" />
              </div>
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Navigation />
        <main className="py-8">
          <div className="max-w-4xl mx-auto px-4">
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Error Loading Update
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600 mb-4">Unable to load the regulation update. Please try again.</p>
                <Button onClick={() => setLocation('/regulations/updates')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Updates
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const { update, original, diffData, tasks = [] } = data;
  const riskColors = getRiskColors(original.riskLevel || original.risk_level);
  const deadlines = parseDeadlines(update.filingDeadlines);
  const requirements = update.requirements?.split('\n').filter((r: string) => r.trim()) || [];
  
  // Priority colors for tasks
  const getPriorityColors = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
      case 'high': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
      case 'medium': return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' };
      case 'low': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navigation />
      
      <main className="pb-32">
        {/* ═══════════════════════════════════════════════════════════════
            HERO HEADER - Regulation Identity
        ═══════════════════════════════════════════════════════════════ */}
        <div className={`relative overflow-hidden ${riskColors.light} border-b`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <div className="max-w-6xl mx-auto px-4 py-8 relative">
            {/* Back button */}
            <button 
              onClick={() => setLocation('/regulations/updates')}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Updates
            </button>
            
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Left: Identity */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  {/* REG Key Badge */}
                  {(original.reg_key || update.regKey) && (
                    <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-mono text-sm px-3 py-1">
                      <Hash className="h-3 w-3 mr-1" />
                      {original.reg_key || update.regKey}
                    </Badge>
                  )}
                  
                  {/* Priority Level - Reframed from "risk" to "importance" */}
                  {(original.riskLevel || original.risk_level) && (
                    <Badge className={`${riskColors.bg} ${riskColors.text} font-semibold px-3 py-1`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {(original.riskLevel || original.risk_level) === 'CRITICAL' ? 'Mission Critical' :
                       (original.riskLevel || original.risk_level) === 'SEVERE' ? 'Very High Priority' :
                       (original.riskLevel || original.risk_level) === 'HIGH' ? 'High Priority' :
                       (original.riskLevel || original.risk_level) === 'MODERATE' ? 'Moderate Priority' : 'Standard Priority'}
                    </Badge>
                  )}
                  
                  {/* Category */}
                  <Badge variant="outline" className="font-normal">
                    {original.category}
                  </Badge>
                  
                  {/* Jurisdiction */}
                  <Badge variant="outline" className="font-normal">
                    <Globe className="h-3 w-3 mr-1" />
                    {original.jurisdictionSource || 'Federal'}
                  </Badge>
                </div>
                
                {/* Regulation Name */}
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
                  {original.name || update.regulationName || update.name}
                </h1>
                
                {/* Statute */}
                {original.statute && (
                  <p className="text-slate-600 font-mono text-sm">
                    <BookOpen className="h-4 w-4 inline mr-2" />
                    {original.statute}
                  </p>
                )}
              </div>
              
              {/* Right: Priority Score - Subtle indicator */}
              {original.riskScore && (
                <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/80 border border-slate-200 shadow-sm">
                  <div className={`w-10 h-10 rounded-lg ${riskColors.bg} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${riskColors.text}`}>{original.riskScore}</span>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400">Priority</div>
                    <div className="text-sm font-semibold text-slate-700">
                      {original.riskLevel === 'CRITICAL' ? 'Mission Critical' :
                       original.riskLevel === 'SEVERE' ? 'Very High' :
                       original.riskLevel === 'HIGH' ? 'High Priority' :
                       original.riskLevel === 'MODERATE' ? 'Moderate' : 'Standard'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            CHANGE STATISTICS BAR
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-slate-900">Change Analysis</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-6">
                {/* Added */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-slate-600">Added:</span>
                  <span className="font-bold text-green-600">+{diffData.addedPercentage}%</span>
                  <span className="text-xs text-slate-400">({diffData.addedChars} chars)</span>
                </div>
                
                {/* Removed */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-600">Removed:</span>
                  <span className="font-bold text-red-600">-{diffData.removedPercentage}%</span>
                  <span className="text-xs text-slate-400">({diffData.removedChars} chars)</span>
                </div>
                
                {/* Total Change */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-slate-600">Total Change:</span>
                  <span className="font-bold text-blue-600">{diffData.changedPercentage}%</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full mt-2">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${Math.min(diffData.addedPercentage, 50)}%` }}
                  />
                  <div 
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${Math.min(diffData.removedPercentage, 50)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            MAIN CONTENT GRID
        ═══════════════════════════════════════════════════════════════ */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* ─────────────────────────────────────────────────────────
                LEFT COLUMN - Main Content (2/3)
            ───────────────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* SUMMARY SECTION */}
              {update.summary && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Update Summary</h2>
                  </div>
                  <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                    <CardContent className="p-6 pl-8">
                      <p className="text-slate-700 text-lg leading-relaxed">
                        {update.summary}
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* REQUIREMENTS SECTION */}
              {requirements.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-green-100">
                      <ListChecks className="h-5 w-5 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Compliance Requirements</h2>
                    <Badge variant="secondary">{requirements.length} items</Badge>
                  </div>
                  <Card className="border-green-200">
                    <CardContent className="p-0">
                      <ul className="divide-y divide-green-100">
                        {requirements.map((req: string, idx: number) => (
                          <li key={idx} className="p-4 hover:bg-green-50/50 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-bold">
                                {idx + 1}
                              </div>
                              <p className="text-slate-700 flex-1">
                                {req.replace(/^[•\-*]\s*/, '')}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* DEADLINES SECTION */}
              {deadlines.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <Calendar className="h-5 w-5 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Important Deadlines</h2>
                    <Badge variant="secondary">{deadlines.length} deadlines</Badge>
                  </div>
                  <div className="grid gap-4">
                    {deadlines.map((deadline: any, idx: number) => (
                      <Card key={idx} className="border-amber-200 hover:border-amber-300 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                  {deadline.type}
                                </Badge>
                                {deadline.recurring && (
                                  <Badge variant="outline" className="text-xs">
                                    🔁 Recurring
                                  </Badge>
                                )}
                              </div>
                              <p className="text-slate-700 font-medium">{deadline.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-lg font-bold text-amber-700">
                                {deadline.date || 'TBD'}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* COMPLIANCE TASKS SECTION - Hierarchical View */}
              {tasks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-100">
                      <ClipboardList className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Compliance Tasks</h2>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">{tasks.length} tasks</Badge>
                  </div>
                  
                  {/* Organize tasks hierarchically */}
                  {(() => {
                    // Separate parent tasks (no parent_task_id) from subtasks
                    const parentTasks = tasks.filter((t: any) => !t.parent_task_id);
                    const subtasksByParent = tasks.reduce((acc: any, task: any) => {
                      if (task.parent_task_id) {
                        if (!acc[task.parent_task_id]) acc[task.parent_task_id] = [];
                        acc[task.parent_task_id].push(task);
                      }
                      return acc;
                    }, {});
                    
                    // Sort parent tasks by sort_order
                    const sortedParents = parentTasks.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                    
                    return (
                      <div className="space-y-4">
                        {sortedParents.map((parentTask: any, sectionIndex: number) => {
                          const subtasks = subtasksByParent[parentTask.id] || [];
                          const sortedSubtasks = subtasks.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                          const parentPriority = getPriorityColors(parentTask.priority);
                          
                          return (
                            <Card key={parentTask.id} className={`border-l-4 ${parentPriority.border.replace('border-', 'border-l-')} overflow-hidden`}>
                              {/* Section Header (Parent Task) */}
                              <div className={`${parentPriority.bg} px-4 py-3 border-b`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/80 text-indigo-700 font-bold text-sm">
                                      {sectionIndex + 1}
                                    </span>
                                    <div>
                                      <h3 className="font-bold text-slate-900">{parentTask.title}</h3>
                                      {parentTask.assigned_role && (
                                        <span className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                                          <User className="h-3 w-3" />
                                          {parentTask.assigned_role}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={`${parentPriority.bg} ${parentPriority.text} ${parentPriority.border} text-xs`}>
                                      {parentTask.priority === 'critical' && <AlertCircle className="h-3 w-3 mr-1" />}
                                      {parentTask.priority}
                                    </Badge>
                                    {parentTask.due_date && (
                                      <Badge variant="outline" className="text-xs bg-white/80">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(parentTask.due_date).toLocaleDateString()}
                                      </Badge>
                                    )}
                                    {subtasks.length > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {subtasks.length} subtask{subtasks.length > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {parentTask.description && (
                                  <p className="text-sm text-slate-600 mt-2 ml-11">{parentTask.description}</p>
                                )}
                              </div>
                              
                              {/* Subtasks */}
                              {sortedSubtasks.length > 0 && (
                                <div className="divide-y divide-slate-100">
                                  {sortedSubtasks.map((subtask: any, subIndex: number) => {
                                    const subPriority = getPriorityColors(subtask.priority);
                                    return (
                                      <div key={subtask.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start gap-3 ml-8">
                                          {/* Subtask connector line */}
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="w-4 h-px bg-slate-300" />
                                            <span className={`w-6 h-6 rounded-full ${subPriority.bg} flex items-center justify-center text-xs font-medium ${subPriority.text}`}>
                                              {String.fromCharCode(97 + subIndex)}
                                            </span>
                                          </div>
                                          
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                              <h4 className="font-medium text-slate-800 text-sm">{subtask.title}</h4>
                                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <Badge className={`${subPriority.bg} ${subPriority.text} text-[10px] px-1.5 py-0`}>
                                                  {subtask.priority}
                                                </Badge>
                                                {subtask.evidence_required && (
                                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                                                    📎 evidence
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {subtask.description && (
                                              <p className="text-xs text-slate-500 mt-1">{subtask.description}</p>
                                            )}
                                            
                                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                                              {subtask.assigned_role && (
                                                <span className="flex items-center gap-1">
                                                  <User className="h-2.5 w-2.5" />
                                                  {subtask.assigned_role}
                                                </span>
                                              )}
                                              {subtask.due_date && (
                                                <span className="flex items-center gap-1">
                                                  <Calendar className="h-2.5 w-2.5" />
                                                  {new Date(subtask.due_date).toLocaleDateString()}
                                                </span>
                                              )}
                                              {subtask.evidence_type && subtask.evidence_type !== 'none' && (
                                                <span className="text-amber-500">
                                                  ({subtask.evidence_type})
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* No subtasks message */}
                              {sortedSubtasks.length === 0 && (
                                <div className="px-4 py-3 text-sm text-slate-500 ml-11">
                                  No subtasks for this section
                                </div>
                              )}
                            </Card>
                          );
                        })}
                        
                        {/* Show orphan tasks (subtasks without valid parent) if any */}
                        {tasks.filter((t: any) => t.parent_task_id && !parentTasks.find((p: any) => p.id === t.parent_task_id)).length > 0 && (
                          <Card className="border-slate-300 bg-slate-50">
                            <div className="px-4 py-3 border-b border-slate-200">
                              <h3 className="font-bold text-slate-700">Other Tasks</h3>
                            </div>
                            <div className="divide-y divide-slate-200">
                              {tasks
                                .filter((t: any) => t.parent_task_id && !parentTasks.find((p: any) => p.id === t.parent_task_id))
                                .map((task: any) => (
                                  <div key={task.id} className="px-4 py-3">
                                    <h4 className="font-medium text-slate-800 text-sm">{task.title}</h4>
                                    {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                                  </div>
                                ))}
                            </div>
                          </Card>
                        )}
                      </div>
                    );
                  })()}
                </section>
              )}

              {/* UPDATED CONTENT SECTION */}
              {update.updatedContent && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900">Updated Content</h2>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowDiffDetails(!showDiffDetails)}
                    >
                      {showDiffDetails ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                      {showDiffDetails ? 'Hide Diff' : 'Show Diff'}
                    </Button>
                  </div>
                  
                  {showDiffDetails ? (
                    <Card className="border-blue-200">
                      <CardHeader className="pb-2">
                        <CardDescription>
                          <span className="inline-flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs">Added text</span>
                            <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs line-through">Removed text</span>
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-slate-50 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-auto">
                          {renderDiff()}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-blue-200">
                      <CardContent className="p-6">
                        <div className="prose prose-slate max-w-none whitespace-pre-wrap">
                          {update.updatedContent}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </section>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────
                RIGHT COLUMN - Sidebar (1/3)
            ───────────────────────────────────────────────────────── */}
            <div className="space-y-6">
              
              {/* UPDATE STATUS CARD */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-slate-400" />
                    Update Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Update ID</div>
                      <div className="font-mono font-bold">#{update.id}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Status</div>
                      <Badge variant={update.status === 'pending' ? 'secondary' : 'default'}>
                        {update.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Received</div>
                    <div className="text-sm">{new Date(update.updateDate).toLocaleString()}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Regulation ID</div>
                    <div className="font-mono text-sm">{update.regulationId || original.id}</div>
                  </div>
                  
                  {original.item_id && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Item ID</div>
                      <div className="font-mono text-xs text-slate-600 break-all">{original.item_id}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AGENCY INFO CARD */}
              {(original.agency_name || original.agency_url) && (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-slate-400" />
                      Regulatory Agency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {original.agency_name && (
                      <div className="font-medium text-slate-900 mb-2">{original.agency_name}</div>
                    )}
                    {original.agency_url && (
                      <a 
                        href={original.agency_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        Visit Agency Website
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* SOURCE METADATA CARD */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-slate-400" />
                      Source Info
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowMetadata(!showMetadata)}
                    >
                      {showMetadata ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                        MCP Engine
                      </Badge>
                      {update.metadata?.federal_register_enhancement?.successful && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          ✓ Fed Register Enhanced
                        </Badge>
                      )}
                    </div>
                    
                    {showMetadata && update.metadata && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                        <pre className="text-xs text-slate-600 overflow-auto max-h-40">
                          {JSON.stringify(update.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ORIGINAL CONTENT CARD */}
              {(original.requirements || original.regulation_text) && (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-slate-400" />
                      Original Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-600 whitespace-pre-wrap max-h-40 overflow-auto bg-slate-50 p-3 rounded-lg">
                      {original.requirements || original.regulation_text || 'No original content available'}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          STICKY ACTION BAR
      ═══════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <div className="text-sm text-slate-500">Reviewing Update</div>
                <div className="font-semibold text-slate-900 truncate max-w-xs">
                  {original.name || update.name}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                size="lg"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => { setAction('defer'); setShowConfirmDialog(true); }}
              >
                <ClockIcon className="h-4 w-4 mr-2" />
                Defer
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => { setAction('reject'); setShowConfirmDialog(true); }}
              >
                <XIcon className="h-4 w-4 mr-2" />
                Reject
              </Button>
              
              <Button 
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                onClick={() => { setAction('approve'); setShowConfirmDialog(true); }}
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                Accept Update
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION DIALOG */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'approve' ? '✅ Accept' : action === 'reject' ? '❌ Reject' : '⏰ Defer'} Regulation Update
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === 'approve' 
                ? 'This will apply the update to the regulation. Are you sure?' 
                : action === 'reject'
                  ? 'This will reject the update. You\'ll need to provide a reason.'
                  : 'This will defer the update for later review.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* REASON DIALOG */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'reject' ? 'Rejection Reason' : 'Deferral Note'}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this action.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === 'reject' ? 'Why is this update being rejected?' : 'Why is this being deferred?'}
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleReasonSubmit}
              disabled={action === 'reject' && !reason.trim()}
            >
              {action === 'reject' ? 'Reject Update' : 'Defer Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DifferentialViewPage;
