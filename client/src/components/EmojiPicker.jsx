import React, { useState } from 'react';

const EmojiPicker = ({ onSelect, onClose }) => {
  const emojis = [
    '👍', '👎', '❤️', '🔥', '🚀', '⭐',
    '👀', '🤔', '🤕', '🤗', '🎉', '🎊'
  ];

  const emojiNames = [
    'thumbs up', 'thumbs down', 'heart', 'fire', 'rocket', 'star',
    'eyes', 'thinking face', 'head bandage', 'hugging face', 'party popper', 'tada'
  ];

  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50">
      <div className="grid grid-cols-4 gap-1">
        {emojis.map((emoji, index) => (
          <button
            key={index}
            onClick={() => handleEmojiClick(emoji)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-lg"
            title={emojiNames[index]}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
