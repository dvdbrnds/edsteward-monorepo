import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check } from "lucide-react";
import type { Regulation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface WebPublishDialogProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const generateDrupalCode = (regulation: Regulation): string => {
  return `<!-- Moravian University Compliance Information -->
<div class="compliance-regulation">
  <h2>${regulation.name}</h2>

  <div class="regulation-metadata">
    <p class="regulation-id">Regulation ID: ${regulation.itemId}</p>
    <p class="regulation-category">${regulation.category}</p>
    <p class="last-verified">Last Verified: ${new Date(regulation.lastVerified).toLocaleDateString()}</p>
  </div>

  <div class="regulation-content">
    <h3>Summary</h3>
    <div class="regulation-summary">
      ${regulation.summary}
    </div>

    <h3>Requirements</h3>
    <div class="regulation-requirements">
      ${regulation.requirements}
    </div>
  </div>

  <div class="compliance-status">
    <p>Moravian University maintains active compliance with this regulation.</p>
    <p>For inquiries regarding our compliance status, please contact:</p>
    <p>${regulation.agency_name}<br>
    ${regulation.agency_department}</p>
  </div>
</div>

<style>
.compliance-regulation {
  max-width: 800px;
  margin: 2em auto;
  padding: 1.5em;
  font-family: inherit;
}

.regulation-metadata {
  background: #f5f5f5;
  padding: 1em;
  margin: 1em 0;
  border-radius: 4px;
}

.regulation-content {
  margin: 1.5em 0;
}

.regulation-summary, .regulation-requirements {
  margin: 1em 0;
  line-height: 1.6;
}

.compliance-status {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid #eee;
}
</style>`.trim();
};

const generateUniversalCode = (regulation: Regulation): string => {
  return `<!-- Universal Compliance Information -->
<div class="compliance-regulation">
  <h2>${regulation.name}</h2>

  <div class="regulation-metadata">
    <p><strong>Regulation ID:</strong> ${regulation.itemId}</p>
    <p><strong>Category:</strong> ${regulation.category}</p>
    <p><strong>Last Verified:</strong> ${new Date(regulation.lastVerified).toLocaleDateString()}</p>
  </div>

  <div class="regulation-content">
    <h3>Summary</h3>
    <div class="regulation-summary">
      ${regulation.summary}
    </div>

    <h3>Requirements</h3>
    <div class="regulation-requirements">
      ${regulation.requirements}
    </div>
  </div>

  <div class="compliance-status">
    <p>Our institution maintains active compliance with this regulation.</p>
    <p>For inquiries regarding our compliance status, please contact:</p>
    <p>${regulation.agency_name}<br>
    ${regulation.agency_department}</p>
  </div>
</div>`.trim();
};

export function WebPublishDialog({ regulation, open, onOpenChange, onComplete }: WebPublishDialogProps) {
  const [activeTab, setActiveTab] = useState("drupal");
  const [expandedSection, setExpandedSection] = useState<"preview" | "code" | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setHasCopied(true);
    toast({
      title: "Code Copied",
      description: "The website code has been copied to your clipboard.",
    });
    onComplete?.(); // Trigger completion callback when code is copied
  };

  const drupalCode = generateDrupalCode(regulation);
  const universalCode = generateUniversalCode(regulation);

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (!newOpen && hasCopied) {
          onComplete?.(); // Also trigger completion when dialog is closed after copying
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Website Publication Code</DialogTitle>
          <DialogDescription>
            Preview the generated content and copy the code for your CMS.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drupal">Drupal</TabsTrigger>
            <TabsTrigger value="universal">Universal HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="drupal">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This code is optimized for Drupal CMS. It includes styled components and responsive design.
              </p>

              {/* Preview Section */}
              <div className="relative rounded-md border bg-white p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Preview</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedSection(expandedSection === "preview" ? null : "preview")}
                  >
                    {expandedSection === "preview" ? "Show Less" : "Show More"}
                  </Button>
                </div>
                <ScrollArea className={`w-full transition-all ${expandedSection === "preview" ? "h-[400px]" : "h-[150px]"}`}>
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: drupalCode }}
                  />
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => handleCopy(drupalCode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              {/* Code Section */}
              <div className="relative rounded-md border bg-muted p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Code</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedSection(expandedSection === "code" ? null : "code")}
                    >
                      {expandedSection === "code" ? "Show Less" : "Show More"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(drupalCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ScrollArea className={`w-full transition-all ${expandedSection === "code" ? "h-[400px]" : "h-[150px]"}`}>
                  <pre className="text-sm whitespace-pre-wrap break-words">{drupalCode}</pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="universal">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This is a universal HTML version that works with any CMS or website platform.
              </p>

              {/* Preview Section */}
              <div className="relative rounded-md border bg-white p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Preview</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedSection(expandedSection === "preview" ? null : "preview")}
                  >
                    {expandedSection === "preview" ? "Show Less" : "Show More"}
                  </Button>
                </div>
                <ScrollArea className={`w-full transition-all ${expandedSection === "preview" ? "h-[400px]" : "h-[150px]"}`}>
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: universalCode }}
                  />
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => handleCopy(universalCode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              {/* Code Section */}
              <div className="relative rounded-md border bg-muted p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Code</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedSection(expandedSection === "code" ? null : "code")}
                    >
                      {expandedSection === "code" ? "Show Less" : "Show More"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(universalCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ScrollArea className={`w-full transition-all ${expandedSection === "code" ? "h-[400px]" : "h-[150px]"}`}>
                  <pre className="text-sm whitespace-pre-wrap break-words">{universalCode}</pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}