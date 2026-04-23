import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const Onboarding = ({ onComplete, user }) => {
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const navigate = useNavigate();
  const tooltipRefs = useRef([]);

  const onboardingSteps = [
    {
      id: 'welcome',
      title: 'Welcome to Chatta! 🎉',
      description: 'Let\'s get you started with a quick tour of our real-time chat application.',
      component: 'WelcomeStep',
      target: null,
      position: 'center'
    },
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add a profile picture and bio to personalize your experience.',
      component: 'ProfileStep',
      target: '.profile-button',
      position: 'bottom'
    },
    {
      id: 'join-room',
      title: 'Join or Create a Room',
      description: 'Connect with others by joining existing rooms or creating your own.',
      component: 'JoinStep',
      target: '.join-room-button',
      position: 'bottom'
    },
    {
      id: 'chat-interface',
      title: 'Chat Interface',
      description: 'Send messages, share files, use emojis, and enjoy real-time communication.',
      component: 'ChatStep',
      target: '.message-input',
      position: 'top'
    },
    {
      id: 'ai-features',
      title: 'AI-Powered Features',
      description: 'Use @ChattaBot for assistance, search messages, and enjoy smart suggestions.',
      component: 'AIStep',
      target: '.ai-button',
      position: 'left'
    },
    {
      id: 'voice-messages',
      title: 'Voice Messages',
      description: 'Record and send voice messages for more personal communication.',
      component: 'VoiceStep',
      target: '.voice-button',
      position: 'left'
    },
    {
      id: 'mobile-app',
      title: 'Install as Mobile App',
      description: 'Install Chatta on your device for the best experience with offline support.',
      component: 'MobileStep',
      target: '.install-button',
      position: 'top'
    },
    {
      id: 'complete',
      title: 'You\'re All Set! 🚀',
      description: 'You\'ve completed the onboarding. Start chatting and exploring all features.',
      component: 'CompleteStep',
      target: null,
      position: 'center'
    }
  ];

  useEffect(() => {
    // Check if user has already completed onboarding
    const completedOnboarding = localStorage.getItem('chatta-onboarding-completed');
    if (completedOnboarding && user) {
      onComplete();
      return;
    }

    // Add keyboard navigation
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'Escape') handleSkip();
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleNext = () => {
    if (step < onboardingSteps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    setSkipped(true);
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('chatta-onboarding-completed', 'true');
    onComplete();
  };

  const currentStep = onboardingSteps[step];

  const WelcomeStep = () => (
    <div className="text-center">
      <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">💬</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        {currentStep.description}
      </p>
      <div className="flex justify-center space-x-4">
        <button
          onClick={handleSkip}
          className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Skip Tour
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Start Tour
        </button>
      </div>
    </div>
  );

  const ProfileStep = () => (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quick Tips:</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Upload a profile picture to be easily recognizable</li>
          <li>• Add a bio to tell others about yourself</li>
          <li>• Set your status (Online, Away, Busy)</li>
          <li>• Customize your notification preferences</li>
        </ul>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );

  const JoinStep = () => (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Room Types:</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• <strong>Public:</strong> Anyone can join and see messages</li>
          <li>• <strong>Private:</strong> Invite-only, secure conversations</li>
          <li>• <strong>Protected:</strong> Password-protected rooms</li>
        </ul>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );

  const ChatStep = () => (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Chat Features:</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Real-time messaging with typing indicators</li>
          <li>• Rich text formatting and emojis</li>
          <li>• File sharing and voice messages</li>
          <li>• Message reactions and threading</li>
          <li>• Search and message history</li>
        </ul>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );

  const AIStep = () => (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI Features:</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• <strong>@ChattaBot:</strong> AI assistant for help and information</li>
          <li>• <strong>Smart Search:</strong> Find messages using natural language</li>
          <li>• <strong>Auto-complete:</strong> Smart suggestions while typing</li>
          <li>• <strong>Room Summaries:</strong> AI-generated conversation summaries</li>
        </ul>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );

  const VoiceStep = () => (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Voice Features:</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Record voice messages with visual feedback</li>
          <li>• Pause and resume recording</li>
          <li>• Audio level visualization</li>
          <li>• Playback controls and speed adjustment</li>
        </ul>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );

  const MobileStep = () => (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">PWA Benefits:</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Works offline with message queuing</li>
          <li>• Push notifications for new messages</li>
          <li>• Faster loading and smoother experience</li>
          <li>• Native app-like interface</li>
          <li>• Automatic updates</li>
        </ul>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );

  const CompleteStep = () => (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">🎉</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        {currentStep.title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        {currentStep.description}
      </p>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 max-w-md mx-auto">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">What's Next?</h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 text-left">
          <li>• Explore different chat rooms</li>
          <li>• Connect with other users</li>
          <li>• Try out AI features</li>
          <li>• Customize your profile</li>
        </ul>
      </div>
      <button
        onClick={handleComplete}
        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        Start Chatting
      </button>
    </div>
  );

  const renderStep = () => {
    switch (currentStep.component) {
      case 'WelcomeStep': return <WelcomeStep />;
      case 'ProfileStep': return <ProfileStep />;
      case 'JoinStep': return <JoinStep />;
      case 'ChatStep': return <ChatStep />;
      case 'AIStep': return <AIStep />;
      case 'VoiceStep': return <VoiceStep />;
      case 'MobileStep': return <MobileStep />;
      case 'CompleteStep': return <CompleteStep />;
      default: return <WelcomeStep />;
    }
  };

  // Don't render if onboarding is completed or no user
  if (!user || localStorage.getItem('chatta-onboarding-completed')) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-t-xl overflow-hidden">
          <div 
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${((step + 1) / onboardingSteps.length) * 100}%` }}
          />
        </div>

        {/* Step Counter */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Step {step + 1} of {onboardingSteps.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Skip Tour
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {renderStep()}
        </div>

        {/* Navigation Dots */}
        <div className="px-6 pb-6">
          <div className="flex justify-center space-x-2">
            {onboardingSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === step ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
