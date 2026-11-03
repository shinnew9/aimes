import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { modelParams } from '@/config/aiModels';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: false, error: 'No messages provided' }, { status: 400 });
    }

    const messagesText = messages
      .map((m: { content: string }, i: number) => `Message ${i + 1}: "${m.content}"`)
      .join('\n');

    const response = await openai.chat.completions.create({
      // 200 was enough for gpt-4o, but reasoning tokens come out of the same
      // budget, so leave headroom or the JSON comes back empty.
      ...modelParams('ANALYSIS', { maxTokens: 1000, temperature: 0.3 }),
      messages: [
        {
          role: 'system',
          content: `You are an expert Spanish language evaluator specializing in mental health communication.
You will evaluate the Spanish language proficiency of a counselor based on their messages.
Rate their Spanish on a scale of 1-10 considering:
- Grammar accuracy
- Vocabulary appropriateness for a mental health context
- Natural fluency and flow
- Cultural sensitivity in language use

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 1-10>,
  "feedback": "<one sentence of constructive feedback>",
  "strengths": "<brief strength noted>",
  "improvement": "<brief area to improve>"
}`
        },
        {
          role: 'user',
          content: `Please evaluate the Spanish proficiency in these counselor messages:\n\n${messagesText}`
        }
      ],
      // Without this the model wraps its JSON in a markdown fence, which made the
      // parse below throw every single time — this endpoint had never once
      // succeeded. JSON mode guarantees a bare object.
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    // Belt and braces: strip a markdown fence if one ever shows up anyway, so a
    // model or settings change cannot break this the same way again.
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    const result = JSON.parse(cleaned);

    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error('Spanish analysis error:', error);
    return NextResponse.json({ success: false, error: 'Analysis failed' }, { status: 500 });
  }
}
