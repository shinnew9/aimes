import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { modelParams } from '@/config/aiModels';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  let feedbackText: string | null = null;

  try {
    const { topicId, skillFocus, scenario, counselorResponse } = await request.json();

    if (!counselorResponse || !scenario) {
      return NextResponse.json(
        { error: 'Scenario and counselor response are required' },
        { status: 400 }
      );
    }

    const prompt = `
You are an expert CBT clinical supervisor evaluating a counselor-in-training's response to a practice scenario.

SKILL FOCUS: ${skillFocus || 'General CBT skills'}
TOPIC: ${topicId || 'General'}

PRACTICE SCENARIO:
${scenario}

COUNSELOR'S RESPONSE:
"${counselorResponse}"

Evaluate this response and provide feedback as JSON:

{
  "overallScore": <1-10 score for overall quality>,
  "techniqueScore": <1-10 score for CBT technique application>,
  "empathyScore": <1-10 score for empathy and rapport>,
  "strengths": ["3-4 specific things the counselor did well"],
  "improvements": ["3-4 specific, actionable suggestions for improvement"],
  "modelResponse": "A model response showing how an experienced CBT therapist might handle this scenario (2-4 sentences)"
}

Scoring guide:
- 1-3: Significant issues, misses core CBT principles
- 4-5: Shows basic understanding but misses key elements
- 6-7: Competent application with room for improvement
- 8-9: Strong, skillful application of CBT techniques
- 10: Exceptional, expert-level response

Be encouraging but honest. Focus on specific, actionable feedback rather than vague praise. The model response should demonstrate the skill being practiced.
`;

    const response = await openai.chat.completions.create({
      ...modelParams('ANALYSIS', { maxTokens: 1500, temperature: 0.3 }),
      messages: [
        {
          role: 'system',
          content: 'You are an expert CBT clinical supervisor providing constructive feedback on counselor training exercises. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    feedbackText = response.choices[0].message.content;
    if (!feedbackText) {
      throw new Error('No feedback generated');
    }

    // Clean the response text (remove markdown code blocks if present)
    let cleanedText = feedbackText.trim();

    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[0];
    }

    cleanedText = cleanedText.trim();

    const feedback = JSON.parse(cleanedText);

    return NextResponse.json({ success: true, feedback });

  } catch (error: unknown) {
    console.error('CBT feedback API failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : '';

    if (errorName === 'SyntaxError' && errorMessage?.includes('JSON')) {
      console.error('Raw response that failed to parse:', feedbackText?.substring(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse feedback response', details: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate CBT feedback: ' + errorMessage },
      { status: 500 }
    );
  }
}
