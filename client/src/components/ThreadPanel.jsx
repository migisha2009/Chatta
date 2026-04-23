import React, { useState, useEffect, useRef } from 'react';
import Message from './Message.jsx';

const ThreadPanel = ({ isOpen, onClose, originalMessage, currentUser, socket, onlineUsers }) => {
  const [threadMessages, setThreadMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (socket && originalMessage) {
      // Join thread room
      socket.emit('joinThread', { messageId: originalMessage.id });
      
      // Listen for thread messages
      socket.on('threadMessage', (message) => {
        setThreadMessages(prev => [...prev, message]);
      });

      // Listen for thread history
      socket.on('threadHistory', ({ messages }) => {
        setThreadMessages(messages);
      });

      // Listen for typing indicators in thread
      socket.on('userTyping', ({ username }) => {
        if (username !== currentUser) {
          setTypingUsers(prev => {
            if (!prev.includes(username)) {
              return [...prev, username];
            }
            return prev;
          });
        }
      });

      socket.on('userStoppedTyping', ({ username }) => {
        setTypingUsers(prev => prev.filter(u => u !== username));
      });

      return () => {
        // Leave thread room
        socket.emit('leaveThread', { messageId: originalMessage.id });
        socket.off('threadMessage');
        socket.off('threadHistory');
        socket.off('userTyping');
        socket.off('userStoppedTyping');
      };
    }
  }, [socket, originalMessage, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && socket && originalMessage) {
      socket.emit('threadReply', {
        parentId: originalMessage.id,
        text: messageInput.trim()
      });
      setMessageInput('');
      handleStopTyping();
    }
  };

  const handleTyping = () => {
    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit('typing');
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 3000);
  };

  const handleStopTyping = () => {
    if (isTyping && socket) {
      setIsTyping(false);
      socket.emit('stopTyping');
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  if (!isOpen || !originalMessage) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Thread</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        
        {/* Original Message */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              {originalMessage.username}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {originalMessage.time}
            </span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {originalMessage.text}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {threadMessages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="text-sm">No replies yet. Be the first to reply!</p>
          </div>
        ) : (
          threadMessages.map((message) => (
            <Message
              key={message.id}
              message={message}
              currentUser={currentUser}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing</span>
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value);
              handleTyping();
            }}
            onBlur={handleStopTyping}
            placeholder="Reply to thread..."
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!messageInput.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Reply
          </button>
        </form>
      </div>
    </div>
  );
};

export default ThreadPanel;
