import { DifferentialView } from '../components/DifferentialView';
import { Shell } from '../components/ui/shell';
import { useParams } from 'wouter';

export default function RegulationUpdateDifferentialViewPage() {
  const params = useParams();
  const updateId = params?.id ? parseInt(params.id, 10) : 0;

  return (
    <Shell>
      <div className="container py-4">
        <DifferentialView updateId={updateId} />
      </div>
    </Shell>
  );
}