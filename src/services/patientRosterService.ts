import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import {
  SessionMemory,
  SimulatedPatient,
  StoredSimulatedPatient
} from '../types/SimulatedPatient';

// The roster of simulated patients a counselor has already met. Without this,
// every session generated a brand-new persona and "existing patients" could not
// exist: continuity needs something stable to be continuous about.
export class PatientRosterService {
  private static readonly COLLECTION = 'simulatedPatients';

  /**
   * Add a freshly generated persona to the counselor's roster. Called once, when
   * a new patient's first session starts -- the persona is then frozen, because
   * regenerating it would give the patient a different backstory on every visit.
   */
  static async savePatient(counselorId: string, patient: SimulatedPatient): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION), {
        counselorId,
        patient,
        createdAt: Timestamp.now(),
        lastSessionAt: Timestamp.now(),
        sessionCount: 0,
        memories: []
      });
      return docRef.id;
    } catch (error) {
      console.error('Failed to save simulated patient:', error);
      throw new Error('Failed to save simulated patient');
    }
  }

  /**
   * Everyone this counselor has spoken to, most recently seen first.
   */
  static async getRoster(
    counselorId: string,
    limitCount: number = 50
  ): Promise<StoredSimulatedPatient[]> {
    try {
      // No orderBy, to match the rest of the app's queries and avoid requiring a
      // composite Firestore index; sorting happens client-side below.
      const snapshot = await getDocs(
        query(
          collection(db, this.COLLECTION),
          where('counselorId', '==', counselorId),
          limit(limitCount)
        )
      );

      return snapshot.docs
        .map(d => this.fromFirestore(d.id, d.data()))
        .sort((a, b) => {
          const aTime = (a.lastSessionAt ?? a.createdAt).getTime();
          const bTime = (b.lastSessionAt ?? b.createdAt).getTime();
          return bTime - aTime;
        });
    } catch (error) {
      console.error('Failed to load patient roster:', error);
      return [];
    }
  }

  static async getPatient(storedPatientId: string): Promise<StoredSimulatedPatient | null> {
    try {
      const snapshot = await getDoc(doc(db, this.COLLECTION, storedPatientId));
      if (!snapshot.exists()) return null;
      return this.fromFirestore(snapshot.id, snapshot.data());
    } catch (error) {
      console.error('Failed to load simulated patient:', error);
      return null;
    }
  }

  /**
   * Record the end of a session against the patient: bump the counter, stamp the
   * date, append the carry-forward record.
   */
  static async appendSessionMemory(
    storedPatientId: string,
    memory: SessionMemory
  ): Promise<void> {
    try {
      const existing = await this.getPatient(storedPatientId);
      if (!existing) {
        throw new Error(`No stored patient with id ${storedPatientId}`);
      }

      await updateDoc(doc(db, this.COLLECTION, storedPatientId), {
        sessionCount: existing.sessionCount + 1,
        lastSessionAt: Timestamp.fromDate(memory.generatedAt),
        memories: [...existing.memories, memory].map(m => ({
          ...m,
          generatedAt: Timestamp.fromDate(m.generatedAt)
        }))
      });
    } catch (error) {
      console.error('Failed to append session memory:', error);
      throw new Error('Failed to append session memory');
    }
  }

  static async deletePatient(storedPatientId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION, storedPatientId));
    } catch (error) {
      console.error('Failed to delete simulated patient:', error);
      throw new Error('Failed to delete simulated patient');
    }
  }

  // Firestore hands back Timestamps where the app wants Dates. Documents written
  // before a field existed come back undefined, so every read is defensive.
  private static fromFirestore(id: string, data: Record<string, unknown>): StoredSimulatedPatient {
    const toDate = (value: unknown): Date | undefined => {
      if (value instanceof Timestamp) return value.toDate();
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
      }
      return undefined;
    };

    const rawMemories = Array.isArray(data.memories) ? data.memories : [];

    return {
      id,
      counselorId: String(data.counselorId ?? ''),
      patient: data.patient as SimulatedPatient,
      createdAt: toDate(data.createdAt) ?? new Date(),
      lastSessionAt: toDate(data.lastSessionAt),
      sessionCount: typeof data.sessionCount === 'number' ? data.sessionCount : 0,
      memories: rawMemories.map((m: Record<string, unknown>) => ({
        ...(m as unknown as SessionMemory),
        generatedAt: toDate(m.generatedAt) ?? new Date()
      }))
    };
  }
}
