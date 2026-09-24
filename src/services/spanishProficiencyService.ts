import { db } from './firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from 'firebase/firestore';

export interface SpanishProficiencyResult {
  score: number;
  feedback: string;
  strengths: string;
  improvement: string;
}

export interface SpanishProficiencyRecord {
  id?: string;
  counselorId: string;
  conversationId: string;
  score: number;
  feedback: string;
  strengths: string;
  improvement: string;
  messageCount: number;
  analyzedAt: Date;
}

export interface CounselorSpanishSummary {
  counselorId: string;
  counselorName?: string;
  averageScore: number;
  sessionCount: number;
  latestScore: number;
  latestFeedback: string;
}

const COLLECTION = 'spanish_proficiency_scores';

// Detect Spanish messages using simple heuristic
const isSpanish = (text: string): boolean => {
  const spanishPattern = /\b(el|la|los|las|un|una|de|que|en|por|para|con|mi|tu|su|soy|eres|está|están|¿|¡|señor|señora|cómo|qué|usted|hola|gracias|por favor|lo siento|entiendo|comprendo|familia|comunidad)\b/i;
  return spanishPattern.test(text);
};

export class SpanishProficiencyService {

  // Analyze a session and store the result
  static async analyzeSession(
    counselorId: string,
    conversationId: string,
    allMessages: Array<{ content: string; senderType: string }>
  ): Promise<SpanishProficiencyResult | null> {

    // Only look at counselor messages that are in Spanish
    const spanishCounselorMessages = allMessages.filter(
      m => m.senderType === 'counselor' && isSpanish(m.content)
    );

    if (spanishCounselorMessages.length === 0) {
      return null; // Counselor didn't write in Spanish — nothing to score
    }

    try {
      const response = await fetch('/api/analyze-spanish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: spanishCounselorMessages })
      });

      const data = await response.json();
      if (!data.success) return null;

      const result: SpanishProficiencyResult = {
        score: data.score,
        feedback: data.feedback,
        strengths: data.strengths,
        improvement: data.improvement
      };

      // Store in Firestore
      await addDoc(collection(db, COLLECTION), {
        counselorId,
        conversationId,
        score: result.score,
        feedback: result.feedback,
        strengths: result.strengths,
        improvement: result.improvement,
        messageCount: spanishCounselorMessages.length,
        analyzedAt: Timestamp.fromDate(new Date())
      });

      return result;

    } catch (error) {
      console.error('Failed to analyze Spanish proficiency:', error);
      return null;
    }
  }

  // Get a counselor's Spanish proficiency summary
  static async getCounselorSummary(counselorId: string): Promise<CounselorSpanishSummary | null> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('counselorId', '==', counselorId),
        orderBy('analyzedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const records = snapshot.docs.map(doc => ({
        ...doc.data(),
        analyzedAt: doc.data().analyzedAt?.toDate()
      })) as SpanishProficiencyRecord[];

      const averageScore = records.reduce((sum, r) => sum + r.score, 0) / records.length;

      return {
        counselorId,
        averageScore: Math.round(averageScore * 10) / 10,
        sessionCount: records.length,
        latestScore: records[0].score,
        latestFeedback: records[0].feedback
      };

    } catch (error) {
      console.error('Failed to get counselor Spanish summary:', error);
      return null;
    }
  }

  // Get all counselors' Spanish scores — for admin dashboard
  static async getAllCounselorScores(): Promise<CounselorSpanishSummary[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      if (snapshot.empty) return [];

      // Group by counselorId
      const grouped: Record<string, SpanishProficiencyRecord[]> = {};
      snapshot.docs.forEach(doc => {
        const data = { ...doc.data(), analyzedAt: doc.data().analyzedAt?.toDate() } as SpanishProficiencyRecord;
        if (!grouped[data.counselorId]) grouped[data.counselorId] = [];
        grouped[data.counselorId].push(data);
      });

      return Object.entries(grouped).map(([counselorId, records]) => {
        records.sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime());
        const averageScore = records.reduce((sum, r) => sum + r.score, 0) / records.length;
        return {
          counselorId,
          averageScore: Math.round(averageScore * 10) / 10,
          sessionCount: records.length,
          latestScore: records[0].score,
          latestFeedback: records[0].feedback
        };
      });

    } catch (error) {
      console.error('Failed to get all Spanish scores:', error);
      return [];
    }
  }
}
