import { FC } from 'react';

interface VersionEntry {
  version: string;
  date: string;
  changes: string[];
}

interface VersionHistoryProps {
  versions: VersionEntry[];
}

export const VersionHistory: FC<VersionHistoryProps> = ({ versions }) => {
  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold mb-4">Version History</h2>
      {versions.map((version, index) => (
        <div key={index} className="border-l-2 border-blue-500 pl-4 pb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>{version.version}</span>
            <span className="text-sm text-gray-500">- {version.date}</span>
          </h3>
          <ul className="mt-2 space-y-1">
            {version.changes.map((change, changeIndex) => (
              <li key={changeIndex} className="text-gray-700">
                • {change}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// Usage example:
export const ExampleUsage = () => {
  const versionHistory = [
    {
      version: 'v0.3.2 (Alpha)',
      date: 'March 21, 2025',
      changes: [
        'Added regulation timeline visualization for tracking regulation history',
        'Implemented evidence file preview functionality',
        'Enhanced regulation detail page with historical version tracking',
        'Improved user interface for compliance status indicators',
        'Fixed various display issues in timeline components'
      ]
    },
    {
      version: 'v0.3.1 (Alpha)',
      date: 'March 15, 2025',
      changes: [
        'Fixed regulation detail page cards missing due to component version mismatch',
        'Consolidated regulation detail components into single source',
        'Restored complete set of information cards including Agency Information',
        'Enhanced card layout and organization for better readability'
      ]
    },
    {
      version: 'v0.3.0 (Alpha)',
      date: 'March 15, 2025',
      changes: [
        'Redesigned regulations list for improved readability',
        'Added Directly Responsible Office (DRO) column',
        'Enhanced ID number search functionality',
        'Improved status visualization with streamlined layout'
      ]
    }
  ];

  return <VersionHistory versions={versionHistory} />;
};