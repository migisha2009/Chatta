import React, { useEffect, useRef } from 'react';
import Message from './Message';

const MessageList = ({ messages, currentUser, isPrivate = false }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle keyboard shortcuts for scrolling
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Press 'Home' to scroll to top, 'End' to scroll to bottom
      if (e.key === 'Home') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToBottom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="mb-4">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto text-gray-400"
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
          <p className="text-lg font-medium mb-2">
            {isPrivate ? 'No private messages yet' : 'No messages yet'}
          </p>
          <p className="text-sm">
            {isPrivate 
              ? 'Start a conversation by sending a message!' 
              : 'Be the first to say something!'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {/* Date separator (optional - you can add date grouping logic here) */}
      {messages.length > 0 && (
        <div className="text-center mb-4">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            Today
          </span>
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => (
        <Message
          key={message.id || index}
          message={message}
          currentUser={currentUser}
          isPrivate={isPrivate}
        />
      ))}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />

      {/* Scroll to bottom button (shows when not at bottom) */}
      <div className="fixed bottom-20 right-4 md:hidden">
        <button
          onClick={scrollToBottom}
          className="bg-purple-600 text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
          title="Scroll to bottom"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MessageList;
