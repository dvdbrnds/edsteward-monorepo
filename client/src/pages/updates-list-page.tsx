import { PageHeader } from '../components/ui/page-header';
import { UpdatesList } from '../components/UpdatesList';
import { Shell } from '../components/ui/shell';

export default function RegulationUpdatesListPage() {
  return (
    <Shell>
      <PageHeader
        heading="Regulation Updates"
        subheading="Review and manage pending updates to regulations"
      />
      <div className="container py-4">
        <UpdatesList />
      </div>
    </Shell>
  );
}