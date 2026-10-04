import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

// Distils a finished training session into the handful of facts that should
// shape the next one. This is deliberately not a prose recap: a recap gets
// pasted into the next prompt and the patient starts reciting their own file.
// Extracting discrete fields lets the next session use them selectively --
// rapport sets the greeting, unresolved threads give the patient something to
// come back to, risk flags surface in the UI whether or not the model repeats them.
export async function POST(request: NextRequest) {
  let memoryText: string | null = null;

  try {
    const { patientName, culturalBackground, concern, transcript, previousHeadlines } =
      await request.json();

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json(
        { error: 'A transcript is required' },
        { status: 400 }
      );
    }

    const priorContext = Array.isArray(previousHeadlines) && previousHeadlines.length
      ? `\nPREVIOUS SESSIONS WITH THIS COUNSELOR (oldest first):\n${
          previousHeadlines.map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')
        }\nTreat anything already listed above as known. Only record what is NEW or CHANGED this session.\n`
      : '\nThis was the first session with this counselor.\n';

    const prompt = `
You are a clinical documentation assistant. You read a counselling transcript and
extract only the facts that would change how the NEXT session begins.

PATIENT: ${patientName || 'Unknown'}
CULTURAL BACKGROUND: ${culturalBackground || 'unspecified'}
PRESENTING CONCERN ON FILE: ${concern || 'unspecified'}
${priorContext}
TRANSCRIPT
----------
${transcript}
----------

Return JSON in exactly this shape:

{
  "headline": "<one sentence a supervisor could read in 3 seconds>",
  "presentingConcerns": ["<what was actually discussed, not what the file says>"],
  "keyDisclosures": ["<facts the patient revealed for the first time this session>"],
  "emotionalState": "<where the patient ended emotionally, one sentence>",
  "riskFlags": ["<self-harm, suicidality, abuse, substance crisis, safeguarding>"],
  "counselorCommitments": ["<anything either side agreed to do before next time>"],
  "unresolvedThreads": ["<opened and not closed; what next session should pick up>"],
  "culturalNotes": ["<culture, faith, family or language factors that shaped the session>"],
  "rapportLevel": "low" | "medium" | "high"
}

Rules:
- Never invent a detail that is not in the transcript. If a field has nothing, use an empty array.
- riskFlags must never be softened or omitted. If the patient expressed hopelessness,
  self-harm or suicidality in any form, record it verbatim enough to be recognisable.
  If there genuinely were none, return an empty array.
- Write about the patient in the third person.
- rapportLevel reflects how much the patient trusted the counselor BY THE END:
  "low" = still guarded or deflecting, "medium" = opening up with hesitation,
  "high" = disclosing freely and engaging with what the counselor offered.
- Keep every string under 25 words.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You extract structured clinical continuity records from counselling transcripts. ' +
            'You are quote-faithful and never embellish. Always respond with valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1200
    });

    memoryText = response.choices[0].message.content;
    if (!memoryText) {
      throw new Error('No session memory generated');
    }

    // Same markdown-fence cleanup the other routes do -- gpt-4o still wraps JSON
    // in a code fence often enough to matter.
    let cleanedText = memoryText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[0];
    }

    const memory = JSON.parse(cleanedText.trim());

    return NextResponse.json({ success: true, memory });

  } catch (error: unknown) {
    console.error('Session memory API failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : '';

    if (errorName === 'SyntaxError' && errorMessage?.includes('JSON')) {
      console.error('Raw response that failed to parse:', memoryText?.substring(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse session memory response', details: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate session memory: ' + errorMessage },
      { status: 500 }
    );
  }
}
