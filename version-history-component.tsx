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
      version: 'v0.1.1 (Alpha)',
      date: 'February 2025',
      changes: [
        'Fixed OAuth2 configuration for Google Sheets integration',
        'Improved setup wizard with optional OAuth2 configuration',
        'Enhanced error handling for authentication flows'
      ]
    },
    {
      version: 'v0.1.0 (Alpha)',
      date: 'February 2025',
      changes: [
        'Initial alpha release',
        'Core functionality implementation',
        'Basic user interface and navigation',
        'Fundamental compliance tracking features'
      ]
    }
  ];

  return <VersionHistory versions={versionHistory} />;
};
