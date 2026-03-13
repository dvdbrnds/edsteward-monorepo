import { useState } from "react";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION, FULL_VERSION } from "@/lib/version";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Bug,
  Wrench,
  ShieldCheck,
  ArrowLeft,
  Tag,
} from "lucide-react";
import { Link } from "wouter";

interface ChangeEntry {
  text: string;
  highlight?: boolean;
}

interface VersionEntry {
  version: string;
  date: string;
  milestone?: string;
  added?: ChangeEntry[];
  changed?: ChangeEntry[];
  fixed?: ChangeEntry[];
  security?: ChangeEntry[];
}

const CHANGELOG: VersionEntry[] = [
  {
    version: "1.5.1",
    date: "2026-03-12",
    milestone: "Smart Compliance Actions",
    added: [
      { text: "Automatic compliance action detection — the system now identifies which compliance steps each regulation requires (attestation, website publish, community communication, agency submission) and enables them automatically", highlight: true },
      { text: "This \"What's New\" page — click the version badge in the nav bar anytime to see what's changed" },
    ],
    changed: [
      { text: "Regulation actions now reflect actual statutory obligations instead of defaulting to attestation-only" },
      { text: "Your existing completion progress is preserved when regulation requirements are updated" },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-02-12",
    milestone: "Executive Orders & Reliability",
    added: [
      { text: "Executive Order tracking and impact assessment across your regulations" },
      { text: "Richer regulation data — risk assessments, deliverable templates, and reporting requirements now available" },
      { text: "Full review of incoming regulation data before it's applied — CCO sees the complete picture" },
    ],
    fixed: [
      { text: "Duplicate compliance tasks no longer appear after regulation updates" },
      { text: "Completed attestations and evidence are never overwritten during updates" },
      { text: "Attestation checkmarks now display bright green for all completed actions" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-01-06",
    milestone: "Institutional Isolation",
    added: [
      { text: "Each institution's data is fully isolated in its own secure database" },
    ],
    security: [
      { text: "API rate limiting to protect against abuse" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-02",
    milestone: "Production Launch",
    added: [
      { text: "Dark mode — toggle in the navigation bar or user menu" },
      { text: "Executive analytics dashboard with compliance metrics and trends" },
      { text: "Task scheduler with configurable reminders" },
      { text: "Bulk operations for compliance tasks" },
      { text: "Keyboard shortcuts for power users (press ? to see them)" },
      { text: "Deadline calendar view on dashboard" },
      { text: "Quick attestation directly from the dashboard" },
      { text: "Audit trail CSV export" },
      { text: "\"My Tasks\" focused view for compliance officers" },
    ],
  },
  {
    version: "0.9.0",
    date: "2025-12-13",
    milestone: "Compliance Tasks",
    added: [
      { text: "One-click email attestation for low-risk regulations" },
      { text: "Task detail view with evidence upload" },
      { text: "Compliance task workflows for complex regulations (Clery Act, FERPA, Title IX)" },
    ],
    changed: [
      { text: "Redesigned regulation detail page with hero section and accordion layout" },
    ],
  },
  {
    version: "0.8.0",
    date: "2025-12-04",
    added: [
      { text: "Regulation ownership — compliance officers see only their assigned regulations" },
      { text: "Escalation feature for overdue items" },
      { text: "Colored status badges across the application" },
    ],
  },
  {
    version: "0.7.0",
    date: "2025-11-17",
    milestone: "Single Sign-On",
    fixed: [
      { text: "Okta SSO role mapping verified and fully operational" },
    ],
  },
  {
    version: "0.6.0",
    date: "2025-10-24",
    milestone: "Audit Trail",
    added: [
      { text: "Comprehensive audit trail for compliance tracking" },
      { text: "Compliance status card on regulation detail pages" },
      { text: "Evidence file upload" },
    ],
  },
  {
    version: "0.5.0",
    date: "2025-09-29",
    milestone: "Multi-Factor Auth",
    added: [
      { text: "Multi-factor authentication (MFA) for enhanced account security" },
    ],
    security: [
      { text: "Role-based access control via Okta group mapping" },
    ],
  },
  {
    version: "0.4.0",
    date: "2025-09-23",
    added: [
      { text: "Regulation version control — see what changed between updates" },
      { text: "\"Accept All\" button for processing regulation updates in bulk" },
    ],
  },
  {
    version: "0.3.0",
    date: "2025-09-10",
    milestone: "SAML/SSO",
    added: [
      { text: "SAML/SSO authentication via Okta" },
      { text: "Federal Register integration — richer regulation data automatically" },
    ],
  },
  {
    version: "0.2.0",
    date: "2025-02-20",
    added: [
      { text: "Email notifications with automated deadline reminders (90-day, weekly, daily)" },
      { text: "Admin user management and password reset" },
      { text: "Pennsylvania state regulations" },
      { text: "Bug report button on all pages" },
    ],
  },
  {
    version: "0.1.0",
    date: "2025-02-12",
    milestone: "Initial Release",
    added: [
      { text: "User authentication" },
      { text: "Regulations management dashboard" },
      { text: "Compliance overview with pie charts" },
    ],
  },
];

function SectionIcon({ type }: { type: string }) {
  switch (type) {
    case "added": return <Sparkles className="h-4 w-4 text-emerald-500" />;
    case "changed": return <Wrench className="h-4 w-4 text-blue-500" />;
    case "fixed": return <Bug className="h-4 w-4 text-amber-500" />;
    case "security": return <ShieldCheck className="h-4 w-4 text-red-500" />;
    default: return null;
  }
}

function SectionLabel({ type }: { type: string }) {
  const labels: Record<string, { text: string; className: string }> = {
    added: { text: "Added", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    changed: { text: "Changed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    fixed: { text: "Fixed", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    security: { text: "Security", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };
  const config = labels[type];
  if (!config) return null;
  return <Badge variant="outline" className={config.className}>{config.text}</Badge>;
}

function VersionBlock({ entry, isLatest }: { entry: VersionEntry; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);
  const isCurrent = entry.version === APP_VERSION || isLatest;
  const sections = (["added", "changed", "fixed", "security"] as const).filter(
    (key) => entry[key] && entry[key]!.length > 0
  );
  const totalChanges = sections.reduce((n, key) => n + (entry[key]?.length || 0), 0);

  return (
    <div className={`border rounded-lg transition-all ${isCurrent ? "border-primary/40 shadow-sm" : "border-border"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-semibold text-foreground">v{entry.version}</span>
          {isCurrent && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">Current</Badge>
          )}
          {entry.milestone && (
            <Badge variant="outline" className="text-xs hidden sm:inline-flex">{entry.milestone}</Badge>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{totalChanges} change{totalChanges !== 1 ? "s" : ""}</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Mobile date */}
          <div className="sm:hidden text-sm text-muted-foreground">
            {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>

          {sections.map((sectionKey) => {
            const items = entry[sectionKey]!;
            return (
              <div key={sectionKey} className="space-y-2">
                <div className="flex items-center gap-2">
                  <SectionIcon type={sectionKey} />
                  <SectionLabel type={sectionKey} />
                </div>
                <ul className="space-y-1.5 ml-6">
                  {items.map((item, i) => (
                    <li
                      key={i}
                      className={`text-sm leading-relaxed ${
                        item.highlight
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="mr-1.5 text-muted-foreground/60">-</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">What's New</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Release history for EdSteward Compliance Portal
                </p>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {FULL_VERSION}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {CHANGELOG.map((entry, i) => (
              <VersionBlock key={entry.version} entry={entry} isLatest={i === 0} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
