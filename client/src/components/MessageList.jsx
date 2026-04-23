import React, { useEffect, useRef, useState, useCallback } from 'react';
import Message from './Message';

const MessageList = ({ messages, currentUser, isPrivate = false, roomId, onLoadMore, hasMore, isLoading, userProfiles = {}, onReaction, onReply, threadMessages = [] }) => {
  const messagesEndRef = useRef(null);
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll to bottom when new messages arrive (only if at bottom)
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Check if user is at bottom of message list
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100; // 100px from bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold;
    
    setIsAtBottom(atBottom);
    setShowJumpToLatest(!atBottom && scrollTop > 500);
  }, []);

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkScrollPosition();
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [checkScrollPosition]);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // IntersectionObserver for loading more messages
  useEffect(() => {
    if (!sentinelRef.current || !onLoadMore || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        root: containerRef.current,
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoading]);

  // Handle keyboard shortcuts for scrolling
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Press 'Home' to scroll to top, 'End' to scroll to bottom
      if (e.key === 'Home') {
        e.preventDefault();
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToBottom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollToBottom]);

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
    <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={containerRef}>
      {/* Loading indicator for older messages */}
      {isLoading && (
        <div className="flex justify-center py-2">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
            <span className="text-sm">Loading older messages...</span>
          </div>
        </div>
      )}

      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" />

      {/* Beginning of messages indicator */}
      {!hasMore && messages.length > 0 && (
        <div className="text-center py-2 text-gray-500 text-sm">
          You've reached the beginning of #{roomId || 'room'}
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => (
        <Message
          key={message.id || index}
          message={message}
          currentUser={currentUser}
          isPrivate={isPrivate}
          userProfiles={userProfiles}
          onReaction={onReaction}
          onReply={onReply}
          threadMessages={threadMessages}
        />
      ))}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />

      {/* Jump to latest button */}
      {showJumpToLatest && (
        <div className="fixed bottom-20 right-4 z-10">
          <button
            onClick={scrollToBottom}
            className="bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-105"
            title="Jump to latest"
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
      )}
    </div>
  );
};

export default MessageList;
