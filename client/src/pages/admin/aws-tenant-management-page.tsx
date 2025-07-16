import React from 'react';
import Navigation from "@/components/layout/navigation";
import { PageLayout } from "@/components/layout/page-layout";
import AWSTenantsManagement from "@/components/admin/aws-tenant-management";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function AWSTenantsManagementPage() {
    const { user } = useAuth();

    // Only allow admin access
    if (!user || user.role?.toLowerCase() !== "admin") {
        return <Redirect to="/" />;
    }

    return (
        <PageLayout>
            <Navigation />
            <main className="py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <AWSTenantsManagement />
                </div>
            </main>
        </PageLayout>
    );
} 