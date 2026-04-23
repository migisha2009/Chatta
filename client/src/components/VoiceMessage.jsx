import React, { useState, useRef, useEffect } from 'react';

const VoiceMessage = ({ audio, duration, username, isOwn = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', () => {
      audio.playbackRate = playbackSpeed;
    });

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', () => {});
    };
  }, [playbackSpeed]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audio.duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg ${
      isOwn 
        ? 'bg-purple-100 dark:bg-purple-900/30 ml-auto max-w-xs' 
        : 'bg-gray-100 dark:bg-gray-800 max-w-xs'
    }`}>
      {/* Voice message icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        isOwn 
          ? 'bg-purple-500 text-white' 
          : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
      }`}>
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4v16l8-8-8-8z"/>
            <rect x="16" y="4" width="4" height="16"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </div>

      {/* Voice content */}
      <div className="flex-1 min-w-0">
        {/* Username */}
        <div className={`text-xs font-medium mb-1 ${
          isOwn ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'
        }`}>
          {username}
        </div>

        {/* Audio player */}
        <div className="space-y-2">
          {/* Progress bar */}
          <div 
            ref={progressBarRef}
            className="relative h-1 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer overflow-hidden"
            onClick={handleProgressClick}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-purple-500 rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={togglePlayPause}
              className={`p-1 rounded-full transition-colors ${
                isOwn 
                  ? 'hover:bg-purple-200 dark:hover:bg-purple-800' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            <button
              onClick={toggleSpeed}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isOwn 
                  ? 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audio}
        preload="metadata"
      />
    </div>
  );
};

export default VoiceMessage;
