import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy } from "lucide-react";
import type { Regulation } from "@shared/schema";

interface CommunicationDialogProps {
  regulation: Regulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateCommunicationStatement = (regulation: Regulation): string => {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `Public Notice of Regulatory Compliance
Date: ${date}

We are pleased to announce that our institution maintains active compliance with ${regulation.name}${regulation.statute ? ` (${regulation.statute})` : ''}.

This regulation, overseen by the ${regulation.agency_name} ${regulation.agency_department ? `through their ${regulation.agency_department}` : ''}, establishes essential standards for higher education institutions. Our commitment to maintaining these standards reflects our dedication to excellence and regulatory adherence.

Key Compliance Areas:
${regulation.requirements ? `${regulation.requirements.split('\n').filter(line => line.trim()).map(line => `• ${line.trim()}`).join('\n')}` : 'All applicable requirements have been met and verified.'}

Verification Status:
Our compliance with this regulation was last verified on ${new Date(regulation.lastVerified).toLocaleDateString()} and is regularly monitored to ensure continued adherence to all requirements.

For inquiries regarding our compliance status or for more detailed information, please contact our compliance office.

This notice is published as part of our commitment to transparency and regulatory compliance.`.trim();
};

export function CommunicationDialog({ regulation, open, onOpenChange }: CommunicationDialogProps) {
  const statement = generateCommunicationStatement(regulation);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(statement);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Community Communication Statement</DialogTitle>
          <DialogDescription>
            Preview the statement and copy the text for your communications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Section */}
          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium mb-2">Preview</h3>
            <div className="prose max-w-none space-y-4">
              {statement.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-sm">
                  {paragraph.split('\n').map((line, lineIndex) => (
                    <React.Fragment key={lineIndex}>
                      {line}
                      {lineIndex < paragraph.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </p>
              ))}
            </div>
          </div>

          {/* Plain Text Section */}
          <div className="relative">
            <h3 className="text-sm font-medium mb-2">Plain Text</h3>
            <ScrollArea className="h-[200px] w-full rounded-md border bg-muted p-4">
              <pre className="text-sm whitespace-pre-wrap break-words font-sans">{statement}</pre>
            </ScrollArea>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}