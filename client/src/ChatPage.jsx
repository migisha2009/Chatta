import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DarkModeToggle from './components/DarkModeToggle';
import MessageList from './components/MessageList';
import ThreadPanel from './components/ThreadPanel';
import { useAuth } from './contexts/AuthContext';

const ChatPage = () => {
  const { user, socket, isConnected, logout } = useAuth();
  const [currentRoom, setCurrentRoom] = useState('');
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [privateRecipient, setPrivateRecipient] = useState(null);
  const [privateMessage, setPrivateMessage] = useState('');
  const [privateMessages, setPrivateMessages] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting', 'connected', 'disconnected', 'reconnecting'
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [userProfiles, setUserProfiles] = useState({});
  
  // Thread state
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [selectedThreadMessage, setSelectedThreadMessage] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // localStorage helper functions
  const saveMessagesToStorage = (room, messages) => {
    try {
      const key = `chatta_history_${room}`;
      const last100Messages = messages.slice(-100); // Keep only last 100 messages
      localStorage.setItem(key, JSON.stringify(last100Messages));
    } catch (error) {
      console.error('Failed to save messages to localStorage:', error);
    }
  };

  const loadMessagesFromStorage = (room) => {
    try {
      const key = `chatta_history_${room}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load messages from localStorage:', error);
      return [];
    }
  };

  const clearRoomHistory = (room) => {
    try {
      const key = `chatta_history_${room}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear room history:', error);
    }
  };

  // Message deduplication helper
  const deduplicateMessages = (newMessages, existingMessages) => {
    const existingIds = new Set(existingMessages.map(msg => msg.id));
    return newMessages.filter(msg => !existingIds.has(msg.id));
  };
  
  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setShowMobileMenu(false);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track tab focus for notifications
  useEffect(() => {
    const handleFocus = () => setIsTabFocused(true);
    const handleBlur = () => setIsTabFocused(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);
  
  // Initialize user data and socket events
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    setCurrentRoom(user.room);
    setCurrentRoomId(user.room);
    setIsConnecting(false);
    
    if (socket) {
      // Join initial room when socket connects
      if (isConnected) {
        socket.emit('joinRoom', { room: user.room });
      }
    }
  }, [user, socket, isConnected, navigate]);
  
  // Socket event handlers
  useEffect(() => {
    if (!socket || !user) return;
    
    socket.on('message', (message) => {
      setMessages(prev => {
        const newMessages = deduplicateMessages([message], prev);
        const updatedMessages = [...prev, ...newMessages];
        
        // Save to localStorage (last 100 messages)
        saveMessagesToStorage(currentRoom, updatedMessages);
        
        return updatedMessages;
      });
      
      // Handle unread counts and notifications
      if (message.username !== user.username && message.username !== 'ChatBot') {
        // Update unread count for current room if tab is not focused
        if (!isTabFocused) {
          setUnreadCounts(prev => ({
            ...prev,
            [currentRoom]: (prev[currentRoom] || 0) + 1
          }));
          
          // Show browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`New message in #${currentRoom}`, {
              body: `${message.username}: ${message.text}`,
              icon: '/favicon.ico',
              tag: `chat-${currentRoom}`
            });
          }
        }
      }
    });

    socket.on('messageHistory', ({ room, messages: historyMessages, hasMore: historyHasMore, nextCursor: historyNextCursor }) => {
      // Load stored messages from localStorage
      const storedMessages = loadMessagesFromStorage(room);
      
      // Combine server history with stored messages, deduplicate
      const allMessages = deduplicateMessages(historyMessages, storedMessages);
      const storedOnly = deduplicateMessages(storedMessages, historyMessages);
      
      // Set pagination state
      setHasMore(historyHasMore || false);
      setNextCursor(historyNextCursor || null);
      
      // Add divider if we have stored messages
      if (storedOnly.length > 0) {
        const dividerMessage = {
          id: `divider-${room}`,
          username: 'ChatBot',
          text: '--- Previous messages ---',
          time: new Date().toLocaleTimeString(),
          type: 'system'
        };
        setMessages([...allMessages, dividerMessage, ...storedOnly]);
      } else {
        setMessages(allMessages);
      }
    });
    
    socket.on('roomUsers', ({ users }) => {
      setOnlineUsers(users);
    });
    
    socket.on('privateMessage', (message) => {
      setPrivateMessages(prev => [...prev, message]);
      
      // Show notification for private messages if not focused
      if (!isTabFocused && message.fromId !== user.id) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Private message from ${message.from}`, {
            body: message.text,
            icon: '/favicon.ico',
            tag: `private-${message.fromId}`
          });
        }
      }
    });
    
    socket.on('userTyping', ({ username }) => {
      setTypingUsers(prev => {
        if (!prev.includes(username)) {
          return [...prev, username];
        }
        return prev;
      });
    });
    
    socket.on('userStoppedTyping', ({ username }) => {
      setTypingUsers(prev => prev.filter(u => u !== username));
    });
    
    socket.on('rateLimited', (data) => {
      console.warn('Rate limited:', data);
      setRateLimited(true);
      setRateLimitMessage(data.message || 'Rate limit exceeded. Please wait before sending more messages.');
      
      // Clear rate limit status after 5 seconds
      setTimeout(() => {
        setRateLimited(false);
        setRateLimitMessage('');
      }, 5000);
    });
    
    socket.on('error', (data) => {
      console.error('Socket error:', data);
    });
    
    socket.on('profileUpdate', (data) => {
      console.log('Profile update received:', data);
      setUserProfiles(prev => ({
        ...prev,
        [data.profile.username]: data.profile
      }));
    });
    
    // Reaction event handler
    socket.on('reactionUpdated', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reactions } : msg
      ));
    });
    
    // Thread message handler
    socket.on('threadMessage', (message) => {
      setThreadMessages(prev => [...prev, message]);
    });
    
    // Thread history handler
    socket.on('threadHistory', ({ messages }) => {
      setThreadMessages(messages);
    });
    
    return () => {
      socket.off('message');
      socket.off('messageHistory');
      socket.off('roomUsers');
      socket.off('privateMessage');
      socket.off('userTyping');
      socket.off('userStoppedTyping');
      socket.off('rateLimited');
      socket.off('error');
      socket.off('profileUpdate');
      socket.off('reactionUpdated');
      socket.off('threadMessage');
      socket.off('threadHistory');
    };
  }, [socket, user, currentRoom, isTabFocused]);
  
  // Fetch rooms from API
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/rooms');
        const data = await response.json();
        setRooms(data);
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    };
    
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && socket) {
      socket.emit('chatMessage', messageInput.trim());
      setMessageInput('');
    }
  };
  
  const handleReaction = (messageId, emoji) => {
    if (socket) {
      socket.emit('react', { messageId, emoji });
    }
  };
  
  const handleReply = (message) => {
    setSelectedThreadMessage(message);
    setShowThreadPanel(true);
    setThreadMessages([]);
  };
  
  const handleCloseThreadPanel = () => {
    setShowThreadPanel(false);
    setSelectedThreadMessage(null);
    setThreadMessages([]);
  };
  
  const switchRoom = (roomName) => {
    if (socket && user) {
      socket.emit('joinRoom', { room: roomName });
      setCurrentRoom(roomName);
      setMessages([]);
      // Reset pagination state
      setHasMore(true);
      setNextCursor(null);
      setIsLoadingMore(false);
      setCurrentRoomId(roomName);
      // Clear unread count for the room we're switching to
      setUnreadCounts(prev => ({
        ...prev,
        [roomName]: 0
      }));
      localStorage.setItem('chatUser', JSON.stringify({ ...user, room: roomName }));
    }
  };
  
  const sendPrivateMessage = (e) => {
    e.preventDefault();
    if (privateMessage.trim() && socket && privateRecipient) {
      socket.emit('privateMessage', {
        to: privateRecipient.id,
        text: privateMessage.trim()
      });
      setPrivateMessage('');
    }
  };
  
  const openPrivateModal = (recipient) => {
    setPrivateRecipient(recipient);
    setShowPrivateModal(true);
  };
  
  const loadMoreMessages = async () => {
    if (!currentRoomId || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const queryParams = new URLSearchParams({
        limit: '30'
      });
      
      if (nextCursor) {
        queryParams.append('before', nextCursor);
      }
      
      const response = await fetch(`http://localhost:5000/api/messages/${currentRoomId}?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to load more messages');
      }
      
      const data = await response.json();
      
      // Prepend older messages to the list
      setMessages(prev => {
        const newMessages = data.messages.filter(msg => 
          !prev.some(existingMsg => existingMsg.id === msg.id)
        );
        return [...newMessages, ...prev];
      });
      
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  const leaveChat = () => {
    localStorage.removeItem('chatUser');
    navigate('/');
  };
  
  if (!user) return null;
  
  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}
      
      {/* Left Sidebar */}
      <div className={`${isMobile ? 'fixed' : 'relative'} w-50 bg-slate-800 border-r border-slate-700 flex flex-col z-50 transition-transform duration-300 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo and Leave Button */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-violet-500">
                <path d="M8 10.5C8 9.67157 8.67157 9 9.5 9H14.5C15.3284 9 16 9.67157 16 10.5V13.5C16 14.3284 15.3284 15 14.5 15H9.5C8.67157 15 8 14.3284 8 13.5V10.5Z" fill="currentColor"/>
                <path d="M7.5 15L5 18L6.5 15H7.5Z" fill="currentColor"/>
                <path d="M16.5 15L19 18L17.5 15H16.5Z" fill="currentColor"/>
              </svg>
              <span className="font-bold text-lg">Chatta</span>
            </div>
            <button
              onClick={leaveChat}
              className="text-slate-400 hover:text-white transition-colors"
              title="Leave chat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M17 7L7 17M7 7L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          
          {/* Mobile Close Button */}
          {isMobile && (
            <button
              onClick={() => setShowMobileMenu(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        
        {/* Active Rooms */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Active Rooms</h3>
          <div className="space-y-1">
            {rooms.map((room) => (
              <button
                key={room.name}
                onClick={() => {
                  switchRoom(room.name);
                  setShowMobileMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  currentRoom === room.name
                    ? 'bg-violet-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{room.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-slate-600 px-2 py-1 rounded-full">
                      {room.userCount}
                    </span>
                    {unreadCounts[room.name] > 0 && (
                      <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full min-w-[20px] text-center">
                        {unreadCounts[room.name] > 99 ? '99+' : unreadCounts[room.name]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Center Panel */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            
            <div>
              <h2 className="font-semibold text-lg">{currentRoom}</h2>
              <p className="text-sm text-slate-400">{onlineUsers.length} users online</p>
            </div>
          </div>
          
          {/* Mobile Users Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M17 21V19C17 18.0435 16.6739 17.1115 16.067 16.364C15.4601 15.6165 14.6069 15.1129 13.66 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M23 21V19C23 18.0435 22.6739 17.1115 22.067 16.364C21.4601 15.6165 20.6069 15.1129 19.66 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 3.13C16.8604 3.35031 17.6249 3.85071 18.1677 4.55232C18.7104 5.25392 19 6.11752 19 7.005C19 7.89248 18.7104 8.75608 18.1677 9.45768C17.6249 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          {/* Profile Button */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center space-x-1 px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="View Profile"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="hidden md:inline">Profile</span>
          </button>

          {/* Clear History Button - Desktop only */}
          <button
            onClick={() => {
              if (window.confirm(`Clear all message history for #${currentRoom}? This cannot be undone.`)) {
                clearRoomHistory(currentRoom);
                // Keep only system messages (welcome/join messages)
                setMessages(prev => prev.filter(msg => msg.username === 'ChatBot'));
              }
            }}
            className="hidden md:flex items-center space-x-1 px-3 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Clear message history"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Clear History</span>
          </button>
        </div>
        
        {/* Connection Status Banner */}
        {connectionStatus !== 'connected' && (
          <div className={`px-4 py-2 text-sm text-center ${
            connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            {connectionStatus === 'connecting' && 'Connecting to chat server...'}
            {connectionStatus === 'reconnecting' && 'Reconnecting...'}
            {connectionStatus === 'disconnected' && 'Disconnected from chat server'}
          </div>
        )}

        {/* Rate Limit Banner */}
        {rateLimited && (
          <div className="px-4 py-2 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-sm text-center">
            {rateLimitMessage}
          </div>
        )}
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isConnecting ? (
            // Loading State
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Connecting to chat...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            // Empty State
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="mb-4">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mx-auto text-slate-400 dark:text-slate-500"
                  >
                    <path
                      d="M8 10.5C8 9.67157 8.67157 9 9.5 9H14.5C15.3284 9 16 9.67157 16 10.5V13.5C16 14.3284 15.3284 15 14.5 15H9.5C8.67157 15 8 14.3284 8 13.5V10.5Z"
                      fill="currentColor"
                    />
                    <path
                      d="M7.5 15L5 18L6.5 15H7.5Z"
                      fill="currentColor"
                    />
                    <path
                      d="M16.5 15L19 18L17.5 15H16.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                  No messages yet
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Say hello! {"\ud83d\udc4b"}
                </p>
              </div>
            </div>
          ) : (
            // Messages
            <MessageList
              messages={messages}
              currentUser={user.username}
              roomId={currentRoom}
              onLoadMore={loadMoreMessages}
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onReaction={handleReaction}
              onReply={handleReply}
              threadMessages={threadMessages}
              userProfiles={userProfiles}
            />
          )}
        </div>
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Message Input */}
        <div className="bg-slate-800 dark:bg-gray-800 border-t border-slate-700 dark:border-gray-700 p-4">
          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={rateLimited ? "Rate limited. Please wait..." : !isConnected ? "Disconnected..." : "Type a message..."}
              disabled={rateLimited || !isConnected}
              className="flex-1 px-4 py-2 bg-slate-700 dark:bg-gray-700 border border-slate-600 dark:border-gray-600 rounded-lg focus:outline-none focus:border-violet-500 text-white placeholder-slate-400 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || rateLimited || !isConnected}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {rateLimited ? 'Wait' : 'Send'}
            </button>
          </form>
        </div>
      </div>
      
      {/* Right Sidebar - Hidden on Mobile */}
      <div className={`${isMobile ? 'hidden' : 'w-45'} bg-slate-800 border-l border-slate-700 flex flex-col`}>
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold text-sm">Online Users</h3>
          <p className="text-xs text-slate-400">{onlineUsers.length} in room</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {onlineUsers.map((onlineUser) => (
              <button
                key={onlineUser.id}
                onClick={() => openPrivateModal(onlineUser)}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-700 transition-colors text-left"
                disabled={onlineUser.id === user.id}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className={`text-sm ${onlineUser.id === user.id ? 'text-violet-400' : 'text-slate-300'}`}>
                  {onlineUser.username}
                  {onlineUser.id === user.id && ' (You)'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Private Message Modal */}
      {showPrivateModal && privateRecipient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Private Message to {privateRecipient.username}</h3>
              <button
                onClick={() => {
                  setShowPrivateModal(false);
                  setPrivateRecipient(null);
                  setPrivateMessage('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            {/* Private Messages History */}
            <div className="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto mb-4 space-y-2">
              {privateMessages
                .filter(msg => 
                  (msg.fromId === user.id && msg.toId === privateRecipient.id) ||
                  (msg.fromId === privateRecipient.id && msg.toId === user.id)
                )
                .map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`flex ${msg.fromId === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      msg.fromId === user.id ? 'bg-violet-600 text-white' : 'bg-slate-700 text-white'
                    }`}>
                      <p>{msg.text}</p>
                      <p className="text-xs text-slate-400 mt-1">{msg.time}</p>
                    </div>
                  </div>
                ))}
            </div>
            
            <form onSubmit={sendPrivateMessage} className="flex space-x-2">
              <input
                type="text"
                value={privateMessage}
                onChange={(e) => setPrivateMessage(e.target.value)}
                placeholder="Type a private message..."
                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-violet-500 text-white placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!privateMessage.trim()}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Thread Panel */}
      {showThreadPanel && selectedThreadMessage && (
        <ThreadPanel
          isOpen={showThreadPanel}
          onClose={handleCloseThreadPanel}
          originalMessage={selectedThreadMessage}
          currentUser={user.username}
          socket={socket}
          onlineUsers={onlineUsers}
        />
      )}
    </div>
  );
};

export default ChatPage;
