import {
  SessionMemory,
  SimulatedPatient,
  SimulationMessage
} from '../types/SimulatedPatient';

// Turns a finished session into a carry-forward record, and turns those records
// back into the context block that is prepended to the patient's system prompt
// the next time the counsellor sits down with them.
export class SessionMemoryService {
  /**
   * Render a transcript the way the extraction prompt expects to read it.
   */
  static buildTranscript(messages: SimulationMessage[]): string {
    return messages
      .map(m => `${m.senderType === 'patient' ? 'PATIENT' : 'COUNSELOR'}: ${m.content}`)
      .join('\n');
  }

  /**
   * Ask the model for the structured record. Falls back to a minimal, locally
   * derived memory if the call fails -- losing the session entirely would be a
   * worse outcome than storing a thin record, since the patient roster keys its
   * continuity off these entries.
   */
  static async extractSessionMemory(
    patient: SimulatedPatient,
    messages: SimulationMessage[],
    sessionId: string,
    previousMemories: SessionMemory[] = []
  ): Promise<SessionMemory> {
    const transcript = this.buildTranscript(messages);

    try {
      const response = await fetch('/api/session-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patient.name,
          culturalBackground: patient.culturalBackground,
          concern: patient.mentalHealthConcern,
          transcript,
          previousHeadlines: previousMemories.map(m => m.headline)
        })
      });

      if (!response.ok) {
        throw new Error(`Session memory request failed with ${response.status}`);
      }

      const data = await response.json();
      return this.normalise(data.memory, sessionId);
    } catch (error) {
      console.error('Falling back to a local session memory:', error);
      return this.fallbackMemory(patient, messages, sessionId);
    }
  }

  /**
   * Coerce whatever the model returned into the shape the rest of the app relies
   * on. A missing array here would blow up the roster UI three screens later.
   */
  private static normalise(raw: unknown, sessionId: string): SessionMemory {
    const source = (raw ?? {}) as Record<string, unknown>;
    const strings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

    const rapport = source.rapportLevel;
    const rapportLevel: SessionMemory['rapportLevel'] =
      rapport === 'high' || rapport === 'medium' || rapport === 'low' ? rapport : 'low';

    return {
      headline: typeof source.headline === 'string' && source.headline.trim()
        ? source.headline.trim()
        : 'Session recorded.',
      presentingConcerns: strings(source.presentingConcerns),
      keyDisclosures: strings(source.keyDisclosures),
      emotionalState: typeof source.emotionalState === 'string' ? source.emotionalState : '',
      riskFlags: strings(source.riskFlags),
      counselorCommitments: strings(source.counselorCommitments),
      unresolvedThreads: strings(source.unresolvedThreads),
      culturalNotes: strings(source.culturalNotes),
      rapportLevel,
      generatedAt: new Date(),
      sessionId
    };
  }

  private static fallbackMemory(
    patient: SimulatedPatient,
    messages: SimulationMessage[],
    sessionId: string
  ): SessionMemory {
    const counselorTurns = messages.filter(m => m.senderType === 'counselor').length;
    return {
      headline:
        `Session with ${patient.name} (${counselorTurns} counselor turns). ` +
        'Automatic summary unavailable.',
      presentingConcerns: [patient.mentalHealthConcern.replace(/-/g, ' ')],
      keyDisclosures: [],
      emotionalState: '',
      riskFlags: [],
      counselorCommitments: [],
      unresolvedThreads: [],
      culturalNotes: [],
      // Without a real read of the session, assume the patient is still guarded
      // rather than handing the next session an unearned warm opening.
      rapportLevel: 'low',
      generatedAt: new Date(),
      sessionId
    };
  }

  /**
   * The block that gets appended to the patient's system prompt on a return
   * visit. Phrased as the patient's own memory, not as case notes, so the model
   * does not start reading its file aloud.
   */
  static buildContinuityContext(memories: SessionMemory[]): string {
    if (!memories.length) return '';

    const sessions = memories
      .map((memory, index) => {
        const lines: string[] = [`Session ${index + 1}:`];
        const push = (label: string, items: string[]) => {
          if (items.length) lines.push(`  - ${label}: ${items.join('; ')}`);
        };

        push('what you talked about', memory.presentingConcerns);
        push('what you admitted to them', memory.keyDisclosures);
        if (memory.emotionalState) {
          lines.push(`  - how you felt by the end: ${memory.emotionalState}`);
        }
        push('what you agreed to try', memory.counselorCommitments);
        push('what was left hanging', memory.unresolvedThreads);
        push('what they understood about your background', memory.culturalNotes);
        lines.push(`  - how much you trusted them: ${memory.rapportLevel}`);
        return lines.join('\n');
      })
      .join('\n');

    const latest = memories[memories.length - 1];
    const openingTone =
      latest.rapportLevel === 'high'
        ? 'You trust this counselor. Open warmer and more directly than you did the first time.'
        : latest.rapportLevel === 'medium'
        ? 'You are warming to this counselor but still testing them. Open politely, not openly.'
        : 'You did not feel understood last time. Open guarded, and make them earn it again.';

    return `CONTINUITY -- YOU HAVE MET THIS COUNSELOR BEFORE
These are ${memories.length === 1 ? 'things that happened in your last session' : 'things that happened in your previous sessions'} with this same counselor. They really happened to you.

${sessions}

How to use this:
- Refer to these things the way a person does -- in passing, half-remembered -- never as a list or a recap.
- Do NOT summarise previous sessions. Do not say "last time we discussed...".
- You expect the counselor to remember what you told them. If they ask something you
  already answered, react the way a real person would: mildly deflated, or point it out.
- ${openingTone}`;
  }

  /**
   * Short label for the roster card, e.g. "3 sessions · last seen 4 days ago".
   */
  static describeRecency(date?: Date): string {
    if (!date) return 'not seen yet';
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'seen today';
    if (days === 1) return 'seen yesterday';
    if (days < 30) return `seen ${days} days ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? 'seen a month ago' : `seen ${months} months ago`;
  }
}
