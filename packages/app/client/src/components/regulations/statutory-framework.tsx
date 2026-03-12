import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Scale, ExternalLink, ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskCitation {
  id: number;
  title: string;
  statutoryCitation: string;
  statutoryLanguage?: string | null;
  parentTaskId?: number | null;
}

interface StatutoryFrameworkProps {
  statute: string;
  regulationText?: string | null;
  taskCitations?: TaskCitation[];
  renderMarkdown: (text: string) => string;
}

// ── Citation metadata lookup tables ──

const CODE_NAMES: Record<string, string> = {
  "U.S.C.": "United States Code", "USC": "United States Code",
  "C.F.R.": "Code of Federal Regulations", "CFR": "Code of Federal Regulations",
  "P.S.": "Pennsylvania Statutes", "Pa.C.S.": "Pennsylvania Consolidated Statutes",
  "Pa. Code": "Pennsylvania Code",
};

const TITLE_NAMES: Record<string, Record<string, string>> = {
  "U.S.C.": { "20": "Education", "29": "Labor", "34": "Crime Control", "42": "Public Health & Welfare", "15": "Commerce & Trade" },
  "USC": { "20": "Education", "29": "Labor", "34": "Crime Control", "42": "Public Health & Welfare", "15": "Commerce & Trade" },
  "C.F.R.": { "34": "Education", "45": "Public Welfare", "29": "Labor", "42": "Public Health" },
  "CFR": { "34": "Education", "45": "Public Welfare", "29": "Labor", "42": "Public Health" },
  "P.S.": { "24": "Education", "18": "Crimes & Offenses", "35": "Health & Safety" },
  "Pa.C.S.": { "18": "Crimes & Offenses", "24": "Education", "42": "Judiciary" },
  "Pa. Code": { "22": "Education" },
};

// ── Citation regex that works on inline text ──

const CITATION_PATTERNS = [
  // USC/CFR/PA with section symbol: "20 U.S.C. § 1092(f)(1)"
  /(\d+)\s+(U\.S\.C\.|USC|C\.F\.R\.|CFR|P\.S\.|Pa\.C\.S\.|Pa\.\s*Code)\s*§§?\s*([\d\w.\-–()]+(?:\s*[-–]\s*[\d\w.\-–()]+)?)/g,
  // CFR part notation: "34 CFR 668.46(b)"
  /(\d+)\s+(CFR)\s+(?:Part\s+)?([\d]+(?:\.[\d]+)?(?:\([a-zA-Z0-9]+\))*)/g,
];

interface FoundCitation {
  id: string;
  raw: string;
  title?: string;
  titleName?: string;
  code: string;
  codeName: string;
  section: string;
  textOffset: number;
}

function findAllCitations(text: string): FoundCitation[] {
  const results: FoundCitation[] = [];
  const seen = new Set<string>();

  for (const pattern of CITATION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const raw = match[0];
      const titleNum = match[1];
      const code = match[2].replace(/\s+/g, ' ');
      const section = match[3];
      const key = `${titleNum}-${code}-${section}`;

      if (!seen.has(key)) {
        seen.add(key);
        const titleLookup = TITLE_NAMES[code] || {};
        results.push({
          id: `cite-${results.length}`,
          raw,
          title: titleNum,
          titleName: titleLookup[titleNum],
          code,
          codeName: CODE_NAMES[code] || code,
          section,
          textOffset: match.index,
        });
      }
    }
  }

  return results.sort((a, b) => a.textOffset - b.textOffset);
}

function getCitationUrl(title: string | undefined, code: string, section: string): string | null {
  const sec = section.replace(/–/g, '-').split('(')[0];
  if ((code === "U.S.C." || code === "USC") && title) {
    return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${title}-section${sec}&num=0&edition=prelim`;
  }
  if ((code === "C.F.R." || code === "CFR") && title) {
    const part = sec.split('.')[0];
    return `https://www.ecfr.gov/current/title-${title}/part-${part}`;
  }
  return null;
}

// ── Annotate HTML with anchor spans for each citation found in the source text ──

function annotateHtml(html: string, citations: FoundCitation[]): string {
  if (citations.length === 0) return html;

  let result = html;
  // Process citations from last to first so offsets don't shift
  const sorted = [...citations].sort((a, b) => b.raw.length - a.raw.length);

  for (const cite of sorted) {
    const escaped = cite.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<!id=")(?<!data-cite=")${escaped}`, 'g');
    result = result.replace(re, (match) =>
      `<span class="statutory-anchor" id="${cite.id}" data-cite="${cite.id}">${match}</span>`
    );
  }
  return result;
}

// ── Main component ──

export function StatutoryFramework({ statute, regulationText, taskCitations, renderMarkdown }: StatutoryFrameworkProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Parse the top-level statute string for the header
  const topCitations = useMemo(() => findAllCitations(statute), [statute]);

  // Find all citations embedded in the regulation text
  const textCitations = useMemo(() => {
    if (!regulationText) return [];
    return findAllCitations(regulationText);
  }, [regulationText]);

  // Build the annotated HTML
  const annotatedHtml = useMemo(() => {
    if (!regulationText) return "";
    const rawHtml = renderMarkdown(regulationText);
    return annotateHtml(rawHtml, textCitations);
  }, [regulationText, textCitations, renderMarkdown]);

  // Map task citations to text citations for the sidebar
  const tasksByCitation = useMemo(() => {
    if (!taskCitations) return new Map<string, TaskCitation[]>();
    const map = new Map<string, TaskCitation[]>();
    for (const tc of taskCitations) {
      const key = tc.statutoryCitation.replace(/^§\s*/, '');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tc);
    }
    return map;
  }, [taskCitations]);

  // IntersectionObserver to track which citation is currently in view
  useEffect(() => {
    const container = textRef.current;
    if (!container || textCitations.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCite(entry.target.id);
          }
        }
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    const anchors = container.querySelectorAll('.statutory-anchor');
    anchors.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [annotatedHtml, textCitations]);

  const scrollToCitation = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('citation-flash');
      setTimeout(() => el.classList.remove('citation-flash'), 1500);
    }
  }, []);

  const hasText = !!regulationText;
  const hasCitations = textCitations.length > 0;

  return (
    <div className="space-y-4">
      {/* Top-level statute badge */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
        <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {topCitations.map((c, i) => (
          <div key={i} className="inline-flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-xs gap-1 py-1">
              {c.title && <span className="text-muted-foreground">{c.title}</span>}
              <span>{c.code}</span>
              <span className="font-semibold">§ {c.section}</span>
            </Badge>
            {c.titleName && (
              <span className="text-xs text-muted-foreground">{c.titleName}</span>
            )}
            {getCitationUrl(c.title, c.code, c.section) && (
              <a
                href={getCitationUrl(c.title, c.code, c.section)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
                title="View source"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Document reader with margin annotations */}
      {hasText && (
        <div className="relative">
          {/* Sidebar toggle */}
          {hasCitations && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ListTree className="h-3.5 w-3.5" />
              {sidebarOpen ? "Hide" : "Show"} section guide
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{textCitations.length}</Badge>
            </button>
          )}

          <div className={`flex gap-0 ${hasCitations && sidebarOpen ? '' : ''}`}>
            {/* Section guide sidebar */}
            {hasCitations && sidebarOpen && (
              <div className="hidden md:block w-52 flex-shrink-0 pr-3 border-r mr-4">
                <div className="sticky top-4 space-y-0.5 max-h-[70vh] overflow-y-auto">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
                    Sections
                  </div>
                  {textCitations.map((cite) => {
                    const isActive = activeCite === cite.id;
                    const tasks = tasksByCitation.get(cite.section) || [];
                    return (
                      <button
                        key={cite.id}
                        onClick={() => scrollToCitation(cite.id)}
                        className={`
                          w-full text-left px-2 py-1.5 rounded text-xs transition-all
                          ${isActive
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-l-2 border-blue-500'
                            : 'hover:bg-muted/60 text-muted-foreground border-l-2 border-transparent'
                          }
                        `}
                      >
                        <div className="font-mono font-medium leading-tight">
                          § {cite.section}
                        </div>
                        {cite.titleName && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                            {cite.code} — {cite.titleName}
                          </div>
                        )}
                        {tasks.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {tasks.slice(0, 3).map(t => (
                              <div key={t.id} className="text-[10px] text-muted-foreground leading-tight truncate pl-1 border-l border-muted-foreground/20">
                                {t.title}
                              </div>
                            ))}
                            {tasks.length > 3 && (
                              <div className="text-[10px] text-muted-foreground/60 pl-1">
                                +{tasks.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main text with inline anchors */}
            <div className="flex-1 min-w-0">
              <div
                ref={textRef}
                className="
                  prose prose-sm max-w-none text-foreground
                  [&_.statutory-anchor]:text-blue-700
                  [&_.statutory-anchor]:dark:text-blue-400
                  [&_.statutory-anchor]:font-semibold
                  [&_.statutory-anchor]:border-b
                  [&_.statutory-anchor]:border-blue-300
                  [&_.statutory-anchor]:dark:border-blue-700
                  [&_.statutory-anchor]:border-dashed
                  [&_.statutory-anchor]:cursor-pointer
                  [&_.statutory-anchor:hover]:bg-blue-50
                  [&_.statutory-anchor:hover]:dark:bg-blue-950/40
                  [&_.statutory-anchor.citation-flash]:bg-yellow-100
                  [&_.statutory-anchor.citation-flash]:dark:bg-yellow-900/40
                  [&_.statutory-anchor.citation-flash]:transition-colors
                  [&_.statutory-anchor.citation-flash]:duration-1000
                "
                dangerouslySetInnerHTML={{ __html: annotatedHtml }}
              />
            </div>
          </div>

          {/* Mobile: horizontal citation chips below text */}
          {hasCitations && sidebarOpen && (
            <div className="md:hidden flex flex-wrap gap-1.5 mt-4 pt-3 border-t">
              {textCitations.map((cite) => (
                <button
                  key={cite.id}
                  onClick={() => scrollToCitation(cite.id)}
                  className={`
                    inline-flex items-center px-2 py-1 rounded-full text-[11px] font-mono border transition-colors
                    ${activeCite === cite.id
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-800 dark:text-blue-200'
                      : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted'
                    }
                  `}
                >
                  § {cite.section}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasText && (
        <p className="text-muted-foreground italic text-sm">
          Full regulation text is not available. Use the citation above to look up the source.
        </p>
      )}
    </div>
  );
}
