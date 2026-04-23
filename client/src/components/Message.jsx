import React, { useState } from 'react';
import EmojiPicker from './EmojiPicker.jsx';

const Message = ({ message, currentUser, isPrivate = false, userProfiles = {}, onReaction, onReply, threadMessages = [] }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // Generate color from username hash for avatar
  const getAvatarColor = (username) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-rose-500',
      'bg-violet-500', 'bg-amber-500', 'bg-lime-500', 'bg-sky-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Get user profile for avatar
  const getUserProfile = (username) => {
    return userProfiles[username];
  };

  // Format timestamp to "2:45 PM" format
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    // Parse the time string (assuming it's in HH:MM:SS format)
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const minute = parseInt(minutes);
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const isOwnMessage = message.username === currentUser;
  const isSystemMessage = message.username === 'ChatBot' || message.type === 'system';
  const avatarColor = getAvatarColor(message.username || 'Unknown');
  const userProfile = getUserProfile(message.username);
  
  // Count thread replies for this message
  const threadReplyCount = threadMessages.filter(msg => msg.parentId === message.id).length;

  const handleReaction = (emoji) => {
    if (onReaction) {
      onReaction(message.id, emoji);
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  const hasUserReacted = (reaction) => {
    return reaction.users && reaction.users.includes(currentUser);
  };

  if (isSystemMessage) {
    return (
      <div className="flex justify-center my-3">
        <div className="text-center">
          <p className="text-sm text-gray-500 italic bg-gray-100 px-3 py-1 rounded-full inline-block">
            {message.text}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatTime(message.time)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end max-w-xs lg:max-w-md`}>
        {/* Avatar */}
        {!isOwnMessage && (
          <div className="w-8 h-8 rounded-full mr-2 flex-shrink-0 overflow-hidden">
            {userProfile?.avatar ? (
              <img
                src={userProfile.avatar}
                alt={message.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold`}>
                {message.username ? message.username.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className={`${isOwnMessage ? 'mr-2' : 'ml-2'}`}>
          {/* Username and Timestamp */}
          {!isOwnMessage && (
            <div className="flex items-baseline space-x-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">{message.username}</span>
              <span className="text-xs text-gray-500">{formatTime(message.time)}</span>
            </div>
          )}

          {/* Message Text */}
          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwnMessage
                ? 'bg-purple-600 text-white rounded-br-none'
                : 'bg-gray-200 text-gray-800 rounded-bl-none'
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <p className="text-sm break-words">{message.text}</p>
            
            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.reactions.map((reaction, index) => (
                  <button
                    key={index}
                    onClick={() => handleReaction(reaction.emoji)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                      hasUserReacted(reaction)
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                    title={`${reaction.users ? reaction.users.length : 0} users reacted`}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.users ? reaction.users.length : 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message Actions */}
          {!isSystemMessage && isHovered && (
            <div className="flex items-center space-x-2 mt-2">
              {/* React Button */}
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Add reaction"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="currentColor"/>
                  </svg>
                </button>
                {showEmojiPicker && (
                  <EmojiPicker
                    onSelect={handleReaction}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>
              
              {/* Reply Button */}
              <button
                onClick={handleReply}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Reply"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          )}
          
          {/* Timestamp for own messages */}
          {isOwnMessage && (
            <div className="text-right mt-1">
              <span className="text-xs text-gray-500">{formatTime(message.time)}</span>
            </div>
          )}
          
          {/* Thread reply count */}
          {threadReplyCount > 0 && (
            <div className="mt-1">
              <button
                onClick={handleReply}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'} →
              </button>
            </div>
          )}
        </div>

        {/* Avatar for own messages (optional) */}
        {isOwnMessage && (
          <div className="w-8 h-8 rounded-full ml-2 flex-shrink-0 overflow-hidden">
            {userProfile?.avatar ? (
              <img
                src={userProfile.avatar}
                alt={message.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold`}>
                {message.username ? message.username.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
