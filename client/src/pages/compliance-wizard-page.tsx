import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Regulation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/layout/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

export default function ComplianceWizardPage() {
  const [location, navigate] = useLocation();
  const regulationId = location.split("/")[2]; // Extract from /compliance-wizard/:id
  const [step, setStep] = useState(0);

  const { data: regulation, isLoading } = useQuery<Regulation>({
    queryKey: ["/api/regulations", regulationId],
  });

  if (isLoading || !regulation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-4">
              <Loader2 className="h-6 w-6 animate-spin text-[#00267A]" />
              <span>Loading regulation details...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Generate steps based on regulation requirements and agency guidelines
  const steps = [
    {
      title: "Overview",
      description: "Review regulation requirements",
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Regulation Overview</h3>
          <p className="text-gray-600">{regulation.requirements}</p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800">Before you begin:</h4>
            <ul className="list-disc list-inside text-sm text-blue-700 mt-2">
              <li>Review the complete regulation text</li>
              <li>Gather all necessary documentation</li>
              <li>Consult with relevant department heads</li>
            </ul>
          </div>
          {regulation.regulationUrl && (
            <div className="mt-4">
              <a
                href={regulation.regulationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00267A] hover:underline inline-flex items-center gap-2"
              >
                View Complete Regulation Guidelines
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Required Documentation",
      description: "Gather necessary documents and evidence",
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Required Documentation</h3>
          <div className="grid gap-4">
            {/* Generate checkboxes based on regulation requirements */}
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <input type="checkbox" className="mt-1" />
              <div>
                <p className="font-medium">Course Materials</p>
                <p className="text-sm text-gray-600">
                  Syllabi, course descriptions, and learning objectives
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <input type="checkbox" className="mt-1" />
              <div>
                <p className="font-medium">Faculty Credentials</p>
                <p className="text-sm text-gray-600">
                  Current CVs and teaching certifications
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <input type="checkbox" className="mt-1" />
              <div>
                <p className="font-medium">Assessment Data</p>
                <p className="text-sm text-gray-600">
                  Student learning outcomes and program evaluation metrics
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Submission Process",
      description: "Step-by-step submission guidelines",
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Submission Guidelines</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-medium">Step 1: Document Preparation</h4>
              <p className="text-gray-600">
                Ensure all documents are in the required format (PDF preferred)
                and follow the naming convention specified by the agency.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Step 2: Data Verification</h4>
              <p className="text-gray-600">
                Review all data points for accuracy and completeness. Cross-reference
                with source documentation.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Step 3: Submit Report</h4>
              <p className="text-gray-600">
                Upload your completed compliance report through the agency's
                designated portal or submission system.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Review & Submit",
      description: "Final review and submission",
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Final Review</h3>
          <div className="space-y-4">
            <p className="text-gray-600">
              Please review all information before final submission. Ensure:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>All required documentation is attached</li>
              <li>Data accuracy has been verified</li>
              <li>Supporting evidence is properly referenced</li>
              <li>Submission deadlines are met</li>
            </ul>
            <div className="mt-6">
              <Button className="w-full">
                Generate Final Report
              </Button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate(`/regulations/${regulationId}`)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Regulation
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">
              Compliance Report Generator
            </h1>
            <p className="mt-2 text-gray-600">
              Follow the steps below to generate a compliance report for{" "}
              {regulation.topic}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-2 ${
                    index < step
                      ? "bg-[#00267A]"
                      : index === step
                      ? "bg-blue-300"
                      : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {steps.map((s, index) => (
                <span
                  key={index}
                  className={`text-sm ${
                    index <= step ? "text-[#00267A]" : "text-gray-400"
                  }`}
                >
                  Step {index + 1}
                </span>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <Card>
            <CardHeader>
              <CardTitle>{steps[step].title}</CardTitle>
              <CardDescription>{steps[step].description}</CardDescription>
            </CardHeader>
            <CardContent>{steps[step].content}</CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={step === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === steps.length - 1}
              >
                {step === steps.length - 1 ? "Submit" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}