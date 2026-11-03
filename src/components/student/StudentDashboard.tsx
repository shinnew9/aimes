// Student dashboard with quick access to features
import React, { useState, useEffect } from 'react';
import { MessageCircle, BookOpen, Brain, Settings, LogOut, Sparkles, Menu, X, Lock, Globe, Users, Mail, Clock, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MessageService } from '../../services/messageService';
import { ConversationService } from '../../services/conversationService';
import { CulturalBackgroundModal } from '../shared/CulturalBackgroundModal';
import { Message, Response } from '../../types/Message';

// Placeholder components - we'll build these
const ChatInterface = React.lazy(() => import('./ChatInterface'));
const JournalingInterface = React.lazy(() => import('../journal/JournalingInterface'));
const MindfulnessLibrary = React.lazy(() => import('../mindfulness/MindfulnessLibrary'));

type StudentView = 'dashboard' | 'chat' | 'messages' | 'journal' | 'mindfulness' | 'settings';

// Message History Component
const MessageHistory: React.FC<{ onUnreadCountChange?: () => void }> = ({ onUnreadCountChange }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<{ message: Message; responses: Response[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'ai' | 'human'>('all');
  const [counts, setCounts] = useState({ all: 0, ai: 0, human: 0 });

  useEffect(() => {
    if (user?.uid) {
      loadConversations();
    }
  }, [user?.uid, activeTab]);

  const loadConversations = async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoading(true);
      const allConversations = await MessageService.getStudentConversationsByType(user.uid, activeTab);
      setConversations(allConversations);

      // Load counts for all tabs
      const [allCount, aiCount, humanCount] = await Promise.all([
        MessageService.getStudentConversationsByType(user.uid, 'all'),
        MessageService.getStudentConversationsByType(user.uid, 'ai'),
        MessageService.getStudentConversationsByType(user.uid, 'human')
      ]);

      setCounts({
        all: allCount.length,
        ai: aiCount.length,
        human: humanCount.length
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const markAsRead = async (responseId: string) => {
    try {
      await MessageService.markResponseAsRead(responseId);
      // Refresh conversations to update read status
      loadConversations();
      // Notify parent component to refresh unread count
      if (onUnreadCountChange) {
        onUnreadCountChange();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Message History</h2>
          <p className="text-gray-600">View your conversations with AI and human counselors</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'all', label: 'All Conversations', count: counts.all },
              { id: 'ai', label: 'AI Companion', count: counts.ai },
              { id: 'human', label: 'Human Counselors', count: counts.human }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'all' | 'ai' | 'human')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label} {tab.count > 0 && `(${tab.count})`}
              </button>
            ))}
          </nav>
        </div>

        {/* Conversation List */}
        <div className="p-6">
          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <Mail size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
              <p className="text-gray-600 mb-4">
                Start a conversation in the Mental Health Chat to see your message history here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {conversations.map((conversation) => (
                <div key={conversation.message.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Your Message */}
                  <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium text-sm">
                          {user?.profile?.firstName?.charAt(0) || 'Y'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">Your Message</span>
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(conversation.message.timestamp)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            conversation.message.responseType === 'ai' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {conversation.message.responseType === 'ai' ? 'AI Request' : 'Human Counselor'}
                          </span>
                        </div>
                        <p className="text-gray-800 text-sm">{conversation.message.content}</p>
                      </div>
                    </div>
                  </div>

                  {/* Responses */}
                  <div className="bg-white">
                    {conversation.responses.length === 0 ? (
                      <div className="p-4 text-center">
                        <Clock size={24} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          {conversation.message.responseType === 'ai' 
                            ? 'AI response pending...' 
                            : 'Waiting for counselor response...'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4">
                        {conversation.responses.map((response) => (
                          <div 
                            key={response.id} 
                            className={`flex items-start space-x-3 ${
                              !response.readByStudent ? 'bg-blue-50 border border-blue-200 rounded-lg p-3' : ''
                            }`}
                            onClick={() => {
                              if (!response.readByStudent) {
                                markAsRead(response.id);
                              }
                            }}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              response.responderType === 'ai' 
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                                : 'bg-gradient-to-r from-purple-500 to-pink-500'
                            }`}>
                              {response.responderType === 'ai' ? (
                                <span className="text-white text-xs font-bold">AI</span>
                              ) : (
                                <User size={16} className="text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {response.responderType === 'ai' ? 'AI Companion' : 'Human Counselor'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {getTimeAgo(response.timestamp)}
                                </span>
                                {!response.readByStudent && (
                                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-800 text-sm whitespace-pre-wrap">{response.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

const StudentDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<StudentView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  // Cultural background is only asked for once, at first sign-in, and the settings
  // view this button used to point at was never built — so there was no way to
  // change it. Reuse the existing modal in its change mode instead.
  const [showCulturalModal, setShowCulturalModal] = useState(false);

  // Load unread responses count
  useEffect(() => {
    if (user?.uid) {
      loadUnreadCount();
      loadChatUnreadCount();
      // Set up interval to check for new responses every 30 seconds
      const interval = setInterval(() => {
        loadUnreadCount();
        loadChatUnreadCount();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.uid]);

  const loadUnreadCount = async () => {
    if (!user?.uid) return;
    
    try {
      const unreadResponses = await MessageService.getUnreadResponses(user.uid);
      setUnreadCount(unreadResponses.length);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadChatUnreadCount = async () => {
    if (!user?.uid) return;
    
    try {
      const unreadChatCount = await ConversationService.getUnreadMessageCount(user.uid);
      setChatUnreadCount(unreadChatCount);
    } catch (error) {
      console.error('Failed to load chat unread count:', error);
    }
  };

  // Safety check - don't render if no user
  if (!user) {
    return <div>Loading...</div>;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const navigationItems = [
    {
      id: 'dashboard' as StudentView,
      label: 'Dashboard',
      icon: <Sparkles size={20} />,
      description: 'Overview and quick actions'
    },
    {
      id: 'chat' as StudentView,
      label: 'Mental Health Chat',
      icon: <MessageCircle size={20} />,
      description: 'AI companion and human counselors',
      badge: chatUnreadCount > 0 ? chatUnreadCount : undefined
    },
    {
      id: 'messages' as StudentView,
      label: 'Message History',
      icon: <Mail size={20} />,
      description: 'View AI and counselor conversations',
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    {
      id: 'journal' as StudentView,
      label: 'Personal Journal',
      icon: <BookOpen size={20} />,
      description: 'Private mood tracking and reflection'
    },
    {
      id: 'mindfulness' as StudentView,
      label: 'Mindfulness Library',
      icon: <Brain size={20} />,
      description: 'Cultural meditation and wellness videos'
    }
  ];

  const renderNavigation = () => (
    <nav className="space-y-2">
      {navigationItems.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            setCurrentView(item.id);
            setSidebarOpen(false);
            // If clicking on messages, refresh unread count
            if (item.id === 'messages') {
              loadUnreadCount();
            }
            // If clicking on chat, refresh chat unread count
            if (item.id === 'chat') {
              loadChatUnreadCount();
            }
          }}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors relative ${
            currentView === item.id
              ? 'bg-teal-100 text-teal-800 border border-teal-200'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <div className={`${
            currentView === item.id ? 'text-teal-600' : 'text-gray-400'
          }`}>
            {item.icon}
          </div>
          <div className="flex-1">
            <div className="font-medium flex items-center justify-between">
              <span>{item.label}</span>
              {'badge' in item && item.badge && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">{item.description}</div>
          </div>
        </button>
      ))}
    </nav>
  );

  const renderDashboardContent = () => (
    <div className="space-y-8">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.profile?.firstName}!
        </h1>
        <p className="text-teal-100 mb-4">
          Your mental health companion is here to support you with culturally-aware guidance.
        </p>
        <div className="flex flex-wrap gap-4">
          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <Lock size={14} />
            <span>Anonymous & Secure</span>
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <Globe size={14} />
            <span>Culturally Sensitive</span>
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <Users size={14} />
            <span>AI + Human Support</span>
          </span>
        </div>
      </div>

      {/* New Messages Notification */}
      {unreadCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 rounded-full p-2">
              <Mail size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                You have {unreadCount} new response{unreadCount > 1 ? 's' : ''}
              </h3>
              <p className="text-blue-800 text-sm mb-3">
                {unreadCount > 1 ? 'Counselors have' : 'A counselor has'} responded to your message{unreadCount > 1 ? 's' : ''}.
              </p>
              <button 
                onClick={() => setCurrentView('messages')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                View Messages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div 
          className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setCurrentView('chat')}
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="bg-gradient-to-br from-teal-600 to-blue-600 rounded-full p-3">
              <MessageCircle size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Start Chatting</h3>
              <p className="text-sm text-gray-600">AI or human counselor</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Get immediate support from our culturally-aware AI, or connect with a human counselor when you need deeper guidance.
          </p>
          <div className="flex items-center text-teal-600 text-sm font-medium">
            <span>Begin conversation</span>
            <span className="ml-2">→</span>
          </div>
        </div>

        <div 
          className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setCurrentView('journal')}
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-full p-3">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Daily Journal</h3>
              <p className="text-sm text-gray-600">Private reflection space</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Track your moods, reflect on your experiences, and share insights with counselors when you&apos;re ready.
          </p>
          <div className="flex items-center text-purple-600 text-sm font-medium">
            <span>Write entry</span>
            <span className="ml-2">→</span>
          </div>
        </div>

        <div 
          className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setCurrentView('mindfulness')}
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="bg-gradient-to-br from-green-600 to-teal-600 rounded-full p-3">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mindfulness</h3>
              <p className="text-sm text-gray-600">Cultural wellness practices</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Explore guided meditation, breathing exercises, and wellness practices adapted to your cultural background.
          </p>
          <div className="flex items-center text-green-600 text-sm font-medium">
            <span>Explore library</span>
            <span className="ml-2">→</span>
          </div>
        </div>
      </div>

      {/* Cultural Context Display */}
      {user?.studentProfile?.culturalBackground && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-900 mb-2">Your Cultural Context</h3>
          <p className="text-amber-800 text-sm mb-4">
            AIMES adapts its responses based on your cultural background: 
            <span className="font-medium ml-1">
              {user.studentProfile.culturalBackground.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </span>
          </p>
          <button 
            onClick={() => setShowCulturalModal(true)}
            className="text-amber-700 hover:text-amber-800 text-sm underline"
          >
            Update cultural background
          </button>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return renderDashboardContent();
      case 'chat':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>}>
            <ChatInterface onUnreadCountChange={loadChatUnreadCount} />
          </React.Suspense>
        );
      case 'messages':
        return <MessageHistory onUnreadCountChange={loadUnreadCount} />;
      case 'journal':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>}>
            <JournalingInterface />
          </React.Suspense>
        );
      case 'mindfulness':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>}>
            <MindfulnessLibrary />
          </React.Suspense>
        );
      case 'settings':
        return (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            <p className="text-gray-600">Settings panel coming soon...</p>
          </div>
        );
      default:
        return renderDashboardContent();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 transition-transform duration-300 ease-in-out
        fixed lg:relative z-30 lg:z-auto
        w-80 h-full bg-white shadow-lg border-r border-gray-200
      `}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-full p-2">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">CALLM-CARE</h1>
                <p className="text-sm text-gray-600">Student Portal</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1">
          {renderNavigation()}
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user?.profile?.firstName?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {user?.profile?.firstName} {user?.profile?.lastName}
              </p>
              <p className="text-sm text-gray-500">Student</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 w-full"
          >
            <LogOut size={16} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* Top Navigation */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Menu size={24} />
            </button>
            <h1 className="font-semibold text-gray-900">CALLM-CARE Student Portal</h1>
            <div className="w-6" /> {/* Spacer */}
          </div>
        </div>

        <div className="p-6">
          {renderContent()}
        </div>
      </div>

      <CulturalBackgroundModal
        isOpen={showCulturalModal}
        onClose={() => setShowCulturalModal(false)}
        onComplete={() => setShowCulturalModal(false)}
        isChanging={true}
      />
    </div>
  );
};

export default StudentDashboard;