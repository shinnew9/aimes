// Continuous chat interface for real-time conversations
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  MessageCircle,
  User,
  Bot,
  CheckCircle,
  Circle,
  MoreVertical,
  X,
  ArrowLeft,
  Download,
  FileText,
  BarChart3,
  Brain,
  Languages,
  Volume2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConversationService } from '../../services/conversationService';
import { AuthService } from '../../services/authService';
import { ExportService } from '../../services/exportService';
import { ConversationOutcomeService, ConversationOutcome } from '../../services/conversationOutcomeService';
import { SpanishProficiencyService } from '../../services/spanishProficiencyService';
import { Conversation, ConversationMessage } from '../../types';
import FeedbackInterface from '../counselor/FeedbackInterface';

interface ContinuousChatProps {
  conversation: Conversation;
  onBack: () => void;
  onUnreadCountChange?: () => void;
}

const ContinuousChat: React.FC<ContinuousChatProps> = ({ conversation, onBack, onUnreadCountChange }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportStats, setShowExportStats] = useState(false);
  const [exportStats, setExportStats] = useState<{
    messageCount: number;
    studentMessages: number;
    counselorMessages: number;
    aiMessages: number;
    totalCharacters: number;
    averageMessageLength: number;
    conversationDuration: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<ConversationMessage | null>(null);
  const [feedbackStudentMessage, setFeedbackStudentMessage] = useState<ConversationMessage | null>(null);
  const [showEndConversationModal, setShowEndConversationModal] = useState(false);
  const [isEndingConversation, setIsEndingConversation] = useState(false);
  const [showOutcomeAnalysis, setShowOutcomeAnalysis] = useState(false);
  const [conversationOutcome, setConversationOutcome] = useState<ConversationOutcome | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Translation and audio state for bilingual mediation
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showingTranslation, setShowingTranslation] = useState<Record<string, boolean>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  // Spanish marks gender on words referring to people, so translations need to know
  // the student's. Never rendered on its own — it only shapes grammatical agreement.
  const [studentGender, setStudentGender] = useState<'male' | 'female' | 'non-binary' | undefined>(undefined);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const conversationMessages = await ConversationService.getConversationMessages(conversation.id);
      setMessages(conversationMessages);
      
      // Mark as read
      if (user?.uid) {
        await ConversationService.markMessagesAsRead(conversation.id, user.uid);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversation.id, user?.uid]);

  useEffect(() => {
    loadMessages();
    
    // Set up real-time listener
    const unsubscribe = ConversationService.subscribeToConversationMessages(
      conversation.id,
      (updatedMessages) => {
        setMessages(updatedMessages);
        scrollToBottom();
        
        // Mark messages as read
        if (user?.uid) {
          ConversationService.markMessagesAsRead(conversation.id, user.uid);
          // Notify parent to refresh unread count
          if (onUnreadCountChange) {
            onUnreadCountChange();
          }
        }
      }
    );

    return () => {
      unsubscribe();
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [conversation.id, user?.uid, loadMessages, onUnreadCountChange]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.uid || isSending) return;

    try {
      setIsSending(true);
      
      // Determine sender type based on user type
      const senderType = user.userType === 'counselor' ? 'counselor' : 'student';
      
      await ConversationService.sendMessage(
        conversation.id,
        user.uid,
        senderType,
        newMessage.trim()
      );
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExportJSON = async () => {
    if (!user?.uid || user.userType !== 'counselor') return;
    
    try {
      setIsExporting(true);
      await ExportService.exportConversationAsJSON(conversation.id, user.uid);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Failed to export as JSON:', error);
      alert('Failed to export conversation. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!user?.uid || user.userType !== 'counselor') return;
    
    try {
      setIsExporting(true);
      await ExportService.exportConversationAsCSV(conversation.id, user.uid);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Failed to export as CSV:', error);
      alert('Failed to export conversation. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadExportStats = async () => {
    try {
      const stats = await ExportService.getExportStatistics(conversation.id);
      setExportStats(stats);
      setShowExportStats(true);
    } catch (error) {
      console.error('Failed to load export stats:', error);
      alert('Failed to load conversation statistics.');
    }
  };

  const handleEndConversation = async () => {
    if (!user?.uid || user.userType !== 'counselor') return;

    try {
      setIsEndingConversation(true);

      // Run comprehensive conversation analysis
      const outcome = await ConversationOutcomeService.analyzeCompleteConversation(
        conversation,
        messages
      );

      // If this was a Latino/Hispanic session, analyze Spanish proficiency
      if (conversation.culturalContext === 'latino-hispanic') {
        SpanishProficiencyService.analyzeSession(
          user.uid,
          conversation.id,
          messages.map(m => ({ content: m.content, senderType: m.senderType }))
        ).catch(err => console.error('Spanish proficiency analysis failed silently:', err));
      }

      setConversationOutcome(outcome);
      setShowEndConversationModal(false);
      setShowOutcomeAnalysis(true);

    } catch (error) {
      console.error('Failed to end conversation:', error);
      alert('Failed to analyze conversation. Please try again.');
    } finally {
      setIsEndingConversation(false);
    }
  };

  const getTimeDisplay = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return timestamp.toLocaleDateString();
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Bilingual mediation: Detect language of message (simple heuristic)
  const detectLanguage = (text: string): 'en' | 'es' => {
    // Simple Spanish detection: check for common Spanish words/patterns
    const spanishPattern = /\b(el|la|los|las|un|una|de|que|en|por|para|con|mi|tu|su|soy|eres|está|están|¿|¡)\b/i;
    return spanishPattern.test(text) ? 'es' : 'en';
  };

  // Load the student's gender so Spanish translations agree with it. Absent this
  // the translator has no one to agree with and falls back to masculine forms.
  useEffect(() => {
    let cancelled = false;

    const loadStudentGender = async () => {
      const student = await AuthService.getCurrentUserData(conversation.studentId);
      if (cancelled) return;

      const gender = student?.studentProfile?.gender;
      // 'prefer-not-to-say' carries no grammatical information, so it stays unset
      // and the translator is simply told nothing.
      if (gender === 'male' || gender === 'female' || gender === 'non-binary') {
        setStudentGender(gender);
      }
    };

    void loadStudentGender();

    return () => { cancelled = true; };
  }, [conversation.studentId]);

  // Handle translation toggle
  const handleTranslateToggle = async (message: ConversationMessage, currentLang: 'en' | 'es') => {
    const messageId = message.id;
    // If already showing translation, just toggle it off
    if (showingTranslation[messageId]) {
      setShowingTranslation(prev => ({ ...prev, [messageId]: false }));
      return;
    }

    // If we already have the translation, just show it
    if (translations[messageId]) {
      setShowingTranslation(prev => ({ ...prev, [messageId]: true }));
      return;
    }

    // Otherwise, fetch the translation
    try {
      setTranslating(prev => ({ ...prev, [messageId]: true }));

      const targetLang = currentLang === 'en' ? 'es' : 'en';

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: message.content,
          sourceLanguage: currentLang,
          targetLanguage: targetLang,
          // The student is the speaker in their own messages and the person being
          // addressed in everyone else's. The counselor's gender is not recorded on
          // their profile, so their side is left unspecified rather than guessed.
          speakerGender: message.senderType === 'student' ? studentGender : undefined,
          addresseeGender: message.senderType === 'student' ? undefined : studentGender
        })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();

      if (data.success) {
        setTranslations(prev => ({ ...prev, [messageId]: data.translation }));
        setShowingTranslation(prev => ({ ...prev, [messageId]: true }));
      } else {
        throw new Error(data.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      alert('Failed to translate message. Please try again.');
    } finally {
      setTranslating(prev => ({ ...prev, [messageId]: false }));
    }
  };

  // Handle text-to-speech playback for accessibility
  const handlePlayAudio = async (messageId: string, text: string, language: 'en' | 'es') => {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setPlayingAudio(messageId);

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, language })
      });

      if (!response.ok) {
        throw new Error('Audio generation failed');
      }

      // Create audio from the response blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        alert('Failed to play audio. Please try again.');
      };

      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setPlayingAudio(null);
      alert('Failed to generate audio. Please try again.');
    }
  };

  const renderMessage = (message: ConversationMessage) => {
    const isCurrentUser = message.senderId === user?.uid;
    const isRead = user?.uid ? message.readBy.includes(user.uid) : false;

    return (
      <div
        key={message.id}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`flex items-start space-x-2 max-w-[80%] ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          {/* Avatar */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isCurrentUser 
              ? 'bg-gradient-to-r from-teal-500 to-blue-500' 
              : message.senderType === 'ai'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                : message.senderType === 'counselor'
                  ? 'bg-gradient-to-r from-green-500 to-teal-500'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
          }`}>
            {isCurrentUser ? (
              <span className="text-white font-medium text-sm">
                {user?.profile?.firstName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            ) : message.senderType === 'ai' ? (
              <Bot size={16} className="text-white" />
            ) : (
              <User size={16} className="text-white" />
            )}
          </div>

          {/* Message bubble */}
          <div className={`relative ${isCurrentUser ? 'text-right' : 'text-left'}`}>
            <div className={`rounded-2xl px-4 py-2 ${
              isCurrentUser
                ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            
            {/* Timestamp and read status */}
            <div className={`flex items-center mt-1 text-xs text-gray-500 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <span>{getTimeDisplay(message.timestamp)}</span>
              {isCurrentUser && (
                <div className="ml-1">
                  {isRead ? (
                    <CheckCircle size={12} className="text-teal-500" />
                  ) : (
                    <Circle size={12} className="text-gray-400" />
                  )}
                </div>
              )}
            </div>

            {/* Bilingual mediation & accessibility controls */}
            {(() => {
              const messageLang = detectLanguage(message.content);
              const displayedText = showingTranslation[message.id] ? translations[message.id] : message.content;
              const displayedLang = showingTranslation[message.id] ? (messageLang === 'en' ? 'es' : 'en') : messageLang;

              return (
                <div className={`mt-2 flex flex-wrap items-center gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  {/* Translation toggle */}
                  <button
                    onClick={() => handleTranslateToggle(message, messageLang)}
                    disabled={translating[message.id]}
                    className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                    title={showingTranslation[message.id] ? "Show original" : `Translate to ${messageLang === 'en' ? 'Spanish' : 'English'}`}
                  >
                    <Languages size={12} />
                    <span>
                      {translating[message.id]
                        ? 'Translating...'
                        : showingTranslation[message.id]
                        ? 'Show original'
                        : `Show ${messageLang === 'en' ? 'Spanish' : 'English'}`}
                    </span>
                  </button>

                  {/* Audio read-aloud (accessibility) */}
                  <button
                    onClick={() => handlePlayAudio(message.id + (showingTranslation[message.id] ? '-translation' : ''), displayedText, displayedLang)}
                    disabled={playingAudio === (message.id + (showingTranslation[message.id] ? '-translation' : ''))}
                    className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Read aloud (accessibility)"
                  >
                    <Volume2 size={12} className={playingAudio === (message.id + (showingTranslation[message.id] ? '-translation' : '')) ? 'animate-pulse' : ''} />
                    <span>
                      {playingAudio === (message.id + (showingTranslation[message.id] ? '-translation' : ''))
                        ? 'Playing...'
                        : 'Listen'}
                    </span>
                  </button>

                  {/* Show translation text if toggled */}
                  {showingTranslation[message.id] && translations[message.id] && (
                    <div className={`w-full mt-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                      <p className="text-xs text-indigo-600 font-medium mb-1">
                        {messageLang === 'en' ? 'Spanish' : 'English'} translation:
                      </p>
                      <p className="text-sm text-indigo-900 whitespace-pre-wrap">{translations[message.id]}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Feedback button for counselor messages */}
            {isCurrentUser && user?.userType === 'counselor' && (
              <div className={`mt-2 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                <button
                  onClick={() => {
                    const studentMessage = messages.find((m, index) => 
                      index < messages.indexOf(message) && m.senderType === 'student'
                    );
                    setFeedbackMessage(message);
                    setFeedbackStudentMessage(studentMessage || null);
                    setShowFeedback(true);
                  }}
                  className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Brain size={12} />
                  <span>Get AI Feedback</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              conversation.type === 'ai' 
                ? 'bg-purple-500' 
                : 'bg-green-500'
            }`}>
              {conversation.type === 'ai' ? (
                <Bot size={20} className="text-white" />
              ) : (
                <User size={20} className="text-white" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">{conversation.title}</h3>
              <p className="text-sm text-teal-100">
                {conversation.type === 'ai' ? 'AI Companion' : 'Human Counselor'}
                {conversation.isAnonymous && ' • Anonymous'}
              </p>
            </div>
          </div>
          
          {/* Export menu for counselors */}
          {user?.userType === 'counselor' && conversation.type === 'human' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowEndConversationModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm font-medium"
                title="Analyze conversation quality and student outcomes"
              >
                <Brain size={16} />
                <span>Analyze Conversation</span>
              </button>
              
              <button
                onClick={loadExportStats}
                className="text-white hover:text-gray-200 transition-colors p-2 rounded-lg hover:bg-white/10"
                title="View conversation statistics"
              >
                <BarChart3 size={20} />
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="text-white hover:text-gray-200 transition-colors p-2 rounded-lg hover:bg-white/10"
                  title="Export conversation"
                >
                  <Download size={20} />
                </button>
                
                {showExportMenu && (
                  <div className="absolute right-0 top-12 bg-white rounded-lg shadow-lg border py-2 z-50 min-w-[160px]">
                    <button
                      onClick={handleExportJSON}
                      disabled={isExporting}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <FileText size={16} />
                      <span>Export as JSON</span>
                    </button>
                    <button
                      onClick={handleExportCSV}
                      disabled={isExporting}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <FileText size={16} />
                      <span>Export as CSV</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <button className="text-white hover:text-gray-200">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Start your conversation</h3>
            <p className="text-gray-600">
              Share what&apos;s on your mind. This is a safe, {conversation.isAnonymous ? 'anonymous' : 'confidential'} space.
            </p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-black"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            className={`p-3 rounded-xl transition-colors ${
              newMessage.trim() && !isSending
                ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSending ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
      
      {/* Export Statistics Modal */}
      {showExportStats && exportStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Conversation Statistics</h3>
              <button
                onClick={() => setShowExportStats(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Total Messages</p>
                  <p className="text-xl font-semibold text-gray-900">{exportStats.messageCount}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="text-xl font-semibold text-gray-900">{exportStats.conversationDuration}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Student Messages:</span>
                  <span className="font-medium text-gray-900">{exportStats.studentMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Counselor Messages:</span>
                  <span className="font-medium text-gray-900">{exportStats.counselorMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">AI Messages:</span>
                  <span className="font-medium text-gray-900">{exportStats.aiMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Characters:</span>
                  <span className="font-medium text-gray-900">{exportStats.totalCharacters.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Message Length:</span>
                  <span className="font-medium text-gray-900">{exportStats.averageMessageLength} chars</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-3">Export this conversation:</p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExportJSON}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <FileText size={16} />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Feedback Modal */}
      {showFeedback && feedbackMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">AI Response Analysis</h2>
              <button
                onClick={() => {
                  setShowFeedback(false);
                  setFeedbackMessage(null);
                  setFeedbackStudentMessage(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="p-6">
                <FeedbackInterface
                  responseContent={feedbackMessage.content}
                  studentMessage={feedbackStudentMessage?.content || 'No previous student message found'}
                  conversationHistory={messages.slice(-5)} // Last 5 messages for context
                  counselorId={user?.uid || ''}
                  culturalContext={conversation.culturalContext}
                  onFeedbackComplete={(feedback) => {
                    console.log('Feedback completed:', feedback);
                    setShowFeedback(false);
                    setFeedbackMessage(null);
                    setFeedbackStudentMessage(null);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End Conversation Confirmation Modal */}
      {showEndConversationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 rounded-full p-2">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Analyze Conversation</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              Get comprehensive AI feedback on this conversation. This will:
            </p>
            
            <ul className="text-sm text-gray-600 mb-6 space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Run comprehensive AI analysis of the conversation</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Analyze student emotional journey and outcomes</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Generate performance feedback for you</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Keep the conversation active for continued chatting</span>
              </li>
            </ul>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEndConversationModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndConversation}
                disabled={isEndingConversation}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
              >
                {isEndingConversation ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Brain size={16} />
                    <span>Analyze Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Outcome Analysis Modal */}
      {showOutcomeAnalysis && conversationOutcome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 rounded-full p-2">
                  <Brain className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Conversation Analysis Complete</h2>
              </div>
              <button
                onClick={() => {
                  setShowOutcomeAnalysis(false);
                  setConversationOutcome(null);
                  // Keep the conversation open - don't call onBack()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Overall Metrics */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Performance</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{conversationOutcome.overallEffectiveness}/10</p>
                      <p className="text-sm text-blue-800">Effectiveness</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{conversationOutcome.studentSatisfactionEstimate}/10</p>
                      <p className="text-sm text-green-800">Student Satisfaction</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{conversationOutcome.culturalSensitivityScore}/10</p>
                      <p className="text-sm text-purple-800">Cultural Sensitivity</p>
                    </div>
                  </div>

                  {/* Student Journey */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Student Emotional Journey</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Starting Distress:</span>
                        <span className="font-medium text-gray-900">{conversationOutcome.startingState?.emotionalIntensity || 'N/A'}/10</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Resolution Level:</span>
                        <span className="font-medium text-gray-900">{conversationOutcome.endingState?.resolutionLevel || 'N/A'}/10</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Empowerment:</span>
                        <span className="font-medium text-gray-900">{conversationOutcome.endingState?.empowermentLevel || 'N/A'}/10</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Likely to Return:</span>
                        <span className={`font-medium ${conversationOutcome.endingState?.likelyToReturn ? 'text-green-600' : 'text-red-600'}`}>
                          {conversationOutcome.endingState?.likelyToReturn ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* What Worked Well */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Analysis Summary</h3>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-2">✅ What Worked Well</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      {conversationOutcome.whatWorkedWell?.map((item: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-900 mb-2">💡 Areas for Improvement</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {conversationOutcome.areasForImprovement?.map((item: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-yellow-500 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {conversationOutcome.culturalConsiderations?.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-900 mb-2">🌍 Cultural Considerations</h4>
                      <ul className="text-sm text-purple-800 space-y-1">
                        {conversationOutcome.culturalConsiderations.map((item: string, index: number) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-purple-500 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Performance Metrics */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Performance Metrics</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800">{conversationOutcome.counselorPerformance?.empathyConsistency || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Empathy</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800">{conversationOutcome.counselorPerformance?.culturalAdaptation || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Cultural Adaptation</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800">{conversationOutcome.counselorPerformance?.activeListening || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Active Listening</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800">{conversationOutcome.counselorPerformance?.questionQuality || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Question Quality</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800">{conversationOutcome.counselorPerformance?.appropriateBoundaries || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Boundaries</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xl font-bold text-gray-800">{conversationOutcome.counselorPerformance?.solutionOrientation || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Solution Focus</p>
                  </div>
                </div>
              </div>

              {/* Action Items */}
              {conversationOutcome.endingState?.actionItemsIdentified?.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Action Items</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <ul className="text-sm text-blue-800 space-y-2">
                      {conversationOutcome.endingState.actionItemsIdentified.map((item: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <CheckCircle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Continue Conversation Button */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <button
                  onClick={() => {
                    setShowOutcomeAnalysis(false);
                    setConversationOutcome(null);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 mx-auto"
                >
                  <MessageCircle size={20} />
                  <span>Continue Conversation</span>
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  You can continue chatting with the student after reviewing this analysis
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContinuousChat;