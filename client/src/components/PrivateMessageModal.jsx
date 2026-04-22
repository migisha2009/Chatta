import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const PrivateMessageModal = ({ 
  isOpen, 
  onClose, 
  recipient, 
  currentUser, 
  onSendPrivateMessage,
  privateMessages = []
}) => {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // Filter messages for this specific conversation
  useEffect(() => {
    const conversationMessages = privateMessages.filter(msg => 
      (msg.fromId === currentUser?.id && msg.toId === recipient?.id) ||
      (msg.fromId === recipient?.id && msg.toId === currentUser?.id)
    ).sort((a, b) => new Date(a.time) - new Date(b.time));
    
    setMessages(conversationMessages);
  }, [privateMessages, currentUser, recipient]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset'; // Restore scroll
    };
  }, [isOpen, onClose]);

  const handleSendMessage = (text) => {
    if (onSendPrivateMessage && recipient) {
      onSendPrivateMessage({
        to: recipient.id,
        text: text
      });
    }
  };

  if (!isOpen || !recipient || !currentUser) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md h-[600px] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex items-center space-x-3">
            {/* Recipient Avatar */}
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
              {recipient.username.charAt(0).toUpperCase()}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900">{recipient.username}</h3>
              <p className="text-xs text-gray-500">Private message</p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center px-4">
                <div className="mb-4">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mx-auto text-gray-400"
                  >
                    <path
                      d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium mb-2">Start a conversation</p>
                <p className="text-sm">Send a message to {recipient.username}</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 space-y-1">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.fromId === currentUser.id ? 'justify-end' : 'justify-start'} mb-3`}
                >
                  <div className={`max-w-xs ${message.fromId === currentUser.id ? 'order-2' : 'order-1'}`}>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        message.fromId === currentUser.id
                          ? 'bg-purple-600 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm break-words">{message.text}</p>
                    </div>
                    <p className={`text-xs text-gray-500 mt-1 ${
                      message.fromId === currentUser.id ? 'text-right' : 'text-left'
                    }`}>
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <MessageInput
            onSendMessage={handleSendMessage}
            placeholder={`Message ${recipient.username}...`}
            disabled={false}
          />
        </div>

        {/* Typing Indicator (Optional - can be implemented later) */}
        <div className="absolute bottom-20 left-4 text-xs text-gray-500 hidden">
          {recipient.username} is typing...
        </div>
      </div>
    </div>
  );
};

export default PrivateMessageModal;
