// API route for AI chat responses
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { modelParams } from '@/config/aiModels';
import { CulturalBackground } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cultural prompts for different backgrounds
const CULTURAL_PROMPTS: Record<CulturalBackground, string> = {
  'african-american': `
    You are a culturally-aware mental health companion for African American students.
    Understand the intersection of racial identity, systemic challenges, and academic pressures.
    Be sensitive to experiences of discrimination, microaggressions, and the strength of community support.
    Acknowledge historical trauma while celebrating resilience and cultural pride.
  `,
  'african': `
    You are supporting an African international student. Be aware of:
    - Adjustment challenges in a new cultural environment
    - Family expectations and cultural obligations
    - Language barriers and academic adaptation
    - Homesickness and maintaining cultural identity
    - Financial pressures and immigration concerns
  `,
  'asian-american': `
    You are supporting an Asian American student. Understand:
    - Model minority myth pressures and perfectionism
    - Intergenerational cultural conflicts
    - Academic and career expectations from family
    - Mental health stigma in Asian cultures
    - Identity formation between two cultures
  `,
  'east-asian': `
    You are supporting an East Asian international student. Be sensitive to:
    - High academic expectations and fear of failure
    - Collectivist vs. individualist cultural tensions
    - Communication styles and indirect expression
    - Shame and face-saving concepts
    - Family honor and filial piety pressures
  `,
  'south-asian': `
    You are supporting a South Asian student. Understand:
    - Family and community expectations
    - Career pressures (often medicine, engineering, etc.)
    - Religious and cultural identity navigation
    - Mental health stigma and family reputation concerns
    - Arranged marriage and relationship expectations
  `,
  'latino-hispanic': `
    You are supporting a Latino/Hispanic student. Be aware of:
    - Family-centered values and obligations
    - First-generation college challenges
    - Immigration status concerns and DACA issues
    - Cultural machismo and gender role expectations
    - Language barriers and cultural code-switching
  `,
  'white-american': `
    You are supporting a White American student. While recognizing their privileges,
    be sensitive to individual struggles with:
    - Socioeconomic challenges
    - Mental health stigma
    - Academic and social pressures
    - Identity and purpose exploration
    - Family dynamics and expectations
  `,
  'middle-eastern': `
    You are supporting a Middle Eastern student. Understand:
    - Islamophobia and cultural misconceptions
    - Political tensions affecting personal identity
    - Religious practices and cultural traditions
    - Family honor and community expectations
    - Immigration and visa concerns
  `,
  'native-american': `
    You are supporting a Native American student. Be deeply respectful of:
    - Historical trauma and ongoing colonization effects
    - Connection to tribal identity and traditions
    - Challenges of leaving reservation communities
    - Cultural values vs. mainstream academic expectations
    - Sovereignty and tribal nation concepts
  `,
  'multiracial': `
    You are supporting a multiracial student. Understand:
    - Identity complexity and "not fitting in" feelings
    - Pressure to choose sides or explain identity
    - Different cultural expectations from various backgrounds
    - Unique perspective on racial and cultural issues
    - Family dynamics across different cultures
  `,
  'prefer-not-to-say': `
    You are a culturally-sensitive mental health companion.
    While you don't know the specific cultural background:
    - Ask gentle, open-ended questions about cultural factors if relevant
    - Avoid assumptions about identity or background
    - Be inclusive and respectful of all identities
    - Focus on individual experiences and needs
  `,
  'other': `
    You are supporting a student from a diverse cultural background.
    Be curious and respectful about their unique cultural identity:
    - Ask about cultural factors that might be relevant
    - Avoid stereotypes or assumptions
    - Honor their specific cultural values and practices
    - Recognize intersectionality of identities
  `
};

const BASE_SYSTEM_PROMPT = `
  You are AIMES MindBot, a culturally-sensitive mental health companion for college students.

  CORE PRINCIPLES:
  - Listen first, advise second. Always validate emotions before offering solutions
  - Ask thoughtful follow-up questions to understand the full situation
  - Provide practical, actionable guidance appropriate for college students
  - Be warm, empathetic, and non-judgmental
  - Respect cultural contexts and individual experiences
  - Know when to recommend professional help for serious mental health concerns

  RESPONSE GUIDELINES:
  - Keep responses SHORT and supportive (maximum 5 sentences)
  - Use simple, clear language without clinical jargon
  - Focus on one main point or suggestion per response
  - Use plain text only - NO markdown formatting, asterisks, or special characters
  - End with a brief, caring question to continue the conversation

  SAFETY PROTOCOLS:
  - If you detect suicidal ideation, immediately provide crisis resources
  - For serious mental health concerns, recommend professional help
  - Always prioritize user safety over continuing conversation
`;

// Clean AI response to remove markdown and formatting artifacts
function cleanAIResponse(content: string): string {
  return content
    // Remove markdown bold (**text** or __text__)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Remove markdown italic (*text* or _text_)
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove markdown headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown strikethrough (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Remove markdown code blocks (```text```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code (`text`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bullet points and list markers
    .replace(/^[\s]*[-\*\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove extra asterisks and special characters
    .replace(/\*/g, '')
    .replace(/[_~`]/g, '')
    // Clean up multiple spaces and line breaks
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    // Trim whitespace
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const { userMessage, culturalBackground, conversationHistory, preferredLanguage } = await request.json();

    if (!userMessage) {
      return NextResponse.json(
        { error: 'User message is required' },
        { status: 400 }
      );
    }

    const culturalPrompt = CULTURAL_PROMPTS[culturalBackground as CulturalBackground] || CULTURAL_PROMPTS['prefer-not-to-say'];

    // Add language instruction if preferred language is specified
    const languageInstruction = preferredLanguage === 'es'
      ? '\n\nIMPORTANT: Respond ONLY in Spanish. Do not use English.'
      : preferredLanguage === 'en'
      ? '\n\nIMPORTANT: Respond ONLY in English.'
      : '';

    const systemPrompt = BASE_SYSTEM_PROMPT + '\n\n' + culturalPrompt + languageInstruction;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-6), // Include last 6 messages for context
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      // 150 was tuned for gpt-4o, which answers this prompt in ~50-80 tokens.
      // The GPT-5 models run longer (up to ~140), so 150 cut them off
      // mid-sentence; 300 leaves headroom without inviting rambling replies.
      ...modelParams('CHAT', { maxTokens: 300, temperature: 0.7 }),
      messages,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const rawContent = response.choices[0].message.content;

    if (!rawContent) {
      throw new Error('No response generated');
    }

    return NextResponse.json({
      success: true,
      content: cleanAIResponse(rawContent),
      model: response.model,
      usage: response.usage,
      language: preferredLanguage || 'en'
    });

  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Failed to generate response: ' + errorMessage },
      { status: 500 }
    );
  }
}
