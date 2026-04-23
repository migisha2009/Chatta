import { useState, useEffect } from 'react';

const usePWA = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationPermission, setNotificationPermission] = useState('default');

  useEffect(() => {
    // Check PWA support
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      setIsSupported(supported);
    };

    // Check if app is already installed (running in standalone mode)
    const checkInstalled = () => {
      const installed = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
      setIsInstalled(installed);
    };

    // Check notification permission
    const checkNotificationPermission = () => {
      setNotificationPermission(Notification.permission);
    };

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    checkSupport();
    checkInstalled();
    checkNotificationPermission();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Install PWA
  const installPWA = async () => {
    if (!installPrompt) return false;

    try {
      const result = await installPrompt.prompt();
      const outcome = await result.userChoice;
      
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('PWA installation failed:', error);
      return false;
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return false;
    }
  };

  // Subscribe to push notifications
  const subscribeToPush = async () => {
    if (!isSupported || notificationPermission !== 'granted') return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY_HERE')
      });

      // Send subscription to server
      await sendSubscriptionToServer(subscription);
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  };

  // Show local notification
  const showNotification = (title, options = {}) => {
    if (notificationPermission !== 'granted') return;

    const notification = new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  };

  // Store message offline
  const storeOfflineMessage = async (message) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('chatta-offline', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const addRequest = store.add({
          ...message,
          id: message.id || Date.now().toString(),
          timestamp: Date.now(),
          synced: false
        });
        
        addRequest.onsuccess = () => resolve(addRequest.result);
        addRequest.onerror = () => reject(addRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id' });
        }
      };
    });
  };

  // Get offline messages
  const getOfflineMessages = async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('chatta-offline', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id' });
        }
      };
    });
  };

  // Sync offline messages
  const syncOfflineMessages = async () => {
    try {
      const messages = await getOfflineMessages();
      const unsyncedMessages = messages.filter(msg => !msg.synced);
      
      for (const message of unsyncedMessages) {
        try {
          const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
          });
          
          if (response.ok) {
            // Mark as synced
            await markMessageAsSynced(message.id);
          }
        } catch (error) {
          console.error('Failed to sync message:', error);
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // Helper functions
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  };

  const sendSubscriptionToServer = async (subscription) => {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  };

  const markMessageAsSynced = async (messageId) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('chatta-offline', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const updateRequest = store.put({
          id: messageId,
          synced: true
        });
        
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };
    });
  };

  return {
    // PWA Status
    isSupported,
    isInstalled,
    isOnline,
    notificationPermission,
    canInstall: !!installPrompt,
    
    // Actions
    installPWA,
    requestNotificationPermission,
    subscribeToPush,
    showNotification,
    storeOfflineMessage,
    getOfflineMessages,
    syncOfflineMessages
  };
};

export default usePWA;
