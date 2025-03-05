
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clipboard,
  ExternalLink,
  File,
  FileText,
  Link2,
  ListChecks,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Regulation } from "@shared/schema";
import NoteSection from "@/components/regulations/note-section";
import Navigation from "@/components/layout/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function RegulationDetailPage({
  regulation,
}: {
  regulation: Regulation;
}) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "compliance_officer";

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/regulations")}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Regulations
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/regulations/${regulation.id}/edit`)
                }
                className="ml-auto flex items-center"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Regulation
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() =>
                  navigate(`/compliance-wizard/${regulation.id}`)
                }
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Compliance Wizard
              </Button>
            )}
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  {regulation.name}
                </h3>
                <Badge
                  variant="secondary"
                  className="ml-auto text-xs font-medium text-gray-500"
                >
                  ID: {regulation.itemId}
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {regulation.topic} • {regulation.category}
              </p>
            </div>

            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <div className="px-4 sm:px-6">
                <TabsList className="mt-4 mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="details">Additional Details</TabsTrigger>
                  <TabsTrigger value="deadlines">
                    Deadlines & Requirements
                  </TabsTrigger>
                  <TabsTrigger value="notes">Notes & Activities</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="p-4 sm:p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Summary
                    </h3>
                    <p className="mt-1 text-gray-700 whitespace-pre-line">
                      {regulation.summary || "No summary provided."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Statutory Reference
                    </h3>
                    <p className="mt-1 text-gray-700">
                      {regulation.statute}
                      {regulation.statuteIds && (
                        <span className="ml-2 text-sm text-gray-500">
                          (ID: {regulation.statuteIds})
                        </span>
                      )}
                    </p>
                  </div>

                  {regulation.requirements && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        Requirements
                      </h3>
                      <p className="mt-1 text-gray-700 whitespace-pre-line">
                        {regulation.requirements}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <Badge
                      variant={
                        regulation.jurisdiction === "federal"
                          ? "default"
                          : "outline"
                      }
                    >
                      {regulation.jurisdiction === "federal"
                        ? "Federal"
                        : "State"}
                    </Badge>
                    <Badge
                      variant={regulation.isApplicable ? "success" : "destructive"}
                    >
                      {regulation.isApplicable ? "Applicable" : "Not Applicable"}
                    </Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Always show Origination Date - required field */}
                  <div>
                    <h3 className="font-medium text-gray-900">Origination Date</h3>
                    <p className="text-gray-700 mt-1">
                      {regulation?.originationDate 
                        ? format(new Date(regulation.originationDate), "PP")
                        : <span className="text-red-500">Not specified (Required)</span>}
                    </p>
                  </div>
                  
                  {/* Always show Issuing Agency - required field */}
                  <div>
                    <h3 className="font-medium text-gray-900">Issuing Agency</h3>
                    <p className="text-gray-700 mt-1">
                      {regulation?.agency_name 
                        ? regulation.agency_name
                        : <span className="text-red-500">Not specified (Required)</span>}
                    </p>
                  </div>
                  
                  {/* Always show Regulation URL - required field */}
                  <div>
                    <h3 className="font-medium text-gray-900">Regulation URL</h3>
                    <p className="text-gray-700 mt-1">
                      {regulation?.regulationUrl 
                        ? <a href={regulation.regulationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{regulation.regulationUrl}</a>
                        : <span className="text-red-500">Not specified (Required)</span>}
                    </p>
                  </div>
                  
                  {regulation?.effectiveDate && (
                    <div>
                      <h3 className="font-medium text-gray-900">Effective Date</h3>
                      <p className="text-gray-700 mt-1">
                        {format(new Date(regulation.effectiveDate), "PP")}
                      </p>
                    </div>
                  )}

                  {regulation?.lastUpdated && (
                    <div>
                      <h3 className="font-medium text-gray-900">Last Updated</h3>
                      <p className="text-gray-700 mt-1">
                        {format(new Date(regulation.lastUpdated), "PP")}
                      </p>
                    </div>
                  )}

                  {regulation?.lastVerified && (
                    <div>
                      <h3 className="font-medium text-gray-900">Last Verified</h3>
                      <p className="text-gray-700 mt-1">
                        {format(new Date(regulation.lastVerified), "PP")}
                      </p>
                    </div>
                  )}

                  {regulation?.nextReviewDate && (
                    <div>
                      <h3 className="font-medium text-gray-900">Next Review</h3>
                      <p className="text-gray-700 mt-1">
                        {format(new Date(regulation.nextReviewDate), "PP")}
                      </p>
                    </div>
                  )}

                  {regulation?.reportingFrequency && (
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Reporting Frequency
                      </h3>
                      <p className="text-gray-700 mt-1">
                        {regulation.reportingFrequency}
                      </p>
                    </div>
                  )}

                  {regulation?.agency_url && (
                    <div>
                      <h3 className="font-medium text-gray-900">Agency URL</h3>
                      <p className="text-gray-700 mt-1">
                        <a
                          href={regulation.agency_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center"
                        >
                          {regulation.agency_url}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </p>
                    </div>
                  )}

                  {regulation?.agency_contact && (
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Agency Contact
                      </h3>
                      <p className="text-gray-700 mt-1">
                        {regulation.agency_contact}
                      </p>
                    </div>
                  )}

                  {regulation?.agency_department && (
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Agency Department
                      </h3>
                      <p className="text-gray-700 mt-1">
                        {regulation.agency_department}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4">
                  {regulation?.submissionGuidelines && (
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Submission Guidelines
                      </h3>
                      <p className="text-gray-700 mt-1 whitespace-pre-line">
                        {regulation.submissionGuidelines}
                      </p>
                    </div>
                  )}

                  {regulation?.complianceNotes && (
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Compliance Notes
                      </h3>
                      <p className="text-gray-700 mt-1 whitespace-pre-line">
                        {regulation.complianceNotes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <h3 className="font-medium text-gray-900 mb-4">Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {regulation?.requirementsUrl && (
                      <a
                        href={regulation.requirementsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 border border-gray-300 rounded-md text-blue-600 hover:bg-gray-50"
                      >
                        <File className="h-5 w-5 mr-3 text-gray-400" />
                        <span className="flex-1">Requirements Document</span>
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </a>
                    )}
                    {regulation?.submissionGuideUrl && (
                      <a
                        href={regulation.submissionGuideUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 border border-gray-300 rounded-md text-blue-600 hover:bg-gray-50"
                      >
                        <FileText className="h-5 w-5 mr-3 text-gray-400" />
                        <span className="flex-1">Submission Guide</span>
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </a>
                    )}
                    {regulation?.formsUrl && (
                      <a
                        href={regulation.formsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 border border-gray-300 rounded-md text-blue-600 hover:bg-gray-50"
                      >
                        <Clipboard className="h-5 w-5 mr-3 text-gray-400" />
                        <span className="flex-1">Required Forms</span>
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </a>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="deadlines" className="p-4 sm:p-6">
                <div className="space-y-6">
                  {regulation.filingDeadlines &&
                  regulation.filingDeadlines.length > 0 ? (
                    <>
                      <h3 className="text-lg font-medium text-gray-900">
                        Filing Deadlines
                      </h3>
                      <div className="divide-y divide-gray-200">
                        {regulation.filingDeadlines.map((deadline, index) => (
                          <div key={index} className="py-4">
                            <div className="flex items-start">
                              <Calendar className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {deadline.type}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {deadline.date} ({deadline.frequency})
                                </p>
                                <p className="mt-1 text-gray-700">
                                  {deadline.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 italic">No deadlines specified.</p>
                  )}

                  {regulation.applicableforms &&
                  regulation.applicableforms.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Applicable Forms
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-gray-700 pl-4">
                        {regulation.applicableforms.map((form, index) => (
                          <li key={index}>{form}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {regulation.relatedRegulations &&
                  regulation.relatedRegulations.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Related Regulations
                      </h3>
                      <ul className="space-y-3">
                        {regulation.relatedRegulations.map((rel, index) => (
                          <li
                            key={index}
                            className="flex items-center text-blue-600"
                          >
                            <Link2 className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{rel}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {regulation.verificationMethod && (
                    <div className="mt-8">
                      <h3 className="text-lg font-medium text-gray-900">
                        Verification Method
                      </h3>
                      <div className="mt-2 flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                        <p className="text-gray-700">{regulation.verificationMethod}</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="p-4 sm:p-6">
                <NoteSection regulationId={regulation.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
