// Admin dashboard for platform-wide data export and analytics
import React, { useState, useEffect } from 'react';
import {
  Download,
  Users,
  MessageSquare,
  Database,
  Activity,
  TrendingUp,
  Globe,
  Target,
  RefreshCw,
  BookOpen,
  Lock,
  Share2,
  Languages
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminExportService, AdminExportFilters, PlatformStatistics } from '../../services/adminExportService';
import { SpanishProficiencyService, CounselorSpanishSummary } from '../../services/spanishProficiencyService';
import { CulturalBackground } from '../../types';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStatistics | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'platform' | 'training'>('platform');
  const [spanishScores, setSpanishScores] = useState<CounselorSpanishSummary[]>([]);
  
  // Filter states
  const [filters, setFilters] = useState<AdminExportFilters>({
    dateFrom: undefined,
    dateTo: undefined,
    conversationType: 'all',
    culturalBackground: 'all',
    includeAnonymous: true,
    minMessages: 1,
    maxResults: 1000,
    includeJournalData: true
  });

  useEffect(() => {
    loadPlatformStatistics();
    SpanishProficiencyService.getAllCounselorScores().then(setSpanishScores).catch(() => {});
  }, []);

  const loadPlatformStatistics = async () => {
    try {
      setIsLoadingStats(true);
      const platformStats = await AdminExportService.getPlatformStatistics();
      setStats(platformStats);
    } catch (error) {
      console.error('Failed to load platform statistics:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleExport = async () => {
    if (!user?.uid) return;

    try {
      setIsExporting(true);
      
      if (exportType === 'platform') {
        await AdminExportService.exportPlatformData(filters, user.uid);
      } else {
        await AdminExportService.exportForModelTraining(filters, user.uid);
      }
      
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const updateFilter = (key: keyof AdminExportFilters, value: string | Date | CulturalBackground | 'all' | number | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const culturalOptions: { value: CulturalBackground | 'all'; label: string }[] = [
    { value: 'all', label: 'All Cultures' },
    { value: 'african-american', label: 'African American' },
    { value: 'african', label: 'African' },
    { value: 'asian-american', label: 'Asian American' },
    { value: 'east-asian', label: 'East Asian' },
    { value: 'south-asian', label: 'South Asian' },
    { value: 'latino-hispanic', label: 'Latino/Hispanic' },
    { value: 'white-american', label: 'White American' },
    { value: 'middle-eastern', label: 'Middle Eastern' },
    { value: 'native-american', label: 'Native American' },
    { value: 'multiracial', label: 'Multiracial' },
    { value: 'other', label: 'Other' }
  ];

  if (!user || user.userType !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Admin Dashboard
              </h1>
              <p className="text-gray-600">
                Platform analytics and data export for model training
              </p>
            </div>
            <button
              onClick={loadPlatformStatistics}
              disabled={isLoadingStats}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoadingStats ? 'animate-spin' : ''} />
              <span>Refresh Stats</span>
            </button>
          </div>
        </div>

        {/* Platform Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Conversations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalConversations.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.aiConversations} AI • {stats.humanConversations} Human
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Messages</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMessages.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: {stats.averageMessagesPerConversation} per conversation
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Platform Users</p>
                  <p className="text-2xl font-bold text-gray-900">{(stats.totalStudents + stats.totalCounselors).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.totalStudents} Students • {stats.totalCounselors} Counselors
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Anonymous Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round((stats.anonymousConversations / stats.totalConversations) * 100)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.anonymousConversations} anonymous conversations
                  </p>
                </div>
                <Globe className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </div>
        )}

        {/* Journal Statistics Row */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Journal Entries</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.journalStatistics.totalJournalEntries.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: {stats.journalStatistics.averageEntriesPerStudent} per student
                  </p>
                </div>
                <BookOpen className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Mood</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.journalStatistics.averageMoodScore}/10</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Platform-wide mood score
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Private Entries</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.journalStatistics.privateEntries.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((stats.journalStatistics.privateEntries / stats.journalStatistics.totalJournalEntries) * 100)}% of total
                  </p>
                </div>
                <Lock className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Shared Entries</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.journalStatistics.sharedEntries.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Available to counselors
                  </p>
                </div>
                <Share2 className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>
        )}

        {/* Data Export Section */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Data Export</h2>
            <p className="text-gray-600">Export platform data for research and model training</p>
          </div>

          <div className="p-6">
            {/* Export Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Export Type</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    exportType === 'platform' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setExportType('platform')}
                >
                  <div className="flex items-center space-x-3">
                    <Database className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">Complete Platform Data</h3>
                      <p className="text-sm text-gray-600">
                        Full conversations with metadata, statistics, and analytics
                      </p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    exportType === 'training' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setExportType('training')}
                >
                  <div className="flex items-center space-x-3">
                    <Target className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">Model Training Data</h3>
                      <p className="text-sm text-gray-600">
                        Optimized CSV format for machine learning training
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Export Filters</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
                    onChange={(e) => updateFilter('dateFrom', e.target.value ? new Date(e.target.value) : '')}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
                    onChange={(e) => updateFilter('dateTo', e.target.value ? new Date(e.target.value) : '')}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Conversation Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Conversation Type</label>
                  <select
                    value={filters.conversationType}
                    onChange={(e) => updateFilter('conversationType', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="ai">AI Conversations</option>
                    <option value="human">Human Counselor</option>
                  </select>
                </div>

                {/* Cultural Background */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cultural Background</label>
                  <select
                    value={filters.culturalBackground}
                    onChange={(e) => updateFilter('culturalBackground', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {culturalOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Minimum Messages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Messages</label>
                  <input
                    type="number"
                    min="1"
                    value={filters.minMessages}
                    onChange={(e) => updateFilter('minMessages', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Max Results */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Results</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={filters.maxResults}
                    onChange={(e) => updateFilter('maxResults', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Include Anonymous Toggle */}
              <div className="mt-4 space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.includeAnonymous}
                    onChange={(e) => updateFilter('includeAnonymous', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Include anonymous conversations</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.includeJournalData}
                    onChange={(e) => updateFilter('includeJournalData', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Include journal entries data</span>
                </label>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Data will be anonymized for privacy protection
              </div>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Export {exportType === 'platform' ? 'Platform' : 'Training'} Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Platform Analytics */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cultural Distribution */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversations by Culture</h3>
              <div className="space-y-3">
                {stats.conversationsByCulture.slice(0, 6).map((item) => (
                  <div key={item.culture} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 capitalize">
                      {item.culture.replace('-', ' ')}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ 
                            width: `${(item.count / stats.conversationsByCulture[0].count) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Topics */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Topics</h3>
              <div className="space-y-3">
                {stats.popularTopics.slice(0, 6).map((item) => (
                  <div key={item.topic} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 capitalize">
                      {item.topic}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ 
                            width: `${(item.count / stats.popularTopics[0].count) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Spanish Proficiency Leaderboard */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center space-x-2 mb-4">
            <Languages className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Counselor Spanish Proficiency</h3>
          </div>
          {spanishScores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Languages className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No Spanish sessions analyzed yet.</p>
              <p className="text-xs text-gray-400 mt-1">Scores will appear here once counselors complete sessions with Latino/Hispanic students.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {spanishScores
                .sort((a, b) => b.averageScore - a.averageScore)
                .map((c, index) => (
                  <div key={c.counselorId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.counselorName || c.counselorId.slice(0, 8) + '...'}</p>
                        <p className="text-xs text-gray-500">{c.sessionCount} session{c.sessionCount !== 1 ? 's' : ''} analyzed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${c.averageScore >= 8 ? 'text-green-600' : c.averageScore >= 6 ? 'text-blue-600' : 'text-yellow-600'}`}>
                        {c.averageScore.toFixed(1)}<span className="text-xs text-gray-400">/10</span>
                      </div>
                      <p className="text-xs text-gray-500">avg score</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;