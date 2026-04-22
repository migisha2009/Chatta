import React from 'react';

const Message = ({ message, currentUser, isPrivate = false }) => {
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
          <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold mr-2 flex-shrink-0`}>
            {message.username ? message.username.charAt(0).toUpperCase() : '?'}
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
          >
            <p className="text-sm break-words">{message.text}</p>
          </div>

          {/* Timestamp for own messages */}
          {isOwnMessage && (
            <div className="text-right mt-1">
              <span className="text-xs text-gray-500">{formatTime(message.time)}</span>
            </div>
          )}
        </div>

        {/* Avatar for own messages (optional) */}
        {isOwnMessage && (
          <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold ml-2 flex-shrink-0`}>
            {message.username ? message.username.charAt(0).toUpperCase() : '?'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
