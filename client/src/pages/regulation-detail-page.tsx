import { Regulation } from '@/types/regulation';

export default function RegulationDetailPage({
  regulation,
}: {
  regulation: Regulation;
}) {
  return (
    <div>
      <h1>{regulation.title}</h1>
      <p>{regulation.description}</p>
    </div>
  );
}