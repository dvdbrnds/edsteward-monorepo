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
import { Copy } from "lucide-react";
import type { Regulation } from "@shared/schema";

interface WebPublishDialogProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateDrupalCode = (regulation: Regulation): string => {
  return `
<!-- Moravian University Compliance Information -->
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
</style>
`;
};

const generateUniversalCode = (regulation: Regulation): string => {
  return `
<!-- Universal Compliance Information -->
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
</div>
`;
};

export function WebPublishDialog({ regulation, open, onOpenChange }: WebPublishDialogProps) {
  const [activeTab, setActiveTab] = useState("drupal");
  
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
            Select your CMS platform and copy the generated code to publish this regulation's compliance information.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drupal">Drupal (Moravian)</TabsTrigger>
            <TabsTrigger value="universal">Universal HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="drupal">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This code is optimized for Moravian University's Drupal CMS. It includes styled components and responsive design.
              </p>
              <div className="relative">
                <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
                  <pre className="text-sm">{drupalCode}</pre>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(drupalCode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
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
                  <pre className="text-sm">{universalCode}</pre>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(universalCode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
