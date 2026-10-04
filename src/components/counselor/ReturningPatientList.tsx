import React, { useState } from 'react';
import { User, Clock, AlertTriangle, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';
import { StoredSimulatedPatient, concernsOf } from '../../types/SimulatedPatient';
import { SessionMemoryService } from '../../services/sessionMemoryService';

interface ReturningPatientListProps {
  patients: StoredSimulatedPatient[];
  loading: boolean;
  onStartSession: (stored: StoredSimulatedPatient) => void;
  onDeletePatient?: (stored: StoredSimulatedPatient) => void;
  onRefresh?: () => void;
}

const RAPPORT_STYLES: Record<string, string> = {
  low: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-green-50 text-green-700 border-green-200'
};

const titleCase = (value: string) =>
  value.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

// The "existing patients" screen: who this counselor has already spoken to, and
// what came out of those sessions. The summary is shown BEFORE the session
// starts, so the counselor can prepare the way they would for a real returning
// client rather than rediscovering everything mid-conversation.
export const ReturningPatientList: React.FC<ReturningPatientListProps> = ({
  patients,
  loading,
  onStartSession,
  onDeletePatient,
  onRefresh
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-gray-600">Loading your patients...</p>
      </div>
    );
  }

  if (!patients.length) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
        <User className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h4 className="text-lg font-medium text-gray-900 mb-1">No previous patients yet</h4>
        <p className="text-gray-600 max-w-md mx-auto">
          Finish a session with a new patient and they will appear here, along with a
          summary of what you discussed, so you can pick up where you left off.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onRefresh && (
        <div className="flex justify-end">
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      )}

      {patients.map(stored => {
        const { patient } = stored;
        const latest = stored.memories[stored.memories.length - 1];
        const isExpanded = expandedId === stored.id;
        const hasRisk = stored.memories.some(memory => memory.riskFlags.length > 0);

        return (
          <div
            key={stored.id}
            className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-lg font-semibold text-gray-900">{patient.name}</h4>
                  {latest && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        RAPPORT_STYLES[latest.rapportLevel] ?? RAPPORT_STYLES.low
                      }`}
                    >
                      {titleCase(latest.rapportLevel)} rapport
                    </span>
                  )}
                  {hasRisk && (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Risk noted
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  {patient.age} &middot; {titleCase(patient.gender)} &middot;{' '}
                  {titleCase(patient.culturalBackground)} &middot;{' '}
                  {concernsOf(patient).map(titleCase).join(', ')}
                </p>

                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {stored.sessionCount} {stored.sessionCount === 1 ? 'session' : 'sessions'}
                  {' '}&middot;{' '}
                  {SessionMemoryService.describeRecency(stored.lastSessionAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onStartSession(stored)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Start session
                </button>
                {onDeletePatient && (
                  <button
                    onClick={() => onDeletePatient(stored)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title={`Remove ${patient.name} from your patient list`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {latest ? (
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">{latest.headline}</p>

                {latest.riskFlags.length > 0 && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-xs font-semibold text-red-800 mb-1">
                      Carried forward &mdash; check on this
                    </p>
                    <ul className="text-xs text-red-700 space-y-0.5">
                      {latest.riskFlags.map((flag, i) => (
                        <li key={i}>&#8226; {flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {latest.unresolvedThreads.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Left unresolved</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {latest.unresolvedThreads.map((thread, i) => (
                        <li key={i}>&#8226; {thread}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(isExpanded ? null : stored.id)}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" /> Hide session history
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" /> Show all{' '}
                      {stored.memories.length}{' '}
                      {stored.memories.length === 1 ? 'session' : 'sessions'}
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                    {stored.memories.map((memory, index) => (
                      <div key={memory.sessionId || index} className="text-xs text-gray-700">
                        <p className="font-semibold text-gray-900">
                          Session {index + 1}
                          <span className="font-normal text-gray-500">
                            {' '}&middot; {memory.generatedAt.toLocaleDateString()}
                          </span>
                        </p>
                        <p className="mt-0.5">{memory.headline}</p>

                        <MemoryFieldList label="Discussed" items={memory.presentingConcerns} />
                        <MemoryFieldList label="New disclosures" items={memory.keyDisclosures} />
                        <MemoryFieldList label="Agreed next steps" items={memory.counselorCommitments} />
                        <MemoryFieldList label="Cultural factors" items={memory.culturalNotes} />

                        {memory.emotionalState && (
                          <p className="mt-1 text-gray-600">
                            <span className="font-medium text-gray-700">Ended feeling:</span>{' '}
                            {memory.emotionalState}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No session summary stored yet &mdash; this patient was created but the first
                session has not been completed.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

const MemoryFieldList: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (!items.length) return null;
  return (
    <p className="mt-1 text-gray-600">
      <span className="font-medium text-gray-700">{label}:</span> {items.join('; ')}
    </p>
  );
};
