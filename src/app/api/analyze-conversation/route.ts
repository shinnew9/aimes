// API route for conversation analysis
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { modelParams } from '@/config/aiModels';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  let analysisText: string | null = null;
  
  try {
    const { conversationText, culturalBackground } = await request.json();

    if (!conversationText) {
      return NextResponse.json(
        { error: 'Conversation text is required' },
        { status: 400 }
      );
    }

    const analysisPrompt = `
You are an expert mental health supervisor analyzing a complete counseling conversation. Provide a comprehensive analysis of the conversation's effectiveness and student outcomes.

CULTURAL CONTEXT: ${culturalBackground || 'Not specified'}

CONVERSATION TO ANALYZE:
${conversationText}

Please provide a detailed JSON analysis with the following structure:

{
  "overallEffectiveness": <1-10 score>,
  "studentSatisfactionEstimate": <1-10 score>,
  "culturalSensitivityScore": <1-10 score>,
  
  "emotionalProgression": [
    {
      "timepoint": <0-100 percentage through conversation>,
      "emotionalState": {
        "distress": <1-10>,
        "hope": <1-10>,
        "engagement": <1-10>,
        "trust": <1-10>,
        "empowerment": <1-10>
      },
      "keyIndicators": ["observable behaviors/language"],
      "significantQuotes": ["important student quotes"]
    }
  ],
  
  "startingState": {
    "primaryConcerns": ["main issues presented"],
    "emotionalIntensity": <1-10>,
    "culturalFactors": ["relevant cultural considerations"]
  },
  
  "endingState": {
    "resolutionLevel": <1-10>,
    "empowermentLevel": <1-10>,
    "likelyToReturn": <boolean>,
    "actionItemsIdentified": ["concrete next steps discussed"]
  },
  
  "counselorPerformance": {
    "empathyConsistency": <1-10>,
    "culturalAdaptation": <1-10>,
    "activeListening": <1-10>,
    "questionQuality": <1-10>,
    "appropriateBoundaries": <1-10>,
    "solutionOrientation": <1-10>
  },
  
  "whatWorkedWell": ["specific successful interventions"],
  "areasForImprovement": ["specific improvement suggestions"],
  "culturalConsiderations": ["cultural factors that influenced the conversation"],
  "recommendedFollowUp": ["suggested next steps"],
  
  "conversationPhases": {
    "buildingRapport": {"duration": <percentage>, "effectiveness": <1-10>},
    "problemExploration": {"duration": <percentage>, "effectiveness": <1-10>},
    "interventionDelivery": {"duration": <percentage>, "effectiveness": <1-10>},
    "resolutionPlanning": {"duration": <percentage>, "effectiveness": <1-10>}
  },
  
  "concerns": {
    "missedOpportunities": ["what could have been explored further"],
    "potentialMisunderstandings": ["possible communication gaps"],
    "culturalInsensitivities": ["any cultural missteps"],
    "riskFactors": ["any concerning elements"]
  }
}

Focus especially on:
1. How the student's emotional state changed throughout the conversation
2. Whether cultural factors were appropriately addressed
3. The quality of the counselor's responses and interventions
4. Whether the student seemed satisfied and empowered at the end
5. Concrete areas for counselor improvement

Provide specific, actionable feedback based on the actual conversation content.
`;

    const response = await openai.chat.completions.create({
      ...modelParams('ANALYSIS', { maxTokens: 4000, temperature: 0.3 }),
      messages: [
        {
          role: "system",
          content: "You are an expert mental health supervisor providing comprehensive conversation analysis. Always respond with valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ]
    });

    analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    // Clean the response text (remove markdown code blocks if present)
    let cleanedText = analysisText.trim();
    
    // Remove markdown code blocks
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Additional cleanup - remove any trailing text after the JSON
    if (cleanedText.includes('```')) {
      cleanedText = cleanedText.split('```')[0];
    }
    
    cleanedText = cleanedText.trim();
    
    // Parse the JSON response
    const analysis = JSON.parse(cleanedText);
    
    return NextResponse.json({ success: true, analysis });

  } catch (error: unknown) {
    console.error('API analysis failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : '';
    
    if (errorName === 'SyntaxError' && errorMessage?.includes('JSON')) {
      console.error('Raw response that failed to parse:', analysisText?.substring(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse analysis response', details: errorMessage },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze conversation: ' + errorMessage },
      { status: 500 }
    );
  }
}