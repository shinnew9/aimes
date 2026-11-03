import OpenAI from 'openai';
import { ENV } from '../config/env';
import { modelFor, modelParams } from '../config/aiModels';
import { 
  ConversationAnalysisContext, 
  ConversationFeedback, 
  CULTURAL_BACKGROUNDS_INFO 
} from '../types/Feedback';
import { CulturalBackground } from '../types/User';

export class ConversationAnalysisService {
  private static openai = new OpenAI({
    apiKey: ENV.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Note: In production, move this to backend
  });

  // Main conversation analysis function
  static async analyzeFullConversation(context: ConversationAnalysisContext): Promise<Omit<ConversationFeedback, 'id' | 'analyzedAt'>> {
    try {
      console.log('Starting full conversation analysis for conversation:', context.conversationId);
      
      const prompt = this.buildConversationAnalysisPrompt(context);
      console.log('Conversation analysis prompt built for cultural background:', context.culturalBackground);

      const response = await this.openai.chat.completions.create({
        ...modelParams('ANALYSIS', { maxTokens: 6000, temperature: 0.2 }),
        messages: [
          {
            role: 'system',
            content: this.getConversationAnalysisSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const analysisResult = response.choices[0]?.message?.content;
      if (!analysisResult) {
        throw new Error('No analysis result received from OpenAI');
      }

      console.log('Raw conversation analysis result:', analysisResult);
      const parsedResult = this.parseConversationAnalysisResult(analysisResult, context);
      
      console.log('Conversation analysis completed successfully');
      return {
        conversationId: context.conversationId,
        counselorId: context.counselorId,
        studentId: context.studentId,
        overallPerformance: parsedResult.overallPerformance,
        conversationAnalysis: parsedResult.conversationAnalysis,
        suggestions: parsedResult.suggestions,
        analysisContext: context,
        aiModel: modelFor('ANALYSIS'),
        analysisVersion: '2.0',
        reviewedByCounselor: false,
        flaggedForReview: this.shouldFlagConversationForReview(parsedResult.overallPerformance),
        trainingDataQuality: this.assessConversationTrainingDataQuality(parsedResult.overallPerformance, context)
      };
    } catch (error: Error | unknown) {
      console.error('Failed to analyze conversation:', error);
      throw new Error('Conversation analysis failed: ' + error.message);
    }
  }

  // Build the conversation analysis prompt
  private static buildConversationAnalysisPrompt(context: ConversationAnalysisContext): string {
    const culturalInfo = CULTURAL_BACKGROUNDS_INFO[context.culturalBackground];
    
    // Format conversation messages for analysis
    const conversationText = context.messages.map((msg, index) => 
      `Message ${index + 1} (${msg.senderType.toUpperCase()}): ${msg.content}`
    ).join('\n\n');

    return `
COMPREHENSIVE CONVERSATION ANALYSIS REQUEST

STUDENT CULTURAL CONTEXT:
- Cultural Background: ${context.culturalBackground}
- Cultural Factors: ${culturalInfo?.commonFactors.join(', ') || 'General factors'}
- Cultural Sensitivities: ${culturalInfo?.sensitivities.join(', ') || 'General sensitivities'}
- Cultural Strengths: ${culturalInfo?.strengths.join(', ') || 'General strengths'}

CONVERSATION METADATA:
- Conversation ID: ${context.conversationId}
- Total Messages: ${context.conversationSummary.totalMessages}
- Student Messages: ${context.conversationSummary.studentMessages}
- Counselor Messages: ${context.conversationSummary.counselorMessages}
- Duration: ${context.conversationSummary.conversationDuration}
- Urgency Level: ${context.conversationSummary.urgencyLevel}
- Main Topics: ${context.conversationSummary.mainTopics.join(', ')}
- Emotional Progression: ${context.conversationSummary.emotionalProgression.join(' → ')}
- Conversation Outcome: ${context.conversationSummary.conversationOutcome}

STUDENT PROFILE:
${context.studentProfile ? `
- Age: ${context.studentProfile.age || 'Not specified'}
- Previous Sessions: ${context.studentProfile.previousSessions || 'First session'}
- Cultural Notes: ${context.studentProfile.culturalNotes?.join(', ') || 'None'}
- Communication Style: ${context.studentProfile.preferredCommunicationStyle || 'Not specified'}
` : 'No detailed profile available'}

COMPLETE CONVERSATION THREAD:
${conversationText}

ANALYSIS INSTRUCTIONS:
Please provide a comprehensive analysis of the counselor's performance throughout this ENTIRE conversation. Focus on:

1. CONVERSATION FLOW (1-10): How well did the counselor guide the conversation? Was there natural progression?
2. CULTURAL SENSITIVITY (1-10): Consistent cultural awareness and respect throughout the conversation?
3. THERAPEUTIC PROGRESS (1-10): Did the student make progress? Was the conversation helpful?
4. PROFESSIONAL BOUNDARIES (1-10): Were appropriate therapeutic boundaries maintained?
5. EMPATHY (1-10): Consistent empathetic responses throughout the conversation?

DETAILED ANALYSIS AREAS:
- STRENGTHS: What did the counselor do exceptionally well throughout the conversation?
- WEAKNESSES: What patterns of behavior need improvement?
- CULTURAL ANALYSIS: Missed cultural opportunities and excellent cultural moments
- CONVERSATION PACING: Was the pace appropriate for this cultural context?
- QUESTIONING TECHNIQUE: Quality and cultural appropriateness of questions
- SPECIFIC MOMENTS: Point to specific message numbers with praise or constructive criticism

CULTURAL CONSIDERATIONS FOR ${context.culturalBackground.toUpperCase()}:
- Common factors: ${culturalInfo?.commonFactors.join(', ')}
- Cultural sensitivities: ${culturalInfo?.sensitivities.join(', ')}
- Cultural strengths: ${culturalInfo?.strengths.join(', ')}

Provide specific, actionable feedback that recognizes good work AND provides clear improvement suggestions.
    `.trim();
  }

  // System prompt for conversation analysis
  private static getConversationAnalysisSystemPrompt(): string {
    return `
You are an expert cultural competency supervisor and therapeutic conversation analyst. Your role is to analyze COMPLETE conversations between counselors and students from diverse cultural backgrounds, providing comprehensive, balanced feedback.

ANALYSIS REQUIREMENTS:
1. Analyze the ENTIRE conversation flow, not individual messages
2. Provide balanced feedback - acknowledge strengths AND areas for improvement
3. Be specific about which parts of the conversation worked well and which didn't
4. Consider cultural context throughout the entire interaction
5. Assess therapeutic progression and student benefit
6. Reference specific message numbers when giving examples

SCORING GUIDELINES (1-10 scale):
- 9-10: Exceptional - Demonstrates outstanding cultural competency and therapeutic skill throughout
- 7-8: Good - Shows solid understanding with minor areas for improvement
- 5-6: Needs Improvement - Adequate but missing key cultural or therapeutic elements
- 3-4: Poor - Significant cultural missteps or therapeutic concerns
- 1-2: Very Poor - Potentially harmful or highly inappropriate

FEEDBACK STYLE:
- Be constructive but honest
- Point out specific excellent moments and explain why they worked
- Identify specific problematic moments and suggest better approaches
- Provide cultural context for your suggestions
- Focus on patterns across the conversation, not isolated incidents

OUTPUT FORMAT:
Respond with a JSON object containing:
{
  "overallPerformance": {
    "conversationFlow": number,
    "culturalSensitivity": number,
    "therapeuticProgress": number,
    "professionalBoundaries": number,
    "empathy": number,
    "overallScore": number
  },
  "conversationAnalysis": {
    "strengths": ["specific strengths with message references"],
    "weaknesses": ["specific areas needing improvement"],
    "culturalMisses": ["missed cultural opportunities"],
    "goodCulturalMoments": ["excellent cultural awareness moments"],
    "conversationPacing": "too-fast|appropriate|too-slow",
    "questioningTechnique": ["analysis of questioning approach"],
    "responseTiming": "analysis of response patterns and timing"
  },
  "suggestions": {
    "conversationFlow": ["how to improve conversation guidance"],
    "culturalCompetency": ["cultural sensitivity improvements"],
    "therapeuticTechnique": ["better therapeutic approaches"],
    "specificMoments": [
      {
        "messageNumber": number,
        "issue": "what went wrong",
        "betterApproach": "suggested improvement"
      }
    ],
    "positiveReinforcement": [
      {
        "messageNumber": number,
        "whatWentWell": "what was excellent",
        "whyItWorked": "why it was effective"
      }
    ]
  }
}

Be thorough, fair, and focused on helping counselors improve their cultural competency and therapeutic effectiveness through detailed conversation analysis.
    `.trim();
  }

  // Parse the conversation analysis result
  private static parseConversationAnalysisResult(result: string, context: ConversationAnalysisContext): {
    overallPerformance: ConversationFeedback['overallPerformance'];
    conversationAnalysis: ConversationFeedback['conversationAnalysis'];
    suggestions: ConversationFeedback['suggestions'];
  } {
    try {
      // Extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in conversation analysis result');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and structure the response
      const overallPerformance = {
        conversationFlow: this.validateScore(parsed.overallPerformance?.conversationFlow),
        culturalSensitivity: this.validateScore(parsed.overallPerformance?.culturalSensitivity),
        therapeuticProgress: this.validateScore(parsed.overallPerformance?.therapeuticProgress),
        professionalBoundaries: this.validateScore(parsed.overallPerformance?.professionalBoundaries),
        empathy: this.validateScore(parsed.overallPerformance?.empathy),
        overallScore: this.validateScore(parsed.overallPerformance?.overallScore)
      };

      const conversationAnalysis = {
        strengths: Array.isArray(parsed.conversationAnalysis?.strengths) ? parsed.conversationAnalysis.strengths : [],
        weaknesses: Array.isArray(parsed.conversationAnalysis?.weaknesses) ? parsed.conversationAnalysis.weaknesses : [],
        culturalMisses: Array.isArray(parsed.conversationAnalysis?.culturalMisses) ? parsed.conversationAnalysis.culturalMisses : [],
        goodCulturalMoments: Array.isArray(parsed.conversationAnalysis?.goodCulturalMoments) ? parsed.conversationAnalysis.goodCulturalMoments : [],
        conversationPacing: parsed.conversationAnalysis?.conversationPacing || 'appropriate',
        questioningTechnique: Array.isArray(parsed.conversationAnalysis?.questioningTechnique) ? parsed.conversationAnalysis.questioningTechnique : [],
        responseTiming: parsed.conversationAnalysis?.responseTiming || 'No analysis available'
      };

      const suggestions = {
        conversationFlow: Array.isArray(parsed.suggestions?.conversationFlow) ? parsed.suggestions.conversationFlow : [],
        culturalCompetency: Array.isArray(parsed.suggestions?.culturalCompetency) ? parsed.suggestions.culturalCompetency : [],
        therapeuticTechnique: Array.isArray(parsed.suggestions?.therapeuticTechnique) ? parsed.suggestions.therapeuticTechnique : [],
        specificMoments: Array.isArray(parsed.suggestions?.specificMoments) ? parsed.suggestions.specificMoments : [],
        positiveReinforcement: Array.isArray(parsed.suggestions?.positiveReinforcement) ? parsed.suggestions.positiveReinforcement : []
      };

      return { overallPerformance, conversationAnalysis, suggestions };
    } catch (error) {
      console.error('Failed to parse conversation analysis result:', error);
      console.error('Raw result:', result);
      
      // Return fallback analysis
      return this.getFallbackConversationAnalysis(context);
    }
  }

  // Validate individual scores
  private static validateScore(score: unknown): number {
    const num = parseFloat(score);
    if (isNaN(num) || num < 1 || num > 10) {
      console.warn('Invalid score detected, using fallback:', score);
      return 5; // Neutral fallback score
    }
    return Math.round(num * 10) / 10; // Round to 1 decimal place
  }

  // Determine if conversation should be flagged for human review
  private static shouldFlagConversationForReview(performance: ConversationFeedback['overallPerformance']): boolean {
    const criticalScores = [performance.culturalSensitivity, performance.empathy, performance.professionalBoundaries];
    return criticalScores.some(score => score < 5.5) || performance.overallScore < 5.5;
  }

  // Assess training data quality
  private static assessConversationTrainingDataQuality(
    performance: ConversationFeedback['overallPerformance'], 
    context: ConversationAnalysisContext
  ): 'high' | 'medium' | 'low' {
    const averageScore = Object.values(performance).reduce((sum, score) => sum + score, 0) / Object.values(performance).length;
    const hasCompleteContext = context.messages.length >= 6 && context.conversationSummary.counselorMessages >= 3;
    
    if (averageScore >= 7.0 && hasCompleteContext) {
      return 'high';
    } else if (averageScore >= 5.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Fallback analysis when parsing fails
  private static getFallbackConversationAnalysis(context: ConversationAnalysisContext): {
    overallPerformance: ConversationFeedback['overallPerformance'];
    conversationAnalysis: ConversationFeedback['conversationAnalysis'];
    suggestions: ConversationFeedback['suggestions'];
  } {
    return {
      overallPerformance: {
        conversationFlow: 5.0,
        culturalSensitivity: 5.0,
        therapeuticProgress: 5.0,
        professionalBoundaries: 7.0,
        empathy: 5.0,
        overallScore: 5.4
      },
      conversationAnalysis: {
        strengths: ['Conversation analysis parsing failed - manual review needed'],
        weaknesses: ['Unable to perform detailed analysis'],
        culturalMisses: ['Analysis unavailable due to parsing error'],
        goodCulturalMoments: ['Analysis unavailable'],
        conversationPacing: 'appropriate',
        questioningTechnique: ['Analysis failed - manual review recommended'],
        responseTiming: 'Analysis parsing failed - manual review needed'
      },
      suggestions: {
        conversationFlow: ['AI analysis failed - consult supervisor'],
        culturalCompetency: [`Consider specific factors for ${context.culturalBackground} background`],
        therapeuticTechnique: ['Consult therapeutic guidelines'],
        specificMoments: [],
        positiveReinforcement: []
      }
    };
  }

  // Quick test analysis for development
  static async quickConversationAnalysis(
    conversationId: string,
    counselorId: string,
    studentId: string,
    culturalBackground: CulturalBackground,
    messages: Array<{ content: string; senderType: 'student' | 'counselor' | 'ai' }>
  ): Promise<Omit<ConversationFeedback, 'id' | 'analyzedAt'>> {
    const context: ConversationAnalysisContext = {
      conversationId,
      studentId,
      counselorId,
      culturalBackground,
      messages: messages.map((msg, index) => ({
        id: `msg_${index + 1}`,
        content: msg.content,
        senderType: msg.senderType,
        timestamp: new Date(Date.now() - (messages.length - index) * 60 * 60 * 1000), // Simulate timestamps
        messageNumber: index + 1
      })),
      conversationSummary: {
        totalMessages: messages.length,
        studentMessages: messages.filter(m => m.senderType === 'student').length,
        counselorMessages: messages.filter(m => m.senderType === 'counselor').length,
        aiMessages: messages.filter(m => m.senderType === 'ai').length,
        conversationStarted: new Date(Date.now() - messages.length * 60 * 60 * 1000),
        conversationDuration: `${Math.floor(messages.length / 2)} hours`,
        mainTopics: ['Depression', 'Family relationships', 'Cultural conflict'],
        emotionalProgression: ['Distressed', 'Opening up', 'More hopeful'],
        urgencyLevel: 'medium',
        conversationOutcome: 'ongoing'
      }
    };

    return this.analyzeFullConversation(context);
  }
}