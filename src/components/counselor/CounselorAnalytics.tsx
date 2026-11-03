import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SpanishProficiencyService, CounselorSpanishSummary } from '../../services/spanishProficiencyService';
import { Languages } from 'lucide-react';

interface PerformanceMetrics {
  overallScore: number;
  scoreChange: number;
  totalResponses: number;
  responseChange: number;
  averageResponseTime: number;
  timeChange: number;
  flaggedResponses: number;
  flaggedChange: number;
}

interface ScoreBreakdown {
  culturalSensitivity: number;
  culturalAwareness: number;
  empathy: number;
  professionalism: number;
  actionability: number;
  questionQuality: number;
  languageAppropriate: number;
  responseLength: number;
}

interface TrendData {
  date: string;
  score: number;
  responses: number;
}

interface AnalyticsData {
  metrics: PerformanceMetrics;
  scoreBreakdown: ScoreBreakdown;
  trends: TrendData[];
  strengths: string[];
  improvementAreas: string[];
  achievements: Array<{
    title: string;
    description: string;
    icon: React.ReactNode;
    date: string;
  }>;
  culturalCompetency: {
    [key: string]: {
      score: number;
      responses: number;
      trend: 'up' | 'down' | 'stable';
    };
  };
}

interface CounselorAnalyticsProps {
  showDemoData?: boolean;
}

const CounselorAnalytics: React.FC<CounselorAnalyticsProps> = ({ showDemoData = true }) => {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [spanishSummary, setSpanishSummary] = useState<CounselorSpanishSummary | null>(null);

  const getMockAnalytics = useCallback((): AnalyticsData => {
    const baseScore = 7.5 + Math.random() * 1.5; // 7.5-9.0 range
    
    return {
      metrics: {
        overallScore: Math.round(baseScore * 10) / 10,
        scoreChange: Math.round((Math.random() - 0.5) * 1.0 * 10) / 10,
        totalResponses: Math.floor(20 + Math.random() * 40),
        responseChange: Math.floor((Math.random() - 0.3) * 10),
        averageResponseTime: Math.floor(15 + Math.random() * 20),
        timeChange: Math.floor((Math.random() - 0.5) * 10),
        flaggedResponses: Math.floor(Math.random() * 3),
        flaggedChange: Math.floor((Math.random() - 0.7) * 3)
      },
      scoreBreakdown: {
        culturalSensitivity: Math.round((baseScore + (Math.random() - 0.5) * 1.0) * 10) / 10,
        culturalAwareness: Math.round((baseScore + (Math.random() - 0.5) * 1.0) * 10) / 10,
        empathy: Math.round((baseScore + (Math.random() - 0.5) * 1.0) * 10) / 10,
        professionalism: Math.round((baseScore + (Math.random() - 0.5) * 0.5) * 10) / 10,
        actionability: Math.round((baseScore + (Math.random() - 0.5) * 1.0) * 10) / 10,
        questionQuality: Math.round((baseScore + (Math.random() - 0.5) * 1.0) * 10) / 10,
        languageAppropriate: Math.round((baseScore + (Math.random() - 0.5) * 0.5) * 10) / 10,
        responseLength: Math.round((baseScore + (Math.random() - 0.5) * 1.0) * 10) / 10
      },
      trends: Array.from({ length: timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toISOString().split('T')[0],
          score: Math.round((baseScore + (Math.random() - 0.5) * 2.0) * 10) / 10,
          responses: Math.floor(Math.random() * 5) + 1
        };
      }).reverse(),
      strengths: [
        'Excellent cultural sensitivity in responses',
        'Strong empathetic listening skills',
        'Professional communication style',
        'Effective use of open-ended questions'
      ],
      improvementAreas: [
        'Consider more actionable advice in responses',
        'Explore cultural context more deeply',
        'Reduce response time for urgent cases'
      ],
      achievements: [
        {
          title: 'Cultural Sensitivity Expert',
          description: 'Achieved 90%+ cultural sensitivity scores for 2 weeks',
          icon: <Globe className="h-5 w-5" />,
          date: '2024-01-15'
        },
        {
          title: 'Response Champion',
          description: 'Completed 50+ student responses this month',
          icon: <MessageSquare className="h-5 w-5" />,
          date: '2024-01-10'
        },
        {
          title: 'Quality Improvement',
          description: 'Improved overall score by 1.2 points this quarter',
          icon: <TrendingUp className="h-5 w-5" />,
          date: '2024-01-05'
        }
      ],
      culturalCompetency: {
        'African American': { score: 8.2, responses: 12, trend: 'up' },
        'Latino/Hispanic': { score: 7.8, responses: 8, trend: 'stable' },
        'Asian American': { score: 8.5, responses: 15, trend: 'up' },
        'Middle Eastern': { score: 7.5, responses: 6, trend: 'down' },
        'European': { score: 8.0, responses: 10, trend: 'stable' },
        'Native American': { score: 7.2, responses: 3, trend: 'up' }
      }
    };
  }, [timeframe]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from the feedback service
      // For now, using mock data that represents realistic analytics
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setAnalytics(getMockAnalytics());
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [getMockAnalytics]);

  useEffect(() => {
    loadAnalytics();
    if (user?.uid) {
      SpanishProficiencyService.getCounselorSummary(user.uid).then(setSpanishSummary).catch(() => {});
    }
  }, [loadAnalytics, user?.uid]);

  const getScoreColor = (score: number): string => {
    if (score >= 8.5) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 7.0) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 5.5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-32"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-96"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Available</h3>
        <p className="text-gray-600">Complete some responses to see your performance analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
          <p className="text-gray-600">Track your counseling performance and cultural competency</p>
          {showDemoData && (
            <div className="mt-2 flex items-center space-x-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                ⚠️ Demo Analytics - Generate real feedback to see actual performance data
              </span>
            </div>
          )}
        </div>
        
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as '7d' | '30d' | '90d')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Score</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.metrics.overallScore}/10</p>
            </div>
            <div className={`flex items-center space-x-1 ${getChangeColor(analytics.metrics.scoreChange)}`}>
              {getChangeIcon(analytics.metrics.scoreChange)}
              <span className="text-sm font-medium">
                {analytics.metrics.scoreChange > 0 ? '+' : ''}{analytics.metrics.scoreChange}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(analytics.metrics.overallScore / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.metrics.totalResponses}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getChangeColor(analytics.metrics.responseChange)}`}>
              {getChangeIcon(analytics.metrics.responseChange)}
              <span className="text-sm font-medium">
                {analytics.metrics.responseChange > 0 ? '+' : ''}{analytics.metrics.responseChange}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <MessageSquare className="h-4 w-4 mr-1" />
            <span>This {timeframe === '7d' ? 'week' : timeframe === '30d' ? 'month' : 'quarter'}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.metrics.averageResponseTime}m</p>
            </div>
            <div className={`flex items-center space-x-1 ${getChangeColor(-analytics.metrics.timeChange)}`}>
              {getChangeIcon(-analytics.metrics.timeChange)}
              <span className="text-sm font-medium">
                {analytics.metrics.timeChange > 0 ? '+' : ''}{analytics.metrics.timeChange}m
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-1" />
            <span>Per response</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Flagged Responses</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.metrics.flaggedResponses}</p>
            </div>
            <div className={`flex items-center space-x-1 ${getChangeColor(-analytics.metrics.flaggedChange)}`}>
              {getChangeIcon(-analytics.metrics.flaggedChange)}
              <span className="text-sm font-medium">
                {analytics.metrics.flaggedChange > 0 ? '+' : ''}{analytics.metrics.flaggedChange}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <AlertTriangle className="h-4 w-4 mr-1" />
            <span>Needs review</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown and Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Breakdown */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(analytics.scoreBreakdown).map(([category, score]) => {
              const displayName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{displayName}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          score >= 8.5 ? 'bg-green-500' :
                          score >= 7.0 ? 'bg-blue-500' :
                          score >= 5.5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8">{score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h3>
          <div className="space-y-4">
            {analytics.achievements.map((achievement, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  {achievement.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{achievement.title}</p>
                  <p className="text-xs text-gray-600">{achievement.description}</p>
                  <p className="text-xs text-blue-600 mt-1">{new Date(achievement.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cultural Competency Analysis */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cultural Competency by Background</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(analytics.culturalCompetency).map(([culture, data]) => (
            <div key={culture} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{culture}</h4>
                {getTrendIcon(data.trend)}
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm px-2 py-1 rounded-full border ${getScoreColor(data.score)}`}>
                  {data.score.toFixed(1)}/10
                </span>
                <span className="text-xs text-gray-600">{data.responses} responses</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    data.score >= 8.5 ? 'bg-green-500' :
                    data.score >= 7.0 ? 'bg-blue-500' :
                    data.score >= 5.5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(data.score / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spanish Proficiency */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex items-center space-x-2 mb-4">
          <Languages className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Spanish Proficiency</h3>
        </div>
        {spanishSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className={`text-3xl font-bold mb-1 ${getScoreColor(spanishSummary.averageScore).split(' ')[0]}`}>
                {spanishSummary.averageScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Average Score / 10</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-gray-800 mb-1">{spanishSummary.sessionCount}</div>
              <div className="text-xs text-gray-600">Spanish Sessions Analyzed</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className={`text-3xl font-bold mb-1 ${getScoreColor(spanishSummary.latestScore).split(' ')[0]}`}>
                {spanishSummary.latestScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Latest Session Score</div>
            </div>
            <div className="md:col-span-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <p className="text-sm text-indigo-800"><span className="font-medium">Latest feedback:</span> {spanishSummary.latestFeedback}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Languages className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No Spanish sessions analyzed yet.</p>
            <p className="text-xs text-gray-400 mt-1">Complete a session with a Latino/Hispanic student to get your Spanish proficiency score.</p>
          </div>
        )}
      </div>

      {/* Strengths and Improvement Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Your Strengths</h3>
          </div>
          <ul className="space-y-2">
            {analytics.strengths.map((strength, index) => (
              <li key={index} className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Areas for Growth</h3>
          </div>
          <ul className="space-y-2">
            {analytics.improvementAreas.map((area, index) => (
              <li key={index} className="flex items-start space-x-2">
                <Target className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CounselorAnalytics;