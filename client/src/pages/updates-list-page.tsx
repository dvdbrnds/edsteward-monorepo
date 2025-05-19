import { PageHeader } from "@/components/ui/page-header";
import UpdatesList from "@/components/UpdatesList";

export default function UpdatesListPage() {
  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Regulation Updates"
        description="Review and process pending regulation updates"
      />
      <UpdatesList />
    </div>
  );
}