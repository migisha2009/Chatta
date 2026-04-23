import React, { useState, useRef, useEffect } from 'react';
import { renderMessage } from '../utils/renderMessage';
import VoiceRecorder from './VoiceRecorder';

const MessageInput = ({ onSendMessage, disabled = false, placeholder = "Type a message...", socket, currentRoom }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Handle voice recording completion
  const handleVoiceRecording = (recording) => {
    setVoiceRecording(recording);
  };

  // Send voice message
  const sendVoiceMessage = () => {
    if (voiceRecording && onSendMessage) {
      onSendMessage({
        type: 'voice',
        audio: voiceRecording.base64,
        duration: voiceRecording.duration,
        blob: voiceRecording.blob
      });
      setVoiceRecording(null);
    }
  };

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
    if ((message.trim() || attachments.length > 0) && !disabled && !isUploading) {
      stopTyping(); // Stop typing when sending message
      onSendMessage({
        text: message.trim(),
        attachments: attachments
      });
      setMessage('');
      setAttachments([]);
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

  // Markdown formatting functions
  const insertFormat = (before, after = '') => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = message.substring(start, end) || 'text';
      const newMessage = message.substring(0, start) + before + selectedText + after + message.substring(end);
      setMessage(newMessage);
      startTyping();
      
      // Set cursor position after formatted text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + before.length + selectedText.length + after.length;
        textarea.focus();
      }, 0);
    }
  };

  const insertBold = () => insertFormat('**', '**');
  const insertItalic = () => insertFormat('*', '*');
  const insertInlineCode = () => insertFormat('`', '`');
  const insertCodeBlock = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = message.substring(start, end) || 'code';
      const newMessage = message.substring(0, start) + '```\\n' + selectedText + '\\n```' + message.substring(end);
      setMessage(newMessage);
      startTyping();
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4 + selectedText.length;
        textarea.focus();
      }, 0);
    }
  };

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setAttachments(prev => [...prev, ...response.files]);
          setUploadProgress(0);
          setIsUploading(false);
        } else {
          console.error('Upload failed:', xhr.statusText);
          setIsUploading(false);
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        console.error('Upload error');
        setIsUploading(false);
      });
      
      xhr.open('POST', 'http://localhost:5000/api/upload');
      xhr.send(formData);
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    uploadFiles(files);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    uploadFiles(files);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    const files = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    
    if (files.length > 0) {
      e.preventDefault();
      uploadFiles(files);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const characterCount = message.length;
  const maxCharacters = 500;
  const isNearLimit = characterCount > maxCharacters * 0.9;
  const isAtLimit = characterCount >= maxCharacters;

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-2 p-4 bg-gray-50 border-t border-gray-200">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative group bg-white border border-gray-200 rounded-lg p-2 flex items-center space-x-2">
                <div className="text-sm text-gray-600">
                  <div className="font-medium truncate max-w-32">{attachment.filename}</div>
                  <div className="text-xs text-gray-400">{formatFileSize(attachment.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
            ))}
          </div>
        )}
        
        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        
        <div className={`flex items-end space-x-2 ${isDragging ? 'bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-2' : ''}`}>
          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.zip"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isUploading}
          />
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

          {/* Paperclip Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach files"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M21.44 11.05L12.25 20.25C11.07 21.43 9.21 21.43 8.03 20.25L3.75 15.97C2.57 14.79 2.57 12.93 3.75 11.75L13.78 1.72C14.96 0.54 16.82 0.54 18 1.72L21.44 5.16C22.62 6.34 22.62 8.2 21.44 9.38L11.41 19.41C10.23 20.59 8.37 20.59 7.19 19.41L4.59 16.81C3.41 15.63 3.41 13.77 4.59 12.59L14.62 2.56"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Markdown Formatting Toolbar */}
          <div className="flex items-center space-x-1 p-2 bg-gray-100 border border-gray-300 border-b-0 rounded-t-lg">
            <button
              type="button"
              onClick={insertBold}
              className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              title="Bold (Ctrl+B)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h8a4 4 0 0 1 0 8 4 4 0 0 1 0 8H6V4zm2 2v6h6a2 2 0 0 0 0-4H8zm0 8v6h6a2 2 0 0 0 0-4H8z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={insertItalic}
              className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              title="Italic (Ctrl+I)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4v4h4.5l-4 8H6v4h8v-4H9.5l4-8H18V4h-8z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={insertInlineCode}
              className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              title="Inline Code"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 17L2 12l5-5v3h10v4H7v3zm10-10l5 5-5 5v-3H7v-4h10V7z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={insertCodeBlock}
              className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
              title="Code Block"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
              </svg>
            </button>
            <div className="flex-1"/>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`p-1.5 rounded transition-colors ${
                showPreview 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
              }`}
              title="Toggle Preview"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
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
              onPaste={handlePaste}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              placeholder={placeholder}
              disabled={disabled || isUploading}
              rows={1}
              className={`w-full px-4 py-2 bg-white border rounded-lg focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed ${
                isDragging ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
              }`}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          
            {/* Character Counter */}
            <div className={`absolute bottom-2 right-2 text-xs ${
              isAtLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-600' : 'text-gray-400'
            }`}>
              {characterCount}/{maxCharacters}
            </div>
          </div>

          {/* Live Preview */}
          {showPreview && message.trim() && (
            <div className="mt-2 p-3 bg-white border border-gray-300 rounded-lg">
              <div className="text-xs text-gray-500 mb-2 font-semibold">Preview</div>
              <div 
                className="message-content text-sm"
                dangerouslySetInnerHTML={{ __html: renderMessage(message) }}
              />
            </div>
          )}

          {/* Voice Recorder */}
          <VoiceRecorder 
            onRecordingComplete={handleVoiceRecording}
            disabled={disabled || isUploading}
          />

          {/* Send Voice Message Button */}
          {voiceRecording && (
            <button
              type="button"
              onClick={sendVoiceMessage}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Send Voice</span>
            </button>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!message.trim() && attachments.length === 0 && !voiceRecording) || disabled || characterCount > maxCharacters || isUploading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <span>{isUploading ? 'Uploading...' : 'Send'}</span>
            {!isUploading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Warning for character limit */}
      {isAtLimit && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          Maximum character limit reached
        </div>
      )}
      
      {/* Drag overlay hint */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-90 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-blue-600 font-medium">Drop files here to upload</div>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
