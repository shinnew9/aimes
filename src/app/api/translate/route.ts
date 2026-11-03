// API route for bidirectional translation (English ↔ Spanish)
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { modelParams } from '@/config/aiModels';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type Language = 'en' | 'es';
type SpeakerGender = 'male' | 'female' | 'non-binary';

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Spanish'
};

const GENDER_AGREEMENT: Record<SpeakerGender, string> = {
  male: 'masculine',
  female: 'feminine',
  'non-binary': 'gender-neutral'
};

const VALID_GENDERS: SpeakerGender[] = ['male', 'female', 'non-binary'];

// Spanish marks grammatical gender on adjectives and participles that refer to
// people, so a translation with no idea who is speaking falls back to masculine
// forms and misgenders them. Whoever is known gets an explicit rule; the rest is
// left alone rather than guessed at.
const buildGenderInstruction = (
  speakerGender?: SpeakerGender,
  addresseeGender?: SpeakerGender
): string => {
  const rules: string[] = [];

  if (speakerGender) {
    rules.push(
      `- The speaker describes themselves in the first person ("I am tired"). Use ${GENDER_AGREEMENT[speakerGender]} agreement for words that refer to them.`
    );
  }

  if (addresseeGender) {
    rules.push(
      `- The person being spoken to is referred to in the second person ("you are welcome"). Use ${GENDER_AGREEMENT[addresseeGender]} agreement for words that refer to them.`
    );
  }

  if (rules.length === 0) return '';

  if (speakerGender === 'non-binary' || addresseeGender === 'non-binary') {
    rules.push(
      '- For a gender-neutral person, prefer wording that sidesteps grammatical gender entirely rather than defaulting to masculine forms.'
    );
  }

  return 'GRAMMATICAL GENDER:\n' + rules.join('\n');
};

export async function POST(request: NextRequest) {
  try {
    const { text, sourceLanguage, targetLanguage, speakerGender, addresseeGender } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      );
    }

    // Validate languages
    const validLanguages: Language[] = ['en', 'es'];
    if (!validLanguages.includes(targetLanguage as Language)) {
      return NextResponse.json(
        { error: 'Invalid target language. Supported: en, es' },
        { status: 400 }
      );
    }

    const sourceLang = sourceLanguage || 'auto';
    const targetLang = targetLanguage as Language;

    // Unknown or malformed genders are dropped rather than defaulted, so the
    // translator only gets agreement rules the caller actually vouched for.
    const speaker = VALID_GENDERS.includes(speakerGender) ? (speakerGender as SpeakerGender) : undefined;
    const addressee = VALID_GENDERS.includes(addresseeGender) ? (addresseeGender as SpeakerGender) : undefined;

    const sourceClause = sourceLang === 'auto' ? '' : ` ${LANGUAGE_NAMES[sourceLang as Language]}`;

    const systemPrompt = [
      `You are a professional translator. Translate the given${sourceClause} text to ${LANGUAGE_NAMES[targetLang]}. Maintain the tone, emotion, and cultural nuances.`,
      buildGenderInstruction(speaker, addressee),
      `Only respond with the ${LANGUAGE_NAMES[targetLang]} translation, nothing else.`
    ].filter(Boolean).join('\n\n');

    const response = await openai.chat.completions.create({
      ...modelParams('CHAT', { maxTokens: 500, temperature: 0.3 }),
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ]
    });

    const translation = response.choices[0].message.content;

    if (!translation) {
      throw new Error('No translation generated');
    }

    return NextResponse.json({
      success: true,
      translation: translation.trim(),
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

  } catch (error: unknown) {
    console.error('Translation API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Failed to translate: ' + errorMessage },
      { status: 500 }
    );
  }
}
