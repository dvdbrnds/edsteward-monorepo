import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Shield,
  Users,
  Eye,
  Building,
  Copy,
  CheckCheck,
  Check,
  X as XIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CanonicalRole {
  canonical: string;
  group: string;
  aliases: string[];
}

const CANONICAL_ROLES: CanonicalRole[] = [
  { canonical: "Compliance Officer", group: "Compliance", aliases: ["compliance", "institutional compliance officer", "director of compliance", "compliance reporting manager", "compliance staff", "compliance officer / president", "general counsel / compliance officer", "communications / compliance officer", "hr director / compliance officer"] },
  { canonical: "General Counsel", group: "Legal", aliases: ["legal counsel", "legal", "university counsel", "legal counsel and compliance officer"] },
  { canonical: "CFO", group: "Finance", aliases: ["chief financial officer", "controller", "accounting manager"] },
  { canonical: "HR Director", group: "Human Resources", aliases: ["human resources director", "human resources", "hr", "benefits manager", "payroll manager", "hr/training", "hr staff"] },
  { canonical: "Title IX Coordinator", group: "Civil Rights", aliases: ["title ix coordinator / general counsel", "title ix coordinator / student affairs", "hr/title ix", "general counsel / title ix coordinator"] },
  { canonical: "Clery Compliance Officer", group: "Campus Safety", aliases: [] },
  { canonical: "Financial Aid Director", group: "Enrollment & Financial Aid", aliases: ["financial aid officer", "financial aid counselor", "financial aid records manager", "financial aid verification coordinator", "student financial services director", "financial aid appeals officer", "student accounts manager"] },
  { canonical: "IT Security Officer", group: "Information Technology", aliases: ["ciso", "chief information security officer", "it security manager", "information security manager", "information security coordinator", "information security", "chief information officer", "data protection officer", "data security officer", "it security", "security assessment team lead", "incident response manager"] },
  { canonical: "Campus Police Chief", group: "Campus Safety", aliases: ["campus safety director", "campus safety", "campus police/security", "security director", "public safety director", "security officer", "campus police / campus security department", "campus police chief / emergency management director"] },
  { canonical: "Registrar", group: "Academic Records", aliases: ["records manager"] },
  { canonical: "VP Academic Affairs", group: "Academic Affairs", aliases: ["academic affairs", "provost", "chief academic officer", "academic affairs dean", "academic affairs director"] },
  { canonical: "VP Student Affairs", group: "Student Affairs", aliases: ["student affairs", "chief student affairs officer", "student affairs vice president", "vice president for student affairs", "student affairs assessment coordinator"] },
  { canonical: "Dean of Students", group: "Student Affairs", aliases: ["dean of students / student affairs", "student life director", "student conduct officer", "greek life director", "student health director", "housing director", "residence life", "counseling center", "health services director", "community service coordinator", "health services", "student affairs"] },
  { canonical: "Privacy Officer", group: "Compliance", aliases: ["chief privacy officer"] },
  { canonical: "President", group: "Executive", aliases: ["president/chancellor", "president / provost", "senior administration"] },
  { canonical: "Disability Services Coordinator", group: "Student Services", aliases: ["disability services", "disability services director", "ada coordinator", "ada/504 coordinator", "section 504 coordinator", "accessibility coordinator"] },
  { canonical: "Emergency Management Director", group: "Campus Safety", aliases: ["emergency response coordinator", "emergency management"] },
  { canonical: "Facilities Director", group: "Operations", aliases: ["facilities", "ehs director", "environmental health and safety director"] },
  { canonical: "Environmental Compliance Officer", group: "Compliance", aliases: ["environmental compliance manager", "environmental compliance specialist"] },
  { canonical: "Fire Safety Officer", group: "Campus Safety", aliases: ["safety officer"] },
  { canonical: "Export Control Officer", group: "Research & Compliance", aliases: ["ofac compliance officer"] },
  { canonical: "Research Compliance Officer", group: "Research & Compliance", aliases: ["research integrity officer", "research compliance", "vice president for research"] },
  { canonical: "Training Coordinator", group: "Human Resources", aliases: ["training director"] },
  { canonical: "Procurement Director", group: "Finance", aliases: ["procurement manager", "procurement officer", "procurement staff", "procurement security officer", "procurement"] },
  { canonical: "Internal Auditor", group: "Finance", aliases: ["quality assurance manager", "risk management officer"] },
  { canonical: "International Programs Director", group: "Academic Affairs", aliases: [] },
  { canonical: "Institutional Research Director", group: "Academic Affairs", aliases: ["institutional research", "assessment coordinator"] },
  { canonical: "Library Director", group: "Academic Affairs", aliases: [] },
  { canonical: "Ethics Officer", group: "Compliance", aliases: [] },
  { canonical: "Communications Director", group: "Communications", aliases: ["communications", "web services"] },
  { canonical: "Government Relations", group: "External Affairs", aliases: [] },
  { canonical: "Board Compensation Committee", group: "Governance", aliases: [] },
  { canonical: "Technology Transfer Officer", group: "Research & Compliance", aliases: ["patent attorney", "director of industry relations", "grants administrator"] },
  { canonical: "Title VI Coordinator", group: "Civil Rights", aliases: ["chief diversity officer"] },
  { canonical: "Admissions Director", group: "Enrollment & Financial Aid", aliases: [] },
  { canonical: "Curriculum Coordinator", group: "Academic Affairs", aliases: ["teacher preparation program director", "special education program coordinator"] },
];

const GROUP_COLORS: Record<string, string> = {
  "Compliance": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Legal": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "Finance": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Human Resources": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "Civil Rights": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "Campus Safety": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  "Enrollment & Financial Aid": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  "Information Technology": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  "Academic Records": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Academic Affairs": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  "Student Affairs": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "Student Services": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  "Executive": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  "Operations": "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400",
  "Research & Compliance": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  "Communications": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  "External Affairs": "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  "Governance": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

// Okta RBAC - secondary reference
interface OktaRole {
  name: string;
  displayName: string;
  description: string;
  oktaGroup: string;
  icon: React.ReactNode;
  badgeClass: string;
}

const OKTA_ROLES: OktaRole[] = [
  { name: "admin", displayName: "Administrator", description: "Full system access including settings and user management", oktaGroup: "EdSteward-Admin", icon: <Shield className="h-4 w-4" />, badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  { name: "compliance_officer", displayName: "Compliance Officer", description: "Manage regulations, approve updates, upload evidence", oktaGroup: "EdSteward-ComplianceOfficer", icon: <Users className="h-4 w-4" />, badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  { name: "department_head", displayName: "Department Head", description: "View and manage compliance for their department", oktaGroup: "EdSteward-DepartmentHead", icon: <Building className="h-4 w-4" />, badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  { name: "viewer", displayName: "Viewer", description: "Read-only access to assigned content", oktaGroup: "EdSteward-Viewer", icon: <Eye className="h-4 w-4" />, badgeClass: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
];

// Permission matrix data
interface PermissionGroup {
  label: string;
  permissions: { key: string; label: string }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: "Regulations", permissions: [
    { key: "canViewRegulations", label: "View regulations" },
    { key: "canEditRegulations", label: "Edit regulations" },
    { key: "canCreateRegulations", label: "Create regulations" },
    { key: "canDeleteRegulations", label: "Delete regulations" },
  ]},
  { label: "Compliance", permissions: [
    { key: "canApproveRegulationUpdates", label: "Approve regulation updates" },
    { key: "canRejectRegulationUpdates", label: "Reject regulation updates" },
    { key: "canSubmitComplianceReports", label: "Submit compliance reports" },
  ]},
  { label: "Evidence", permissions: [
    { key: "canUploadEvidence", label: "Upload evidence" },
    { key: "canDeleteEvidence", label: "Delete evidence" },
    { key: "canViewAllEvidence", label: "View all evidence" },
  ]},
  { label: "Reports", permissions: [
    { key: "canViewAllReports", label: "View all reports" },
    { key: "canViewDepartmentReports", label: "View department reports" },
    { key: "canExportReports", label: "Export reports" },
  ]},
  { label: "Users", permissions: [
    { key: "canViewUsers", label: "View users" },
    { key: "canEditUsers", label: "Edit users" },
    { key: "canCreateUsers", label: "Create users" },
    { key: "canDeleteUsers", label: "Delete users" },
  ]},
  { label: "Administration", permissions: [
    { key: "canAccessAdminPanel", label: "Access admin panel" },
    { key: "canManageSystemSettings", label: "Manage system settings" },
    { key: "canViewSystemLogs", label: "View system logs" },
  ]},
  { label: "Notifications", permissions: [
    { key: "canManageNotifications", label: "Manage notifications" },
    { key: "canSetDeadlines", label: "Set deadlines" },
    { key: "canViewAllDeadlines", label: "View all deadlines" },
  ]},
];

const OKTA_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: {
    canViewRegulations: true, canEditRegulations: true, canDeleteRegulations: true, canCreateRegulations: true,
    canViewUsers: true, canEditUsers: true, canDeleteUsers: true, canCreateUsers: true,
    canViewAllReports: true, canViewDepartmentReports: true, canExportReports: true,
    canAccessAdminPanel: true, canManageSystemSettings: true, canViewSystemLogs: true,
    canApproveRegulationUpdates: true, canRejectRegulationUpdates: true, canSubmitComplianceReports: true,
    canUploadEvidence: true, canDeleteEvidence: true, canViewAllEvidence: true,
    canManageNotifications: true, canSetDeadlines: true, canViewAllDeadlines: true,
  },
  compliance_officer: {
    canViewRegulations: true, canEditRegulations: true, canDeleteRegulations: false, canCreateRegulations: true,
    canViewUsers: true, canEditUsers: false, canDeleteUsers: false, canCreateUsers: false,
    canViewAllReports: true, canViewDepartmentReports: true, canExportReports: true,
    canAccessAdminPanel: false, canManageSystemSettings: false, canViewSystemLogs: false,
    canApproveRegulationUpdates: true, canRejectRegulationUpdates: true, canSubmitComplianceReports: true,
    canUploadEvidence: true, canDeleteEvidence: true, canViewAllEvidence: true,
    canManageNotifications: true, canSetDeadlines: true, canViewAllDeadlines: true,
  },
  department_head: {
    canViewRegulations: true, canEditRegulations: false, canDeleteRegulations: false, canCreateRegulations: false,
    canViewUsers: true, canEditUsers: false, canDeleteUsers: false, canCreateUsers: false,
    canViewAllReports: false, canViewDepartmentReports: true, canExportReports: true,
    canAccessAdminPanel: false, canManageSystemSettings: false, canViewSystemLogs: false,
    canApproveRegulationUpdates: false, canRejectRegulationUpdates: false, canSubmitComplianceReports: true,
    canUploadEvidence: true, canDeleteEvidence: false, canViewAllEvidence: false,
    canManageNotifications: false, canSetDeadlines: false, canViewAllDeadlines: false,
  },
  viewer: {
    canViewRegulations: true, canEditRegulations: false, canDeleteRegulations: false, canCreateRegulations: false,
    canViewUsers: false, canEditUsers: false, canDeleteUsers: false, canCreateUsers: false,
    canViewAllReports: false, canViewDepartmentReports: true, canExportReports: false,
    canAccessAdminPanel: false, canManageSystemSettings: false, canViewSystemLogs: false,
    canApproveRegulationUpdates: false, canRejectRegulationUpdates: false, canSubmitComplianceReports: false,
    canUploadEvidence: false, canDeleteEvidence: false, canViewAllEvidence: false,
    canManageNotifications: false, canSetDeadlines: false, canViewAllDeadlines: false,
  },
};

function PermCheck({ allowed }: { allowed: boolean }) {
  return allowed
    ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    : <XIcon className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

export function RoleMappingReference() {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [oktaOpen, setOktaOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      toast({ title: "Copied", description: `"${text}" copied to clipboard` });
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groups.map(g => g.name)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return CANONICAL_ROLES;
    const q = search.toLowerCase();
    return CANONICAL_ROLES.filter(
      r => r.canonical.toLowerCase().includes(q)
        || r.group.toLowerCase().includes(q)
        || r.aliases.some(a => a.toLowerCase().includes(q))
    );
  }, [search]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, CanonicalRole[]>();
    for (const role of filtered) {
      const existing = groupMap.get(role.group) || [];
      existing.push(role);
      groupMap.set(role.group, existing);
    }
    return Array.from(groupMap.entries())
      .map(([name, roles]) => ({ name, roles }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const totalAliases = CANONICAL_ROLES.reduce((n, r) => n + r.aliases.length, 0);

  return (
    <div className="space-y-6">
      {/* Canonical Compliance Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Canonical Compliance Roles</CardTitle>
              <CardDescription>
                {CANONICAL_ROLES.length} standardized roles across {new Set(CANONICAL_ROLES.map(r => r.group)).size} departments, 
                consolidating {totalAliases}+ variant titles found in federal and state regulations.
                These roles are used for task assignment and statutory responsibility tracking.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1 flex-shrink-0">
              {CANONICAL_ROLES.length} roles
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Why canonical roles exist */}
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-medium">Why canonical roles?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Federal and state regulations use hundreds of different titles to describe the same
              institutional responsibilities. One statute says "CISO," another says "Chief Information
              Security Officer," and a third says "IT Security Manager" — but they all mean the same
              person at your institution. Without normalization, task assignment breaks down: the same
              person ends up with three different role labels across three regulations, and no single
              view of their responsibilities exists.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              EdSteward consolidates these variants into <strong>{CANONICAL_ROLES.length} canonical roles</strong> so
              that every compliance task maps to one consistent title. You assign a real person to each
              canonical role once (in DRI Assignments below), and every regulation that references any
              variant of that title automatically routes to the right person.
            </p>
          </div>

          {/* Search & controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles, departments, or aliases..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles match "{search}"
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(({ name: groupName, roles }) => {
                const isExpanded = expandedGroups.has(groupName);
                const colorClass = GROUP_COLORS[groupName] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
                return (
                  <div key={groupName} className="border rounded-lg">
                    <button
                      onClick={() => toggleGroup(groupName)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                        <Badge variant="outline" className={colorClass}>{groupName}</Badge>
                        <span className="text-sm text-muted-foreground">{roles.length} role{roles.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {roles.map(r => (
                          <span key={r.canonical} className="text-xs text-muted-foreground hidden md:inline">
                            {r.canonical}
                          </span>
                        ))}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {roles.map(role => (
                          <div key={role.canonical} className="border rounded-md p-3 space-y-2 bg-muted/20">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{role.canonical}</span>
                              <Badge variant="outline" className={colorClass + " text-[10px]"}>
                                {role.group}
                              </Badge>
                            </div>
                            {role.aliases.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Also known as ({role.aliases.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {role.aliases.map(alias => (
                                    <span
                                      key={alias}
                                      className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground"
                                    >
                                      {alias}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {role.aliases.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">No known aliases</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">How canonical roles work</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- When regulations are ingested, the AI identifies which roles are legally responsible for each compliance task</li>
              <li>- Variant titles (e.g. "CISO", "Chief Information Security Officer", "IT Security Manager") are normalized to a canonical name (<strong>IT Security Officer</strong>)</li>
              <li>- The DRI Assignments section below lets you map each canonical role to a real person at your institution</li>
              <li>- Tasks are then auto-assigned to the right person based on this mapping</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* SSO Access Roles (collapsible) */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOktaOpen(!oktaOpen)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">SSO Access Roles</CardTitle>
              <CardDescription>
                Okta group names that control platform access levels
              </CardDescription>
            </div>
            {oktaOpen
              ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
              : <ChevronRight className="h-5 w-5 text-muted-foreground" />
            }
          </div>
        </CardHeader>
        {oktaOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OKTA_ROLES.map(role => (
                <div key={role.name} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {role.icon}
                      <span className="font-medium text-sm">{role.displayName}</span>
                    </div>
                    <Badge variant="outline" className={role.badgeClass}>{role.name}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                  <button
                    onClick={() => copyToClipboard(role.oktaGroup)}
                    className="flex items-center gap-2 w-full text-left group"
                  >
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1">{role.oktaGroup}</code>
                    {copiedText === role.oktaGroup
                      ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      : <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    }
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                Users are assigned to Okta groups in your identity provider. On sign-in, the highest-priority
                matching group determines their access level. No matching group defaults to <strong>Viewer</strong>.
              </p>
            </div>

            {/* Permission Matrix */}
            <div className="border rounded-lg">
              <button
                onClick={(e) => { e.stopPropagation(); setPermissionsOpen(!permissionsOpen); }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <span className="font-medium text-sm">Permission Matrix</span>
                {permissionsOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {permissionsOpen && (
                <div className="px-4 pb-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Permission</TableHead>
                        {OKTA_ROLES.map(role => (
                          <TableHead key={role.name} className="text-center w-[120px]">
                            <div className="flex flex-col items-center gap-1">
                              {role.icon}
                              <span className="text-xs">{role.displayName}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSION_GROUPS.map(group => (
                        <>
                          <TableRow key={group.label} className="bg-muted/30">
                            <TableCell colSpan={OKTA_ROLES.length + 1} className="font-medium text-xs uppercase tracking-wide text-muted-foreground py-2">
                              {group.label}
                            </TableCell>
                          </TableRow>
                          {group.permissions.map(perm => (
                            <TableRow key={perm.key}>
                              <TableCell className="text-sm">{perm.label}</TableCell>
                              {OKTA_ROLES.map(role => (
                                <TableCell key={role.name} className="text-center">
                                  <div className="flex justify-center">
                                    <PermCheck allowed={!!OKTA_PERMISSIONS[role.name]?.[perm.key]} />
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
