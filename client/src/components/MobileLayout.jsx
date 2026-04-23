import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MobileLayout = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                           window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/chat') setActiveTab('chat');
    else if (path === '/join') setActiveTab('join');
    else if (path === '/profile') setActiveTab('profile');
    else if (path === '/rooms') setActiveTab('rooms');
  }, [location]);

  // Handle swipe gestures
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    // Handle swipe navigation
    if (isLeftSwipe && activeTab === 'chat') {
      navigate('/rooms');
    } else if (isRightSwipe && activeTab === 'rooms') {
      navigate('/chat');
    }
  };

  // Handle tab navigation
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    
    switch (tab) {
      case 'chat':
        navigate('/chat');
        break;
      case 'join':
        navigate('/join');
        break;
      case 'rooms':
        navigate('/rooms');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'menu':
        setIsMenuOpen(!isMenuOpen);
        break;
      default:
        break;
    }
  };

  // Bottom navigation items
  const navItems = [
    { id: 'chat', icon: '💬', label: 'Chat' },
    { id: 'join', icon: '➕', label: 'Join' },
    { id: 'rooms', icon: '🏠', label: 'Rooms' },
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'menu', icon: '☰', label: 'Menu' }
  ];

  if (!isMobile) {
    return <div>{children}</div>;
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Chatta</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Online Status Indicator */}
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Online</span>
          
          {/* Notifications Button */}
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {children}
        
        {/* Slide-out Menu */}
        <div className={`absolute inset-0 bg-black bg-opacity-50 z-40 transition-opacity ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`} onClick={() => setIsMenuOpen(false)}>
          <div 
            className={`absolute top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform ${
              isMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
            </div>
            
            <nav className="p-4 space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3">
                <span className="text-xl">⚙️</span>
                <span className="text-gray-700 dark:text-gray-300">Settings</span>
              </button>
              
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3">
                <span className="text-xl">🔍</span>
                <span className="text-gray-700 dark:text-gray-300">Search</span>
              </button>
              
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3">
                <span className="text-xl">📊</span>
                <span className="text-gray-700 dark:text-gray-300">Analytics</span>
              </button>
              
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3">
                <span className="text-xl">❓</span>
                <span className="text-gray-700 dark:text-gray-300">Help</span>
              </button>
              
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center space-x-3">
                <span className="text-xl">🚪</span>
                <span className="text-red-600 dark:text-red-400">Logout</span>
              </button>
            </nav>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                activeTab === item.id
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
              {activeTab === item.id && (
                <div className="w-1 h-1 bg-purple-600 dark:bg-purple-400 rounded-full mt-1"></div>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Haptic Feedback (if supported) */}
      <style jsx>{`
        @media (hover: none) {
          button:active {
            transform: scale(0.95);
          }
        }
      `}</style>
    </div>
  );
};

export default MobileLayout;
