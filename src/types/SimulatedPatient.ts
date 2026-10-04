import { CulturalBackground } from './User';

export type MentalHealthConcern = 
  | 'anxiety' 
  | 'depression' 
  | 'family-conflict' 
  | 'academic-stress' 
  | 'identity-issues'
  | 'relationship-issues'
  | 'cultural-adjustment'
  | 'perfectionism';

export type Gender = 'male' | 'female' | 'non-binary';

// The assignment brief asks the counsellor to pick an age GROUP, not a numeric
// range. The previous selector only offered 18-26 in three-year bands, which
// covers college age and nothing else. These spans are the ones a counselling
// service would actually distinguish between, because the presenting issues and
// the appropriate register differ sharply across them.
export const AGE_GROUPS = {
  'adolescent':   { label: 'Adolescent',   detail: '13-17', range: [13, 17] as [number, number] },
  'young-adult':  { label: 'Young adult',  detail: '18-25', range: [18, 25] as [number, number] },
  'adult':        { label: 'Adult',        detail: '26-39', range: [26, 39] as [number, number] },
  'middle-aged':  { label: 'Middle-aged',  detail: '40-59', range: [40, 59] as [number, number] },
  'older-adult':  { label: 'Older adult',  detail: '60+',   range: [60, 78] as [number, number] }
} as const;

export type AgeGroup = keyof typeof AGE_GROUPS;

export type SessionOutcome = 'completed' | 'abandoned' | 'ongoing';

export interface SimulatedPatient {
  id: string;
  name: string;
  culturalBackground: CulturalBackground;
  gender: Gender;
  age: number;
  // Kept as the PRIMARY concern so that every existing helper keyed on a single
  // concern (backstory, session goals, trust level, opening lines) keeps working.
  mentalHealthConcern: MentalHealthConcern;
  // The full set the counsellor selected. Optional because patients saved before
  // multi-concern selection existed do not have it -- read it through
  // `concernsOf(patient)` rather than directly.
  mentalHealthConcerns?: MentalHealthConcern[];
  ageGroup?: AgeGroup;
  personalityTraits: string[];
  backstory: string;
  sessionGoals: string[];
  communicationStyle: 'direct' | 'indirect' | 'mixed';
  emotionalExpression: 'open' | 'reserved' | 'selective';
  trustLevel: 'high' | 'medium' | 'low'; // How quickly they open up
  culturalFactors: string[]; // Specific cultural elements affecting their case
}

// --- Session memory ---------------------------------------------------------
// What a counsellor needs carried from one session to the next. Deliberately not
// a prose recap: these are the facts that change how the NEXT session opens --
// what was actually discussed, what the patient admitted for the first time,
// anything that must not be dropped (risk), what was agreed, and what was left
// hanging. `rapportLevel` sets how warmly the patient greets the counsellor when
// they come back.
export interface SessionMemory {
  headline: string;                 // One line a supervisor can read in 3 seconds
  presentingConcerns: string[];     // What was actually on the table this session
  keyDisclosures: string[];         // Facts revealed for the first time
  emotionalState: string;           // Where the patient ended up emotionally
  riskFlags: string[];              // Self-harm, hopelessness, safeguarding. Never dropped.
  counselorCommitments: string[];   // "We agreed you'd try X before next time"
  unresolvedThreads: string[];      // Opened and not closed
  culturalNotes: string[];          // Culture/faith/family/language factors that mattered
  rapportLevel: 'low' | 'medium' | 'high';
  generatedAt: Date;
  sessionId: string;
}

// A simulated patient that persists between sessions, so the counsellor can come
// back to someone they have already "met". The generated persona is stored
// verbatim -- regenerating it would give the patient a different backstory each
// visit, which is exactly what continuity is meant to prevent.
export interface StoredSimulatedPatient {
  id: string;                       // Firestore document id
  counselorId: string;
  patient: SimulatedPatient;
  createdAt: Date;
  lastSessionAt?: Date;
  sessionCount: number;
  memories: SessionMemory[];        // Oldest first
}

export interface SimulationSession {
  id: string;
  counselorId: string;
  simulatedPatient: SimulatedPatient;
  sessionStarted: Date;
  sessionEnded?: Date;
  messages: SimulationMessage[];
  sessionOutcome: SessionOutcome;
  counselorFeedback?: string;
  sessionDuration?: number; // in minutes
  analysisResults?: SessionAnalysisResults;
  // Set when the session was run against a saved patient from the roster.
  storedPatientId?: string;
  // Index of this session for this patient, 1-based. 1 means a first meeting.
  sessionNumber?: number;
  // Carry-forward record distilled at the end of the session.
  sessionMemory?: SessionMemory;
}

export interface SimulationMessage {
  id: string;
  sessionId: string;
  content: string;
  senderType: 'counselor' | 'patient';
  timestamp: Date;
  messageNumber: number;
  emotionalTone?: string;
  culturalReferences?: string[];
}

export interface SessionAnalysisResults {
  culturalCompetencyScore: number;
  empathyScore: number;
  therapeuticProgressScore: number;
  sessionFlowScore: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  culturalHighlights: string[];
  missedOpportunities: string[];
}

export interface PatientPersonaPrompt {
  basePersona: string;
  culturalNuances: string[];
  commonResponses: string[];
  progressionStages: string[];
  triggerTopics: string[]; // Topics that might cause strong reactions
  culturalStrengths: string[]; // Cultural resources they might reference
}

export interface PatientSimulationPrompts {
  [key: string]: { // Format: "culturalBackground-gender-concern"
    [concern in MentalHealthConcern]?: PatientPersonaPrompt;
  };
}

export interface ValidationFeedback {
  id: string;
  participantId: string;
  culturalBackground: CulturalBackground;
  simulatedSessionId: string;
  authenticity: {
    culturalAccuracy: number;      // 1-10 scale
    languagePatterns: number;      // Realistic speech patterns
    emotionalResponses: number;    // Authentic emotional reactions
    culturalReferences: number;    // Appropriate cultural references
    overallAuthenticity: number;   // Overall believability
  };
  improvements: string[];
  positiveAspects: string[];
  overallRating: number;
  participantComments?: string;
  submittedAt: Date;
}

export interface TrainingEffectiveness {
  id: string;
  counselorId: string;
  preTrainingScores?: SessionAnalysisResults;
  postTrainingScores?: SessionAnalysisResults;
  improvementAreas: string[];
  confidenceRating: number;       // 1-10: How confident they feel
  systemUsability: number;        // 1-10: How easy was the system to use
  feedbackHelpfulness: number;    // 1-10: How helpful was the feedback
  wouldRecommend: boolean;
  additionalComments?: string;
  completedAt: Date;
}

export interface PatientGenerationOptions {
  culturalBackground?: CulturalBackground;
  gender?: Gender;
  /** @deprecated Single-concern selection. Use `concerns`; kept for the CBT entry point. */
  concern?: MentalHealthConcern;
  concerns?: MentalHealthConcern[];
  ageGroup?: AgeGroup;
  ageRange?: [number, number];
  complexityLevel?: 'beginner' | 'intermediate' | 'advanced';
}

// Constants for random generation
export const PERSONALITY_TRAITS = [
  'introverted', 'extroverted', 'analytical', 'emotional', 'practical', 
  'idealistic', 'independent', 'family-oriented', 'ambitious', 'laid-back',
  'perfectionist', 'flexible', 'traditional', 'progressive', 'spiritual',
  'skeptical', 'optimistic', 'pessimistic', 'resilient', 'sensitive'
] as const;

export const COMMUNICATION_STYLES = {
  direct: 'Speaks openly and directly about feelings and problems',
  indirect: 'Uses subtle hints and expects counselor to read between lines',
  mixed: 'Sometimes direct, sometimes indirect depending on topic comfort level'
} as const;

export const EMOTIONAL_EXPRESSION_STYLES = {
  open: 'Easily shares emotions and personal experiences',
  reserved: 'Takes time to open up, may minimize emotional impact',
  selective: 'Open about some topics but guarded about others'
} as const;

export const TRUST_LEVELS = {
  high: 'Trusts counselor quickly, open to feedback',
  medium: 'Cautiously optimistic, needs to feel heard first',
  low: 'Skeptical of counseling, may test counselor initially'
} as const;
/**
 * Every concern on a patient's file, whichever shape they were saved in.
 * Patients created before multi-concern selection only carry the singular field.
 */
export function concernsOf(patient: SimulatedPatient): MentalHealthConcern[] {
  const many = patient.mentalHealthConcerns;
  if (many && many.length) return many;
  return patient.mentalHealthConcern ? [patient.mentalHealthConcern] : [];
}

/**
 * How to refer to someone of this age in the persona prompt. The prompt used to
 * hardcode "college student", which was safe only while the age selector could
 * not leave 18-26.
 */
export function lifeStageOf(patient: SimulatedPatient): string {
  const group = patient.ageGroup;
  if (group === 'adolescent') return 'high-school student';
  if (group === 'young-adult') return 'college student';
  if (group === 'adult') return 'working adult';
  if (group === 'middle-aged') return 'adult';
  if (group === 'older-adult') return 'older adult';
  // No stored group: fall back on the age itself rather than assuming a student.
  if (patient.age < 18) return 'high-school student';
  if (patient.age <= 25) return 'college student';
  if (patient.age <= 39) return 'working adult';
  if (patient.age <= 59) return 'adult';
  return 'older adult';
}
