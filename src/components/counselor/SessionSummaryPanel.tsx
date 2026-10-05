import React from 'react';
import { FileText, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { SessionMemory } from '../../types/SimulatedPatient';

interface SessionSummaryPanelProps {
  summary: SessionMemory | null;
  isGenerating: boolean;
  patientName?: string;
}

const RAPPORT_STYLES: Record<SessionMemory['rapportLevel'], string> = {
  low: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-green-50 text-green-700 border-green-200'
};

// Shown as soon as a session ends, directly under the transcript it was made
// from. Previously the extracted record was written straight to the patient's
// file and the counsellor never saw it until their next session with that
// patient, which made it look as though nothing had happened at all.
export const SessionSummaryPanel: React.FC<SessionSummaryPanelProps> = ({
  summary,
  isGenerating,
  patientName
}) => {
  if (isGenerating) {
    return (
      <div className="mt-6 border border-blue-200 bg-blue-50 rounded-lg p-5">
        <div className="flex items-center gap-2 text-blue-800">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-medium">Writing the summary for the next session...</span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Reducing the transcript to the facts that should carry forward.
        </p>
      </div>
    );
  }

  if (!summary) return null;

  const fields: Array<{ label: string; items: string[] }> = [
    { label: 'Discussed', items: summary.presentingConcerns },
    { label: 'New disclosures', items: summary.keyDisclosures },
    { label: 'Agreed next steps', items: summary.counselorCommitments },
    { label: 'Left unresolved', items: summary.unresolvedThreads },
    { label: 'Cultural factors', items: summary.culturalNotes }
  ].filter(f => f.items && f.items.length > 0);

  return (
    <div className="mt-6 border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-600" />
          <h4 className="font-semibold text-gray-900">Session Summary</h4>
          <span className="text-xs text-gray-500">generated from this transcript</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${RAPPORT_STYLES[summary.rapportLevel]}`}>
          {summary.rapportLevel.charAt(0).toUpperCase() + summary.rapportLevel.slice(1)} rapport
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-gray-900 font-medium">{summary.headline}</p>

        {/* Risk is stated either way. An empty risk list is information too -- it
            tells the counsellor the check was made, not skipped. */}
        {summary.riskFlags.length > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" />
              Risk indicators — carried into the next session
            </p>
            <ul className="text-sm text-red-700 space-y-0.5">
              {summary.riskFlags.map((flag, i) => (
                <li key={i}>&#8226; {flag}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            No risk indicators recorded in this session.
          </p>
        )}

        {summary.emotionalState && (
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Ended feeling
            </p>
            <p className="text-sm text-gray-700 mt-0.5">{summary.emotionalState}</p>
          </div>
        )}

        {fields.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(field => (
              <div key={field.label}>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {field.label}
                </p>
                <ul className="text-sm text-gray-700 mt-1 space-y-0.5">
                  {field.items.map((item, i) => (
                    <li key={i}>&#8226; {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          Saved to {patientName ? <strong>{patientName}</strong> : 'this patient'}&apos;s file. It is
          shown to you before your next session with them, and is included in their prompt during it,
          so the session resumes rather than restarting.
        </p>
      </div>
    </div>
  );
};
