import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const JoinPage = () => {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [socket, setSocket] = useState(null);
  
  const navigate = useNavigate();
  
  const suggestedRooms = ['General', 'Tech', 'Gaming', 'Music'];
  
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);
    
    newSocket.on('usernameTaken', (data) => {
      setError(data.message || 'Username is already taken in this room');
      setIsJoining(false);
    });
    
    newSocket.on('error', (data) => {
      setError(data.message || 'An error occurred');
      setIsJoining(false);
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, []);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !room.trim()) {
      setError('Please enter both username and room name');
      return;
    }
    
    if (username.trim().length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    
    setIsJoining(true);
    setError('');
    
    if (socket) {
      // Store user data in localStorage for ChatPage to use
      localStorage.setItem('chatUser', JSON.stringify({
        username: username.trim(),
        room: room.trim()
      }));
      
      // Join the room
      socket.emit('joinRoom', {
        username: username.trim(),
        room: room.trim()
      });
      
      // Navigate to chat page after a short delay
      setTimeout(() => {
        navigate('/chat');
      }, 500);
    }
  };
  
  const isFormValid = username.trim().length > 0 && room.trim().length > 0 && !isJoining;
  
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo and App Name */}
        <div className="flex flex-col items-center mb-8">
          {/* Speech Bubble SVG Icon */}
          <div className="mb-4">
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-violet-600"
            >
              <path
                d="M8 10.5C8 9.67157 8.67157 9 9.5 9H14.5C15.3284 9 16 9.67157 16 10.5V13.5C16 14.3284 15.3284 15 14.5 15H9.5C8.67157 15 8 14.3284 8 13.5V10.5Z"
                fill="currentColor"
              />
              <path
                d="M7.5 15L5 18L6.5 15H7.5Z"
                fill="currentColor"
              />
              <path
                d="M16.5 15L19 18L17.5 15H16.5Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Chatta</h1>
          <p className="text-slate-600 mt-2">Real-time chat application</p>
        </div>
        
        {/* Join Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              maxLength={20}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none transition-all"
              placeholder="Enter your username"
              disabled={isJoining}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum 20 characters</p>
          </div>
          
          {/* Room Input/Dropdown */}
          <div>
            <label htmlFor="room" className="block text-sm font-medium text-slate-700 mb-2">
              Room Name
            </label>
            <select
              id="room"
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setError('');
              }}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none transition-all"
              disabled={isJoining}
            >
              <option value="">Select a room...</option>
              {suggestedRooms.map((suggestedRoom) => (
                <option key={suggestedRoom} value={suggestedRoom}>
                  {suggestedRoom}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setError('');
              }}
              placeholder="Or enter a custom room name..."
              className="w-full mt-2 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:border-transparent outline-none transition-all"
              disabled={isJoining}
              maxLength={30}
            />
            <p className="text-xs text-slate-500 mt-1">Join an existing room or create a new one</p>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              isFormValid
                ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isJoining ? 'Joining...' : 'Join Chat'}
          </button>
        </form>
        
        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Connect with people in real-time</p>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;
