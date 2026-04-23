import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, socket, updateUserProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    fetchProfile();
  }, [user, navigate]);

  useEffect(() => {
    // Listen for profile updates from other users
    if (socket) {
      socket.on('profileUpdate', (data) => {
        if (data.userId === user?.id) {
          setProfile(data.profile);
          updateUserProfile(data.profile);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('profileUpdate');
      }
    };
  }, [socket, user, updateUserProfile]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/profile/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setEditUsername(data.username);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile');
    }
  };

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      toast.error('Please select an image file');
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
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const uploadAvatar = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', selectedFile);
    formData.append('userId', user.id);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Avatar uploaded successfully');
        setSelectedFile(null);
        setPreviewUrl('');
        fetchProfile();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const updateProfile = async () => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: editUsername.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Profile updated successfully');
        setIsEditModalOpen(false);
        fetchProfile();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    }
  };

  const getInitials = (username) => {
    return username ? username.charAt(0).toUpperCase() : '?';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex items-center space-x-6 mb-8">
            {/* Avatar */}
            <div className="relative">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-purple-500 flex items-center justify-center text-white text-3xl font-semibold">
                  {getInitials(profile.username)}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {profile.username}
              </h1>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>Joined: {formatDate(profile.joinedAt)}</p>
                <p>Messages sent: {profile.messageCount}</p>
              </div>
            </div>

            {/* Edit Button */}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Edit Profile
            </h2>

            {/* Username Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                maxLength={30}
              />
            </div>

            {/* Avatar Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Avatar
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-20 h-20 rounded-full object-cover mx-auto"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click or drag to change
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click or drag to upload
                    </p>
                    <p className="text-xs text-gray-500">
                      JPG, PNG, GIF up to 2MB
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              {selectedFile && (
                <button
                  onClick={uploadAvatar}
                  disabled={isUploading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isUploading ? 'Uploading...' : 'Upload Avatar'}
                </button>
              )}
              <button
                onClick={updateProfile}
                disabled={!editUsername.trim() || editUsername.trim() === profile.username}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
