// OpenAI API service for AI responses and analysis
import { CulturalBackground, ResponseFeedback } from '../types';
import { ENV } from '../config/env';
import { modelParams } from '../config/aiModels';

interface OpenAIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIService {
  private static readonly BASE_URL = 'https://api.openai.com/v1/chat/completions';
  
  // Cultural prompts for different backgrounds
  private static readonly CULTURAL_PROMPTS = {
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

  private static readonly BASE_SYSTEM_PROMPT = `
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
  private static cleanAIResponse(content: string): string {
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

  // Generate culturally-aware AI response
  static async generateCulturalResponse(
    userMessage: string,
    culturalBackground: CulturalBackground,
    conversationHistory: OpenAIMessage[] = [],
    preferredLanguage?: 'en' | 'es'
  ): Promise<OpenAIResponse> {
    try {
      // Call our server-side API route instead of directly calling OpenAI
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userMessage,
          culturalBackground,
          conversationHistory: conversationHistory.slice(-6), // Include last 6 messages for context
          preferredLanguage: preferredLanguage || 'en'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Chat API error: ${response.status} ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate response');
      }

      return {
        content: data.content,
        model: data.model,
        usage: data.usage
      };
    } catch (error: unknown) {
      console.error('Chat API error:', error);
      throw new Error('Failed to generate AI response: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Analyze counselor response quality
  static async analyzeCounselorResponse(
    originalMessage: string,
    counselorResponse: string,
    culturalBackground: CulturalBackground
  ): Promise<ResponseFeedback> {
    try {
      const analysisPrompt = `
        You are an expert mental health supervisor analyzing a counselor's response for quality and cultural sensitivity.

        ORIGINAL STUDENT MESSAGE:
        "${originalMessage}"

        COUNSELOR RESPONSE:
        "${counselorResponse}"

        STUDENT'S CULTURAL BACKGROUND: ${culturalBackground}

        Please analyze this response and provide scores (1-10 scale) for:

        1. EMPATHY: How well does the response validate and acknowledge the student's emotions?
        2. CULTURAL_SENSITIVITY: How appropriately does it consider the student's cultural context?
        3. QUESTIONING: How effectively does it use open-ended questions to explore deeper?
        4. GOAL_ORIENTATION: How well does it help the student identify next steps or solutions?
        5. PROFESSIONALISM: How appropriate is the tone and language for a counseling context?

        Respond in this JSON format:
        {
          "empathyScore": 8,
          "culturalSensitivityScore": 7,
          "questioningScore": 6,
          "goalOrientationScore": 8,
          "professionalismScore": 9,
          "overallRating": 7.6,
          "aiAnalysis": "Detailed analysis of strengths and areas for improvement...",
          "improvementSuggestions": [
            "Suggestion 1...",
            "Suggestion 2..."
          ]
        }
      `;

      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          ...modelParams('ANALYSIS', { maxTokens: 1500, temperature: 0.3 }),
          messages: [
            { role: 'system', content: 'You are an expert mental health supervisor providing constructive feedback.' },
            { role: 'user', content: analysisPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const analysisText = data.choices[0].message.content;

      // Parse the JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid analysis format');
      }

      const analysisResult = JSON.parse(jsonMatch[0]);

      return {
        empathyScore: analysisResult.empathyScore,
        culturalSensitivityScore: analysisResult.culturalSensitivityScore,
        questioningScore: analysisResult.questioningScore,
        goalOrientationScore: analysisResult.goalOrientationScore,
        professionalismScore: analysisResult.professionalismScore,
        overallRating: analysisResult.overallRating,
        aiAnalysis: analysisResult.aiAnalysis,
        improvementSuggestions: analysisResult.improvementSuggestions,
        analyzedAt: new Date(),
        feedbackVersion: '1.0'
      };
    } catch (error: unknown) {
      console.error('Failed to analyze counselor response:', error);
      // Return default feedback if analysis fails
      return {
        aiAnalysis: 'Analysis temporarily unavailable. Please try again later.',
        analyzedAt: new Date(),
        feedbackVersion: '1.0'
      };
    }
  }

  // Generate conversation title from messages
  static async generateConversationTitle(messages: OpenAIMessage[]): Promise<string> {
    try {
      const titlePrompt = `
        Based on this mental health conversation, generate a short, descriptive title (3-6 words max).
        Focus on the main topic or concern discussed. Be sensitive and avoid clinical language.

        Conversation preview:
        ${messages.slice(0, 3).map(m => `${m.role}: ${m.content.substring(0, 100)}...`).join('\n')}

        Examples of good titles:
        - "Academic Stress Support"
        - "Family Relationship Concerns"
        - "Cultural Identity Questions"
        - "Career Anxiety Discussion"

        Generate only the title, no additional text:
      `;

      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          // UTILITY is the cheap role; see src/config/aiModels.ts.
          ...modelParams('UTILITY', { maxTokens: 50, temperature: 0.5 }),
          messages: [
            { role: 'user', content: titlePrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to generate title:', error);
      return `Session ${new Date().toLocaleDateString()}`;
    }
  }

  // Check if message indicates crisis situation
  static async detectCrisis(message: string): Promise<boolean> {
    try {
      const crisisPrompt = `
        Analyze this message for signs of immediate mental health crisis, including:
        - Suicidal thoughts or self-harm
        - Immediate danger to self or others
        - Severe psychological distress requiring immediate intervention

        Message: "${message}"

        Respond with only "CRISIS" or "SAFE". Be cautious - err on the side of safety.
      `;

      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ENV.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          ...modelParams('UTILITY', { maxTokens: 50, temperature: 0.1 }),
          messages: [
            { role: 'system', content: 'You are a crisis detection system. Be extremely cautious and prioritize safety.' },
            { role: 'user', content: crisisPrompt }
          ]
        })
      });

      if (!response.ok) {
        // If API fails, err on the side of caution
        return true;
      }

      const data = await response.json();
      return data.choices[0].message.content.trim().toUpperCase().includes('CRISIS');
    } catch (error) {
      console.error('Crisis detection failed:', error);
      // If detection fails, assume crisis to be safe
      return true;
    }
  }
}