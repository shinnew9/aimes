import OpenAI from 'openai';
import { ENV } from '../config/env';
import { modelFor, modelParams } from '../config/aiModels';
import {
  AIFeedback,
  FeedbackScores,
  CulturalAnalysis,
  ImprovementSuggestions,
  ResponseContext,
  CULTURAL_BACKGROUNDS_INFO,
  SCORE_THRESHOLDS
} from '../types/Feedback';
import { CulturalBackground } from '../types/User';

export class AIAnalysisService {
  private static openai = new OpenAI({
    apiKey: ENV.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Note: In production, move this to backend
  });

  // Main analysis function
  static async analyzeCounselorResponse(context: ResponseContext): Promise<Omit<AIFeedback, 'id' | 'messageId' | 'counselorId' | 'studentId' | 'analyzedAt'>> {
    try {
      console.log('Starting AI analysis for counselor response...');
      
      const prompt = this.buildAnalysisPrompt(context);
      console.log('Analysis prompt built for cultural background:', context.culturalBackground);

      const response = await this.openai.chat.completions.create({
        ...modelParams('ANALYSIS', { maxTokens: 4000, temperature: 0.3 }),
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
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

      console.log('Raw AI analysis result:', analysisResult);
      const parsedResult = this.parseAnalysisResult(analysisResult, context);
      
      console.log('AI analysis completed successfully');
      return {
        scores: parsedResult.scores,
        culturalAnalysis: parsedResult.culturalAnalysis,
        suggestions: parsedResult.suggestions,
        responseContext: context,
        aiModel: modelFor('ANALYSIS'),
        analysisVersion: '1.0',
        reviewedByCounselor: false,
        flaggedForReview: this.shouldFlagForReview(parsedResult.scores),
        trainingDataQuality: this.assessTrainingDataQuality(parsedResult.scores, context)
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Failed to analyze counselor response:', error);
      throw new Error('AI analysis failed: ' + errorMessage);
    }
  }

  // Build the analysis prompt
  private static buildAnalysisPrompt(context: ResponseContext): string {
    const culturalInfo = CULTURAL_BACKGROUNDS_INFO[context.culturalBackground];
    
    return `
CULTURAL COMPETENCY ANALYSIS REQUEST

STUDENT CONTEXT:
- Cultural Background: ${context.culturalBackground}
- Cultural Factors: ${culturalInfo?.commonFactors.join(', ') || 'General factors'}
- Cultural Sensitivities: ${culturalInfo?.sensitivities.join(', ') || 'General sensitivities'}
- Cultural Strengths: ${culturalInfo?.strengths.join(', ') || 'General strengths'}
- Age: ${context.studentAge || 'Not specified'}
- Session Number: ${context.sessionNumber || 'First interaction'}
- Urgency Level: ${context.urgencyLevel || 'Not specified'}

CONVERSATION CONTEXT:
${context.conversationHistory.length > 0 ? 
  'Previous Messages:\n' + context.conversationHistory.map((msg, i) => `${i + 1}. ${msg}`).join('\n') + '\n\n' : 
  'This is the first message in the conversation.\n\n'
}

STUDENT'S MESSAGE:
"${context.studentMessage}"

COUNSELOR'S RESPONSE TO ANALYZE:
"${context.counselorResponse}"

ANALYSIS INSTRUCTIONS:
Please analyze the counselor's response for cultural competency and therapeutic effectiveness. Consider:

1. CULTURAL SENSITIVITY: How well does the response respect and acknowledge the student's cultural background?
2. CULTURAL AWARENESS: Does the counselor demonstrate understanding of cultural factors that may be influencing the student?
3. EMPATHY: How well does the response show understanding and emotional connection?
4. PROFESSIONALISM: Are appropriate therapeutic boundaries maintained?
5. ACTIONABILITY: Does the response provide concrete, helpful guidance?
6. QUESTION QUALITY: Are the questions asked thoughtful and culturally appropriate?
7. LANGUAGE APPROPRIATENESS: Is the language used suitable for this cultural context?
8. RESPONSE LENGTH: Is the response appropriately detailed (not too brief or overwhelming)?

SPECIFIC CULTURAL CONSIDERATIONS FOR ${context.culturalBackground.toUpperCase()}:
- Common factors to consider: ${culturalInfo?.commonFactors.join(', ')}
- Cultural sensitivities to be aware of: ${culturalInfo?.sensitivities.join(', ')}
- Cultural strengths to acknowledge: ${culturalInfo?.strengths.join(', ')}

Please provide your analysis in the specified JSON format.
    `.trim();
  }

  // System prompt for consistent analysis
  private static getSystemPrompt(): string {
    return `
You are an expert cultural competency trainer and supervisor for mental health counselors. Your role is to analyze counselor responses to students from diverse cultural backgrounds and provide constructive feedback.

SCORING GUIDELINES:
- 9-10: Excellent - Demonstrates exceptional cultural competency and therapeutic skill
- 7-8: Good - Shows solid understanding with minor areas for improvement
- 5-6: Needs Improvement - Adequate but missing key cultural considerations
- 3-4: Poor - Significant cultural missteps or therapeutic concerns
- 1-2: Very Poor - Potentially harmful or highly inappropriate

ANALYSIS REQUIREMENTS:
1. Be specific and constructive in feedback
2. Highlight cultural strengths and missed opportunities
3. Provide actionable improvement suggestions
4. Consider the cultural background's specific factors
5. Assess potential biases or assumptions
6. Suggest culturally appropriate questions or approaches

OUTPUT FORMAT:
Respond with a JSON object containing:
{
  "scores": {
    "culturalSensitivity": number,
    "culturalAwareness": number,
    "empathy": number,
    "professionalism": number,
    "actionability": number,
    "questionQuality": number,
    "languageAppropriate": number,
    "responseLength": number,
    "overall": number
  },
  "culturalAnalysis": {
    "assumptions": ["list of cultural assumptions detected"],
    "biases": ["list of potential biases identified"],
    "strengths": ["list of cultural competency strengths"],
    "culturalMisses": ["list of missed cultural opportunities"],
    "appropriateReferences": ["list of good cultural references made"]
  },
  "suggestions": {
    "strengths": ["what the counselor did well"],
    "improvements": ["specific areas for improvement"],
    "culturalTips": ["cultural context tips for this background"],
    "alternativeApproaches": ["different ways to approach the response"],
    "questionsToAsk": ["better questions for cultural context"]
  }
}

Be thorough, fair, and focused on helping counselors improve their cultural competency while maintaining therapeutic effectiveness.
    `.trim();
  }

  // Parse the AI analysis result
  private static parseAnalysisResult(result: string, context: ResponseContext): {
    scores: FeedbackScores;
    culturalAnalysis: CulturalAnalysis;
    suggestions: ImprovementSuggestions;
  } {
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in analysis result');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and structure the response
      const scores: FeedbackScores = {
        culturalSensitivity: this.validateScore(parsed.scores?.culturalSensitivity),
        culturalAwareness: this.validateScore(parsed.scores?.culturalAwareness),
        empathy: this.validateScore(parsed.scores?.empathy),
        professionalism: this.validateScore(parsed.scores?.professionalism),
        actionability: this.validateScore(parsed.scores?.actionability),
        questionQuality: this.validateScore(parsed.scores?.questionQuality),
        languageAppropriate: this.validateScore(parsed.scores?.languageAppropriate),
        responseLength: this.validateScore(parsed.scores?.responseLength),
        overall: this.validateScore(parsed.scores?.overall)
      };

      const culturalAnalysis: CulturalAnalysis = {
        assumptions: Array.isArray(parsed.culturalAnalysis?.assumptions) ? parsed.culturalAnalysis.assumptions : [],
        biases: Array.isArray(parsed.culturalAnalysis?.biases) ? parsed.culturalAnalysis.biases : [],
        strengths: Array.isArray(parsed.culturalAnalysis?.strengths) ? parsed.culturalAnalysis.strengths : [],
        culturalMisses: Array.isArray(parsed.culturalAnalysis?.culturalMisses) ? parsed.culturalAnalysis.culturalMisses : [],
        appropriateReferences: Array.isArray(parsed.culturalAnalysis?.appropriateReferences) ? parsed.culturalAnalysis.appropriateReferences : []
      };

      const suggestions: ImprovementSuggestions = {
        strengths: Array.isArray(parsed.suggestions?.strengths) ? parsed.suggestions.strengths : [],
        improvements: Array.isArray(parsed.suggestions?.improvements) ? parsed.suggestions.improvements : [],
        culturalTips: Array.isArray(parsed.suggestions?.culturalTips) ? parsed.suggestions.culturalTips : [],
        alternativeApproaches: Array.isArray(parsed.suggestions?.alternativeApproaches) ? parsed.suggestions.alternativeApproaches : [],
        questionsToAsk: Array.isArray(parsed.suggestions?.questionsToAsk) ? parsed.suggestions.questionsToAsk : []
      };

      return { scores, culturalAnalysis, suggestions };
    } catch (error) {
      console.error('Failed to parse analysis result:', error);
      console.error('Raw result:', result);
      
      // Return fallback analysis
      return this.getFallbackAnalysis(context);
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

  // Determine if feedback should be flagged for human review
  private static shouldFlagForReview(scores: FeedbackScores): boolean {
    const criticalScores = [scores.culturalSensitivity, scores.empathy, scores.professionalism];
    return criticalScores.some(score => score < SCORE_THRESHOLDS.NEEDS_IMPROVEMENT);
  }

  // Assess training data quality
  private static assessTrainingDataQuality(scores: FeedbackScores, context: ResponseContext): 'high' | 'medium' | 'low' {
    const averageScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length;
    const hasCompleteContext = context.conversationHistory.length > 0 && context.culturalBackground && context.studentMessage.length > 20;
    
    if (averageScore >= SCORE_THRESHOLDS.GOOD && hasCompleteContext) {
      return 'high';
    } else if (averageScore >= SCORE_THRESHOLDS.NEEDS_IMPROVEMENT) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Fallback analysis when parsing fails
  private static getFallbackAnalysis(context: ResponseContext): {
    scores: FeedbackScores;
    culturalAnalysis: CulturalAnalysis;
    suggestions: ImprovementSuggestions;
  } {
    return {
      scores: {
        culturalSensitivity: 5.0,
        culturalAwareness: 5.0,
        empathy: 5.0,
        professionalism: 7.0,
        actionability: 5.0,
        questionQuality: 5.0,
        languageAppropriate: 6.0,
        responseLength: 6.0,
        overall: 5.5
      },
      culturalAnalysis: {
        assumptions: ['Analysis parsing failed - manual review needed'],
        biases: [],
        strengths: ['Response provided'],
        culturalMisses: ['Detailed analysis unavailable'],
        appropriateReferences: []
      },
      suggestions: {
        strengths: ['Responded to student message'],
        improvements: ['AI analysis failed - manual review recommended'],
        culturalTips: [`Consider specific factors for ${context.culturalBackground} background`],
        alternativeApproaches: ['Consult cultural competency guidelines'],
        questionsToAsk: ['Questions about cultural context and family dynamics']
      }
    };
  }

  // Quick analysis for testing/demo purposes
  static async quickAnalysis(
    studentMessage: string,
    counselorResponse: string,
    culturalBackground: CulturalBackground
  ): Promise<Omit<AIFeedback, 'id' | 'messageId' | 'counselorId' | 'studentId' | 'analyzedAt'>> {
    const context: ResponseContext = {
      studentMessage,
      counselorResponse,
      culturalBackground,
      conversationHistory: [],
      urgencyLevel: 'medium'
    };

    return this.analyzeCounselorResponse(context);
  }
}