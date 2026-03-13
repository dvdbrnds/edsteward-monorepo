import React, { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface InstitutionResult {
  id: number;
  name: string;
  city: string;
  state: string;
  website: string;
  ownership: string;
  carnegieClassification: string;
  religiousAffiliation: string | null;
  accreditor: string;
  studentSize: number;
  admissionRate: number | null;
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  pellGrantRate: number | null;
  onlineOnly: boolean;
  classification: {
    primaryType: string;
    characteristics: string[];
  };
  allTypes: string[];
}

interface AssessmentData {
  institution: InstitutionResult;
  regulations: { total: number; applicable: number };
}

const TYPE_LABELS: Record<string, string> = {
  'public-4year': 'Public University (4-year)',
  'private-nonprofit-4year': 'Private Nonprofit University (4-year)',
  'public-2year': 'Public Community College (2-year)',
  'private-nonprofit-2year': 'Private Nonprofit College (2-year)',
  'private-for-profit': 'For-Profit Institution',
  'religious-affiliation': 'Religious Affiliation',
  'research-intensive': 'Research Intensive (R1/R2)',
  'graduate-professional': 'Graduate / Professional Programs',
  'intercollegiate-athletics': 'Intercollegiate Athletics',
  'online-distance-ed': 'Online / Distance Education',
  'medical-health-programs': 'Medical / Health Programs',
  'residential-campus': 'Residential Campus',
  'title-iv-participant': 'Title IV Participant',
};

const TYPE_COLORS: Record<string, string> = {
  'public-4year': 'bg-blue-100 text-blue-800 border-blue-200',
  'private-nonprofit-4year': 'bg-purple-100 text-purple-800 border-purple-200',
  'public-2year': 'bg-green-100 text-green-800 border-green-200',
  'private-nonprofit-2year': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'private-for-profit': 'bg-red-100 text-red-800 border-red-200',
  'religious-affiliation': 'bg-amber-100 text-amber-800 border-amber-200',
  'research-intensive': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'graduate-professional': 'bg-teal-100 text-teal-800 border-teal-200',
  'intercollegiate-athletics': 'bg-orange-100 text-orange-800 border-orange-200',
  'online-distance-ed': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'medical-health-programs': 'bg-pink-100 text-pink-800 border-pink-200',
  'residential-campus': 'bg-lime-100 text-lime-800 border-lime-200',
  'title-iv-participant': 'bg-violet-100 text-violet-800 border-violet-200',
};

export function InstitutionAssessmentPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InstitutionResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<AssessmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setSelectedInstitution(null);
    try {
      const data = await apiGet<{ success: boolean; total: number; results: InstitutionResult[] }>(
        `/api/assessment/search?q=${encodeURIComponent(query)}&limit=10`
      );
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        setError('No institutions found. Try a different search term.');
      }
    } catch (err) {
      setError('Search failed. Make sure the engine Customer API is running on port 3060.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectInstitution = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<AssessmentData>(`/api/assessment/institution/${id}`);
      setSelectedInstitution(data);
    } catch (err) {
      setError('Failed to load institution details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Institution Assessment</h1>
        <p className="text-gray-600 mt-1">
          Search any US higher education institution to automatically determine its regulatory profile
          and applicable compliance requirements.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by institution name (e.g., Moravian University, Penn State, MIT)..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Data sourced from the College Scorecard (U.S. Department of Education) — covers all Title IV institutions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && !selectedInstitution && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {searchResults.map(inst => (
              <button
                key={inst.id}
                onClick={() => handleSelectInstitution(inst.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{inst.name}</div>
                    <div className="text-sm text-gray-500">
                      {inst.city}, {inst.state} &middot; {inst.ownership} &middot;{' '}
                      {inst.studentSize?.toLocaleString() || '?'} students
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${TYPE_COLORS[inst.classification?.primaryType] || 'bg-gray-100 text-gray-800'}`}>
                    {TYPE_LABELS[inst.classification?.primaryType] || inst.classification?.primaryType}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-3">Analyzing institution...</p>
        </div>
      )}

      {/* Assessment Result */}
      {selectedInstitution && (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => setSelectedInstitution(null)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            ← Back to search results
          </button>

          {/* Institution Profile Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <h2 className="text-xl font-bold text-white">
                {selectedInstitution.institution.name}
              </h2>
              <p className="text-blue-100 mt-1">
                {selectedInstitution.institution.city}, {selectedInstitution.institution.state}
                {selectedInstitution.institution.website && (
                  <> &middot; <a href={`https://${selectedInstitution.institution.website}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">{selectedInstitution.institution.website}</a></>
                )}
              </p>
            </div>

            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Ownership</div>
                <div className="font-medium text-gray-900 mt-1">{selectedInstitution.institution.ownership}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Students</div>
                <div className="font-medium text-gray-900 mt-1">
                  {selectedInstitution.institution.studentSize?.toLocaleString() || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Carnegie</div>
                <div className="font-medium text-gray-900 mt-1 text-sm">
                  {selectedInstitution.institution.carnegieClassification}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Accreditor</div>
                <div className="font-medium text-gray-900 mt-1 text-sm">
                  {selectedInstitution.institution.accreditor || 'N/A'}
                </div>
              </div>
              {selectedInstitution.institution.religiousAffiliation && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Religious Affiliation</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {selectedInstitution.institution.religiousAffiliation}
                  </div>
                </div>
              )}
              {selectedInstitution.institution.admissionRate != null && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Admission Rate</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {(selectedInstitution.institution.admissionRate * 100).toFixed(1)}%
                  </div>
                </div>
              )}
              {selectedInstitution.institution.tuitionInState != null && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Tuition (In-State)</div>
                  <div className="font-medium text-gray-900 mt-1">
                    ${selectedInstitution.institution.tuitionInState?.toLocaleString()}
                  </div>
                </div>
              )}
              {selectedInstitution.institution.pellGrantRate != null && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Pell Grant Rate</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {(selectedInstitution.institution.pellGrantRate * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EdSteward Classification */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">EdSteward Classification</h3>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Primary Classification</div>
                <span className={`inline-flex px-3 py-1.5 rounded-lg border text-sm font-medium ${TYPE_COLORS[selectedInstitution.institution.classification.primaryType] || 'bg-gray-100 text-gray-800'}`}>
                  {TYPE_LABELS[selectedInstitution.institution.classification.primaryType] || selectedInstitution.institution.classification.primaryType}
                </span>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Institutional Characteristics</div>
                {selectedInstitution.institution.classification.characteristics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedInstitution.institution.classification.characteristics.map(char => (
                      <span
                        key={char}
                        className={`inline-flex px-3 py-1.5 rounded-lg border text-sm font-medium ${TYPE_COLORS[char] || 'bg-gray-100 text-gray-800'}`}
                      >
                        {TYPE_LABELS[char] || char}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No additional characteristics detected from available data.</p>
                )}
              </div>
            </div>
          </div>

          {/* Regulation Impact */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regulatory Impact</h3>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {selectedInstitution.regulations.applicable}
                </div>
                <div className="text-sm text-gray-500 mt-1">Applicable Regulations</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-400">
                  {selectedInstitution.regulations.total}
                </div>
                <div className="text-sm text-gray-500 mt-1">Total in Database</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">
                  {selectedInstitution.regulations.total - selectedInstitution.regulations.applicable}
                </div>
                <div className="text-sm text-gray-500 mt-1">Filtered Out</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Sales Insight:</strong> Based on publicly available data, {selectedInstitution.institution.name} is
                subject to at least <strong>{selectedInstitution.regulations.applicable} federal and state regulations</strong>.
                EdSteward can help them manage compliance across all of these requirements with automated tracking,
                attestation workflows, and deadline management.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
