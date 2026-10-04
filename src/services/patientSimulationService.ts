import OpenAI from 'openai';
import { ENV } from '../config/env';
import { 
  SimulatedPatient, 
  PatientGenerationOptions, 
  MentalHealthConcern, 
  Gender, 
  SimulationMessage,
  PERSONALITY_TRAITS,
  AGE_GROUPS,
  concernsOf,
  lifeStageOf
} from '../types/SimulatedPatient';
import { CulturalBackground } from '../types/User';
import { CULTURAL_BACKGROUNDS_INFO } from '../types/Feedback';

export class PatientSimulationService {
  private static openai = new OpenAI({
    apiKey: ENV.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Note: In production, move this to backend
  });

  // Generate a random simulated patient
  static generateRandomPatient(options: PatientGenerationOptions = {}): SimulatedPatient {
    const culturalBackgrounds: CulturalBackground[] = [
      'african-american', 'african', 'asian-american', 'east-asian', 'south-asian',
      'latino-hispanic', 'white-american', 'middle-eastern', 'native-american', 'multiracial'
    ];

    const genders: Gender[] = ['male', 'female', 'non-binary'];
    
    const concerns: MentalHealthConcern[] = [
      'anxiety', 'depression', 'family-conflict', 'academic-stress', 
      'identity-issues', 'relationship-issues', 'cultural-adjustment', 'perfectionism'
    ];

    const culturalBackground = options.culturalBackground || 
      culturalBackgrounds[Math.floor(Math.random() * culturalBackgrounds.length)];
    
    const gender = options.gender || 
      genders[Math.floor(Math.random() * genders.length)];
    
    // The counsellor may now pick several concerns. The first one stays the
    // "primary" concern, because the backstory, session goals, trust level and
    // opening lines are all keyed on a single concern; the rest are carried
    // alongside it and surfaced in the persona prompt.
    const selectedConcerns: MentalHealthConcern[] =
      options.concerns && options.concerns.length
        ? options.concerns
        : options.concern
        ? [options.concern]
        : [concerns[Math.floor(Math.random() * concerns.length)]];
    const concern = selectedConcerns[0];

    // Age group takes precedence; ageRange remains supported for callers that
    // still pass one.
    const ageRange: [number, number] = options.ageGroup
      ? AGE_GROUPS[options.ageGroup].range
      : options.ageRange || [18, 25];
    const age = Math.floor(Math.random() * (ageRange[1] - ageRange[0] + 1)) + ageRange[0];

    // Generate personality traits
    const numTraits = Math.floor(Math.random() * 3) + 3; // 3-5 traits
    const selectedTraits = this.shuffleArray([...PERSONALITY_TRAITS])
      .slice(0, numTraits);

    const patient: SimulatedPatient = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: this.generateName(culturalBackground, gender),
      culturalBackground,
      gender,
      age,
      mentalHealthConcern: concern,
      mentalHealthConcerns: selectedConcerns,
      ageGroup: options.ageGroup,
      personalityTraits: selectedTraits,
      backstory: this.generateBackstory(culturalBackground, gender, age, concern),
      sessionGoals: Array.from(new Set(
        selectedConcerns.flatMap(c => this.generateSessionGoals(c))
      )).slice(0, 5),
      communicationStyle: this.getCommunicationStyle(culturalBackground),
      emotionalExpression: this.getEmotionalExpression(culturalBackground, selectedTraits),
      trustLevel: this.getTrustLevel(culturalBackground, concern),
      culturalFactors: Array.from(new Set(
        selectedConcerns.flatMap(c => this.getCulturalFactors(culturalBackground, c))
      ))
    };

    return patient;
  }

  // Generate patient response during conversation
  static async generatePatientResponse(
    patient: SimulatedPatient,
    conversationHistory: SimulationMessage[],
    counselorMessage: string,
    additionalSystemContext?: string,
    counselorLanguage: 'en' | 'es' = 'en'
  ): Promise<string> {
    try {
      const prompt = this.buildPatientPrompt(patient, conversationHistory, counselorMessage, counselorLanguage);

      let systemPrompt = this.getPatientSystemPrompt();
      if (additionalSystemContext) {
        systemPrompt += '\n\nADDITIONAL CONTEXT:\n' + additionalSystemContext;
      }
      // Stated last so it is the final word in the system prompt.
      systemPrompt += '\n\n' + this.getLanguageInstruction(counselorLanguage);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8, // Higher temperature for more natural, varied responses
        max_tokens: 200
      });

      const rawResponse = response.choices[0]?.message?.content || '';
      return this.cleanPatientResponse(rawResponse);
    } catch (error: unknown) {
      console.error('Failed to generate patient response:', error);
      return this.getFallbackResponse(patient, counselorMessage, counselorLanguage);
    }
  }

  // Tie the patient's language to the counselor's. Without this the prompt said
  // nothing about language at all, so the model mirrored the counselor only by
  // chance — a session conducted in Spanish would come back in English, or flip
  // between the two mid-conversation.
  private static getLanguageInstruction(counselorLanguage: 'en' | 'es'): string {
    if (counselorLanguage === 'es') {
      return `LANGUAGE:
The counselor is speaking Spanish, so respond in Spanish — every sentence of it.
Do not answer in English, do not translate yourself, and do not remark on which
language is being used. Dropping in an English word the way a bilingual student
naturally would is fine, but the response itself must be Spanish.`;
    }

    return `LANGUAGE:
The counselor is speaking English, so respond in English. A Spanish word or phrase
where it would come naturally is fine, but the response itself must be English.`;
  }

  // Build the patient persona prompt
  private static buildPatientPrompt(
    patient: SimulatedPatient, 
    conversationHistory: SimulationMessage[], 
    counselorMessage: string,
    counselorLanguage: 'en' | 'es' = 'en'
  ): string {
    const culturalInfo = CULTURAL_BACKGROUNDS_INFO[patient.culturalBackground];
    const personaPrompt = this.getPersonaPrompt(patient);

    const historyText = conversationHistory
      .slice(-4) // Last 4 messages for context
      .map(msg => `${msg.senderType.toUpperCase()}: ${msg.content}`)
      .join('\n');

    return `
PATIENT ROLEPLAY CONTEXT:

PATIENT PROFILE:
${personaPrompt}

CONVERSATION HISTORY:
${historyText}

COUNSELOR'S CURRENT MESSAGE:
"${counselorMessage}"

CULTURAL CONTEXT FOR ${patient.culturalBackground.toUpperCase()}:
- Cultural factors: ${culturalInfo?.commonFactors.join(', ') || 'Various cultural considerations'}
- Cultural sensitivities: ${culturalInfo?.sensitivities.join(', ') || 'Various sensitivities'}
- Cultural strengths: ${culturalInfo?.strengths.join(', ') || 'Various strengths'}

RESPONSE GUIDELINES:
1. Stay completely in character as ${patient.name}
2. Respond authentically based on their cultural background and personality
3. Show realistic emotional progression based on counselor's cultural competency
4. Reference cultural elements naturally when relevant
5. React to how well the counselor understands your cultural context
6. Keep response conversational and realistic (2-4 sentences typically)
7. Write the response in ${counselorLanguage === 'es' ? 'Spanish' : 'English'}, matching the language the counselor used

Generate ${patient.name}'s response to the counselor's message:
    `.trim();
  }

  // Several concerns rarely arrive with equal weight in a real session: one is
  // what the client came in for, the others surface when the counsellor makes
  // room for them. The prompt says so explicitly rather than listing them flat.
  private static describeConcerns(patient: SimulatedPatient): string {
    const all = concernsOf(patient);
    const primary = all[0] ?? patient.mentalHealthConcern;
    const rest = all.slice(1);

    if (!rest.length) {
      return `You are primarily struggling with ${primary}.`;
    }
    return (
      `You are primarily struggling with ${primary}. ` +
      `You are also dealing with ${rest.join(', ')}, but you do not volunteer ` +
      `these unless the counselor creates room for them -- they come up ` +
      `sideways, or when something they say touches one of them.`
    );
  }

  // Get persona prompt for specific patient
  private static getPersonaPrompt(patient: SimulatedPatient): string {
    
    return `
You are ${patient.name}, a ${patient.age}-year-old ${patient.gender} ${lifeStageOf(patient)} with ${patient.culturalBackground} cultural background.

BACKGROUND: ${patient.backstory}

PERSONALITY TRAITS: ${patient.personalityTraits.join(', ')}

CURRENT CONCERNS: ${this.describeConcerns(patient)}

COMMUNICATION STYLE: ${patient.communicationStyle} - ${this.getStyleDescription(patient.communicationStyle)}

EMOTIONAL EXPRESSION: ${patient.emotionalExpression} - ${this.getEmotionalDescription(patient.emotionalExpression)}

TRUST LEVEL: ${patient.trustLevel} - ${this.getTrustDescription(patient.trustLevel)}

CULTURAL FACTORS: ${patient.culturalFactors.join(', ')}

SESSION GOALS: ${patient.sessionGoals.join(', ')}
    `.trim();
  }

  // System prompt for patient roleplay
  private static getPatientSystemPrompt(): string {
    return `
You are a skilled actor roleplaying as a college student seeking mental health support. Your role is to help train counselors in cultural competency by providing authentic, realistic responses.

CORE PRINCIPLES:
1. Stay completely in character - never break roleplay
2. Respond authentically based on the patient's cultural background and personality
3. Show realistic emotional responses to counselor's cultural awareness (or lack thereof)
4. Reference cultural elements naturally when they would come up organically
5. Respond positively to culturally sensitive approaches
6. Show hesitation or guardedness when counselor makes cultural missteps
7. Use age-appropriate language and cultural references

RESPONSE GUIDELINES:
- Keep responses natural and conversational (typically 2-4 sentences)
- Show emotional progression based on how understood you feel
- Include cultural references when they feel natural
- React authentically to counselor's approach and cultural sensitivity
- Don't explain cultural concepts unless the patient would naturally do so
- Use plain text only - no asterisks, formatting, or stage directions

Your goal is to provide realistic training scenarios that help counselors improve their cultural competency skills.
    `.trim();
  }

  // Helper methods for generation
  private static generateName(culturalBackground: CulturalBackground, gender: Gender): string {
    const names = {
      'african-american': {
        male: ['Marcus', 'Jamal', 'DeShawn', 'Malik', 'Terrell', 'Damon'],
        female: ['Keisha', 'Aaliyah', 'Destiny', 'Imani', 'Nia', 'Zara'],
        'non-binary': ['Jordan', 'Taylor', 'Cameron', 'Riley', 'Avery']
      },
      'latino-hispanic': {
        male: ['Carlos', 'Diego', 'Miguel', 'Luis', 'Jose', 'Rafael'],
        female: ['Sofia', 'Isabella', 'Carmen', 'Lucia', 'Maria', 'Paloma'],
        'non-binary': ['Alex', 'River', 'Sage', 'Phoenix', 'Quinn']
      },
      'east-asian': {
        male: ['Chen', 'Wei', 'Jun', 'Hiro', 'Kai', 'Ryo'],
        female: ['Li', 'Mei', 'Yuki', 'Hana', 'Min', 'Akiko'],
        'non-binary': ['Sage', 'River', 'Kai', 'Moon', 'Star']
      },
      'south-asian': {
        male: ['Arjun', 'Ravi', 'Anil', 'Dev', 'Vikram', 'Rohit'],
        female: ['Priya', 'Anita', 'Kavya', 'Meera', 'Sita', 'Devi'],
        'non-binary': ['Ari', 'Sky', 'River', 'Sage', 'Rain']
      }
    };

    const fallbackNames = {
      male: ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey'],
      female: ['Taylor', 'Sam', 'Jordan', 'Alex', 'Riley'],
      'non-binary': ['Jordan', 'Taylor', 'Alex', 'Sam', 'Casey']
    };

    const nameList = names[culturalBackground]?.[gender] || fallbackNames[gender];
    return nameList[Math.floor(Math.random() * nameList.length)];
  }

  private static generateBackstory(
    culturalBackground: CulturalBackground, 
    gender: Gender, 
    age: number, 
    concern: MentalHealthConcern
  ): string {
    const backstories = {
      'african-american': {
        anxiety: `${gender === 'male' ? 'He' : gender === 'female' ? 'She' : 'They'} grew up in a close-knit community but now attends a predominantly white institution. Strong family ties and high expectations create pressure to succeed while representing their community well.`,
        depression: `Coming from a family that values strength and resilience, ${gender === 'male' ? 'he' : gender === 'female' ? 'she' : 'they'} struggles with feelings that seem to conflict with cultural expectations of perseverance through hardship.`
      },
      'east-asian': {
        anxiety: `International student from China/Japan/Korea whose parents sacrificed greatly for their education. Academic performance directly affects family honor and future immigration status.`,
        depression: `High-achieving student who has always met family expectations but now struggles with motivation and purpose, feeling unable to share these struggles due to mental health stigma.`
      }
      // Add more backstories as needed
    };

    return backstories[culturalBackground]?.[concern] || 
      `A ${age}-year-old college student navigating the challenges of higher education while maintaining connections to their cultural identity and family expectations.`;
  }

  private static generateSessionGoals(concern: MentalHealthConcern): string[] {
    const goals = {
      anxiety: ['Manage test anxiety', 'Improve sleep patterns', 'Develop coping strategies', 'Build confidence'],
      depression: ['Understand current feelings', 'Reconnect with interests', 'Improve daily motivation', 'Consider support options'],
      'family-conflict': ['Navigate family expectations', 'Improve communication', 'Set healthy boundaries', 'Honor cultural values'],
      'academic-stress': ['Manage workload', 'Improve time management', 'Reduce perfectionism', 'Find balance'],
      'identity-issues': ['Explore cultural identity', 'Navigate belonging', 'Understand intersectionality', 'Build self-acceptance']
    };

    return goals[concern] || ['Explore current challenges', 'Develop coping strategies', 'Improve wellbeing'];
  }

  private static getCommunicationStyle(culturalBackground: CulturalBackground): 'direct' | 'indirect' | 'mixed' {
    const styles = {
      'african-american': 'direct',
      'white-american': 'direct', 
      'east-asian': 'indirect',
      'south-asian': 'indirect',
      'middle-eastern': 'mixed',
      'latino-hispanic': 'mixed'
    };

    return styles[culturalBackground] || 'mixed';
  }

  private static getEmotionalExpression(
    culturalBackground: CulturalBackground, 
    traits: string[]
  ): 'open' | 'reserved' | 'selective' {
    if (traits.includes('emotional') || traits.includes('extroverted')) return 'open';
    if (traits.includes('introverted') || traits.includes('traditional')) return 'reserved';
    return 'selective';
  }

  private static getTrustLevel(
    culturalBackground: CulturalBackground, 
    concern: MentalHealthConcern
  ): 'high' | 'medium' | 'low' {
    const stigmatizedConcerns = ['depression', 'family-conflict'];
    const reservedCultures = ['east-asian', 'south-asian', 'middle-eastern'];

    if (stigmatizedConcerns.includes(concern) && reservedCultures.includes(culturalBackground)) {
      return 'low';
    }

    return Math.random() > 0.5 ? 'medium' : 'high';
  }

  private static getCulturalFactors(
    culturalBackground: CulturalBackground, 
    concern: MentalHealthConcern
  ): string[] {
    const culturalInfo = CULTURAL_BACKGROUNDS_INFO[culturalBackground];
    const factors = culturalInfo?.commonFactors || [];
    
    // Add concern-specific factors
    const concernFactors = {
      anxiety: ['academic pressure', 'family expectations'],
      depression: ['mental health stigma', 'family honor'],
      'family-conflict': ['intergenerational conflict', 'cultural values'],
      'identity-issues': ['cultural identity', 'belonging questions']
    };

    return [...factors.slice(0, 2), ...concernFactors[concern] || []];
  }

  private static getStyleDescription(style: string): string {
    const descriptions = {
      direct: 'Speaks openly and directly about feelings and problems',
      indirect: 'Uses subtle hints and expects counselor to read between lines',
      mixed: 'Sometimes direct, sometimes indirect depending on topic comfort level'
    };
    return descriptions[style] || descriptions.mixed;
  }

  private static getEmotionalDescription(expression: string): string {
    const descriptions = {
      open: 'Easily shares emotions and personal experiences',
      reserved: 'Takes time to open up, may minimize emotional impact', 
      selective: 'Open about some topics but guarded about others'
    };
    return descriptions[expression] || descriptions.selective;
  }

  private static getTrustDescription(trust: string): string {
    const descriptions = {
      high: 'Trusts counselor quickly, open to feedback',
      medium: 'Cautiously optimistic, needs to feel heard first',
      low: 'Skeptical of counseling, may test counselor initially'
    };
    return descriptions[trust] || descriptions.medium;
  }

  private static cleanPatientResponse(content: string): string {
    return content
      .replace(/^\*+|\*+$/g, '') // Remove asterisks
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
      .replace(/\[.*?\]/g, '') // Remove stage directions
      .trim();
  }

  private static getFallbackResponse(
    _patient: SimulatedPatient,
    _counselorMessage: string,
    counselorLanguage: 'en' | 'es' = 'en'
  ): string {
    // Fallbacks have to match the session's language as well. An English fallback
    // mid-Spanish session reads as the patient abruptly switching languages, which
    // is the behaviour this change exists to stop.
    // The Spanish lines deliberately avoid gendered adjectives so they fit any patient.
    const fallbacks = counselorLanguage === 'es'
      ? [
          "No sé cómo responder a eso ahora mismo.",
          "¿Me puedes explicar un poco más lo que quieres decir?",
          "Eso es interesante... necesito un momento para pensarlo.",
          "Gracias por preguntar, pero todo esto me está costando un poco."
        ]
      : [
          "I'm not sure how to respond to that right now.",
          "Could you help me understand what you mean?",
          "That's interesting... I need a moment to think about that.",
          "I appreciate you asking, but I'm feeling a bit overwhelmed."
        ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}