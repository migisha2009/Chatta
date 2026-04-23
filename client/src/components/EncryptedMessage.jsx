import React, { useState, useEffect } from 'react';
import encryption from '../utils/encryption';

const EncryptedMessage = ({ 
  message, 
  currentUser, 
  userProfiles = {}, 
  onReaction, 
  onReply,
  threadMessages = [] 
}) => {
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false);

  useEffect(() => {
    if (message.encrypted && !isDecrypted) {
      decryptMessage();
    }
  }, [message]);

  const decryptMessage = async () => {
    if (!message.encrypted || isDecrypted) return;

    setIsDecrypting(true);
    setDecryptionError('');

    try {
      // Get user's private key from storage
      const keyPair = await encryption.retrieveKeyPair(currentUser.id);
      
      if (!keyPair) {
        setDecryptionError('Encryption keys not found. Please refresh and try again.');
        return;
      }

      // Decrypt the message
      const decrypted = await encryption.decryptFromUser(message.encrypted, keyPair.privateKey);
      setDecryptedContent(decrypted);
      setIsDecrypted(true);
    } catch (error) {
      console.error('Decryption failed:', error);
      setDecryptionError('Failed to decrypt message. The message may be corrupted or keys may be invalid.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const isOwnMessage = message.username === currentUser?.username;
  const isSystemMessage = message.username === 'System' || message.type === 'system';

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

  // Format timestamp
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return timeString;
    
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
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
      <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-start max-w-xs lg:max-w-md`}>
        {/* Avatar */}
        {!isOwnMessage && (
          <div className="flex-shrink-0 mr-2">
            {userProfiles[message.username]?.avatar ? (
              <img
                src={userProfiles[message.username].avatar}
                alt={message.username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className={`w-8 h-8 ${getAvatarColor(message.username)} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
                {message.username ? message.username.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className={`${isOwnMessage ? 'mr-2' : 'ml-2'}`}>
          {/* Username and Timestamp */}
          {!isOwnMessage && (
            <div className="flex items-baseline space-x-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">{message.username}</span>
              <span className="text-xs text-gray-500">{formatTime(message.time)}</span>
            </div>
          )}

          {/* Message Bubble */}
          <div className={`${isOwnMessage ? 'mr-2' : 'ml-2'}`}>
            {/* Encryption Status */}
            <div className="flex items-center space-x-2 mb-1">
              <div className="flex items-center space-x-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-500">
                  <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" fill="currentColor"/>
                  <path d="M12 7V12L15 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-xs text-green-600 dark:text-green-400">
                  {isDecrypted ? 'Decrypted' : 'Encrypted'}
                </span>
              </div>
              
              <button
                onClick={() => setShowEncryptionInfo(!showEncryptionInfo)}
                className="text-gray-400 hover:text-gray-600"
                title="Encryption info"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
                </svg>
              </button>
            </div>

            {/* Message Content */}
            <div
              className={`px-4 py-2 rounded-2xl ${
                isOwnMessage
                  ? 'bg-purple-600 text-white ml-auto'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              {isDecrypting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  <span className="text-sm">Decrypting...</span>
                </div>
              ) : decryptionError ? (
                <div className="text-sm">
                  <div className="text-red-600 dark:text-red-400 mb-2">{decryptionError}</div>
                  <button
                    onClick={decryptMessage}
                    className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800"
                  >
                    Retry Decryption
                  </button>
                </div>
              ) : (
                <p className="text-sm break-words">{decryptedContent || message.text}</p>
              )}
            </div>

            {/* Encryption Info */}
            {showEncryptionInfo && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                <div className="font-semibold mb-1">Encryption Details:</div>
                <div>• Algorithm: AES-256-GCM</div>
                <div>• Key Exchange: RSA-OAEP</div>
                <div>• Signature: RSA-PSS</div>
                <div>• Status: {isDecrypted ? 'Decrypted' : 'Encrypted'}</div>
              </div>
            )}

            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.reactions.map((reaction, index) => (
                  <button
                    key={index}
                    onClick={() => onReaction && onReaction(message.id, reaction.emoji)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                      reaction.users?.includes(currentUser?.username)
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                    }`}
                    title={`${reaction.users?.length || 0} users reacted`}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.users?.length || 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timestamp for own messages */}
          {isOwnMessage && (
            <div className="text-xs text-gray-500 mt-1 text-right">
              {formatTime(message.time)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EncryptedMessage;
