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
import { Copy, Eye } from "lucide-react";
import type { Regulation } from "@shared/schema";

interface WebPublishDialogProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function WebPublishDialog({ regulation, open, onOpenChange }: WebPublishDialogProps) {
  const [activeTab, setActiveTab] = useState("drupal");
  const [viewMode, setViewMode] = useState<"code" | "preview">("preview");

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
  };

  const drupalCode = generateDrupalCode(regulation);
  const universalCode = generateUniversalCode(regulation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Website Publication Code</DialogTitle>
          <DialogDescription>
            Preview how your compliance information will look, then copy the generated code for your CMS.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drupal">Drupal</TabsTrigger>
            <TabsTrigger value="universal">Universal HTML</TabsTrigger>
          </TabsList>

          <div className="flex justify-end mt-2 mb-4">
            <div className="inline-flex rounded-md shadow-sm">
              <Button
                variant={viewMode === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("preview")}
                className="rounded-l-md rounded-r-none"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                variant={viewMode === "code" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("code")}
                className="rounded-l-none rounded-r-md"
              >
                <Copy className="h-4 w-4 mr-2" />
                Code
              </Button>
            </div>
          </div>

          <TabsContent value="drupal">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This code is optimized for Drupal CMS. It includes styled components and responsive design.
              </p>
              <div className="relative">
                <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
                  {viewMode === "preview" ? (
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: drupalCode }}
                    />
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap break-words">{drupalCode}</pre>
                  )}
                </ScrollArea>
                {viewMode === "code" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(drupalCode)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="universal">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This is a universal HTML version that works with any CMS or website platform.
              </p>
              <div className="relative">
                <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
                  {viewMode === "preview" ? (
                    <div 
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: universalCode }}
                    />
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap break-words">{universalCode}</pre>
                  )}
                </ScrollArea>
                {viewMode === "code" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(universalCode)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}