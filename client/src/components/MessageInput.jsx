import React, { useState, useRef, useEffect } from 'react';

const MessageInput = ({ onSendMessage, disabled = false, placeholder = "Type a message...", socket, currentRoom }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // 20 common emojis
  const emojis = [
    '_smile', 'laughing', 'blush', 'heart_eyes', 'wink',
    'thumbsup', 'clap', 'fire', 'rocket', 'star',
    'heart', 'broken_heart', 'wave', 'thinking_face', 'pray',
    'ok_hand', 'victory_hand', 'peace', 'muscle', 'point_up'
  ];

  // Convert emoji names to actual emoji characters
  const getEmojiChar = (emojiName) => {
    const emojiMap = {
      'smile': 'smile',
      'laughing': 'laughing',
      'blush': 'blush',
      'heart_eyes': 'heart_eyes',
      'wink': 'wink',
      'thumbsup': 'thumbsup',
      'clap': 'clap',
      'fire': 'fire',
      'rocket': 'rocket',
      'star': 'star',
      'heart': 'heart',
      'broken_heart': 'broken_heart',
      'wave': 'wave',
      'thinking_face': 'thinking_face',
      'pray': 'pray',
      'ok_hand': 'ok_hand',
      'victory_hand': 'victory_hand',
      'peace': 'peace',
      'muscle': 'muscle',
      'point_up': 'point_up'
    };
    return emojiMap[emojiName] || 'smile';
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      stopTyping(); // Stop typing when sending message
      onSendMessage(message.trim());
      setMessage('');
      setShowEmojiPicker(false);
    }
  };

  // Cleanup typing indicator on unmount
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Typing indicator functions
  const startTyping = () => {
    if (!isTypingRef.current && socket && currentRoom) {
      isTypingRef.current = true;
      socket.emit('typing');
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (isTypingRef.current && socket) {
      isTypingRef.current = false;
      socket.emit('stopTyping');
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.substring(0, start) + emoji + message.substring(end);
      setMessage(newMessage);
      startTyping(); // Emit typing when inserting emoji
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    }
  };

  const characterCount = message.length;
  const maxCharacters = 500;
  const isNearLimit = characterCount > maxCharacters * 0.9;
  const isAtLimit = characterCount >= maxCharacters;

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2 p-4 bg-gray-50 border-t border-gray-200">
        {/* Emoji Picker Toggle */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            title="Add emoji"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 14.5C8 14.5 9.5 16.5 12 16.5C14.5 16.5 16 14.5 16 14.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 9H9.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 9H15.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Emoji Picker Dropdown */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
              <div className="grid grid-cols-5 gap-1">
                {emojis.map((emojiName) => (
                  <button
                    key={emojiName}
                    type="button"
                    onClick={() => insertEmoji(getEmojiChar(emojiName))}
                    className="p-2 hover:bg-gray-100 rounded text-lg transition-colors"
                    title={emojiName.replace('_', ' ')}
                  >
                    {getEmojiChar(emojiName)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= maxCharacters) {
                setMessage(e.target.value);
                if (e.target.value.trim()) {
                  startTyping();
                } else {
                  stopTyping();
                }
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          
          {/* Character Counter */}
          <div className={`absolute bottom-2 right-2 text-xs ${
            isAtLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-600' : 'text-gray-400'
          }`}>
            {characterCount}/{maxCharacters}
          </div>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() || disabled || characterCount > maxCharacters}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          <span>Send</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>

      {/* Warning for character limit */}
      {isAtLimit && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          Maximum character limit reached
        </div>
      )}
    </div>
  );
};

export default MessageInput;
