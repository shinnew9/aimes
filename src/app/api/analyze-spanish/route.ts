import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
      model: 'gpt-4o',
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
      temperature: 0.3,
      max_tokens: 200
    });

    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);

    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error('Spanish analysis error:', error);
    return NextResponse.json({ success: false, error: 'Analysis failed' }, { status: 500 });
  }
}
