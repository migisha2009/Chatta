import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Message from './Message.jsx';

const VirtualizedMessageList = ({ 
  messages, 
  currentUser, 
  userProfiles = {}, 
  onReaction, 
  onReply, 
  threadMessages = {},
  onLoadMore,
  hasMore,
  isLoadingMore,
  messageListRef 
}) => {
  const [containerHeight, setContainerHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  const [itemHeight, setItemHeight] = useState(80); // Average message height
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const itemHeights = useRef(new Map());
  const lastScrollTop = useRef(0);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + 5, messages.length); // +5 for buffer
    return { start: Math.max(0, start - 5), end }; // -5 for buffer
  }, [scrollTop, containerHeight, itemHeight, messages.length]);

  // Get visible messages
  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end);
  }, [messages, visibleRange]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    let height = 0;
    messages.forEach((message, index) => {
      const cachedHeight = itemHeights.current.get(message.id);
      height += cachedHeight || itemHeight;
    });
    return height;
  }, [messages, itemHeight]);

  // Update container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Intersection Observer for loading more messages
  useEffect(() => {
    if (!observerRef.current && containerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !isLoadingMore) {
            onLoadMore();
          }
        },
        {
          root: containerRef.current,
          rootMargin: '100px',
          threshold: 0.1
        }
      );
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Handle scroll
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    lastScrollTop.current = newScrollTop;

    // Auto-scroll to bottom if near bottom and new message arrives
    const isNearBottom = totalHeight - (newScrollTop + containerHeight) < 100;
    if (isNearBottom) {
      // Handle auto-scroll logic
    }
  }, [containerHeight, totalHeight]);

  // Measure item height
  const measureItemHeight = useCallback((messageId, height) => {
    const currentHeight = itemHeights.current.get(messageId) || itemHeight;
    if (Math.abs(height - currentHeight) > 5) { // Only update if significant change
      itemHeights.current.set(messageId, height);
      // Trigger re-render with new height
      setItemHeight(prev => prev); // Force update
    }
  }, [itemHeight]);

  // Optimized scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = totalHeight;
    }
  }, [totalHeight]);

  // Expose scroll functions via ref
  useEffect(() => {
    if (messageListRef) {
      messageListRef.current = {
        scrollToBottom,
        scrollToTop: () => {
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
        }
      };
    }
  }, [messageListRef, scrollToBottom]);

  // Memoized message item
  const MessageItem = React.memo(({ message, index }) => {
    const itemRef = useRef(null);

    useEffect(() => {
      if (itemRef.current) {
        const height = itemRef.current.getBoundingClientRect().height;
        measureItemHeight(message.id, height);
      }
    }, [message.id, measureItemHeight]);

    return (
      <div
        ref={itemRef}
        style={{
          position: 'absolute',
          top: Array.from(itemHeights.current.values())
            .slice(0, messages.indexOf(message))
            .reduce((sum, h) => sum + h, 0),
          left: 0,
          right: 0
        }}
      >
        <Message
          message={message}
          currentUser={currentUser}
          isPrivate={message.isPrivate}
          userProfiles={userProfiles}
          onReaction={onReaction}
          onReply={onReply}
          threadMessages={threadMessages[message.id] || []}
        />
      </div>
    );
  });

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Loading indicator at top */}
      {isLoadingMore && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gray-900 bg-opacity-90 p-2 text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
            <span className="text-sm text-gray-400">Loading more messages...</span>
          </div>
        </div>
      )}

      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
        onScroll={handleScroll}
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Spacer for total height */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Load more trigger */}
          <div
            ref={(el) => {
              if (el && observerRef.current) {
                observerRef.current.observe(el);
              }
            }}
            style={{ height: 1 }}
          />

          {/* Visible messages */}
          {visibleMessages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              index={visibleRange.start + index}
            />
          ))}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {scrollTop > 500 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full shadow-lg transition-colors z-20"
          title="Scroll to bottom"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};

// Performance optimization: Only re-render when props actually change
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.currentUser === nextProps.currentUser &&
    prevProps.hasMore === nextProps.hasMore &&
    prevProps.isLoadingMore === nextProps.isLoadingMore &&
    JSON.stringify(prevProps.userProfiles) === JSON.stringify(nextProps.userProfiles)
  );
};

export default React.memo(VirtualizedMessageList, areEqual);
