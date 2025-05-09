'use client';

import { useEffect } from 'react';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

export default function ServiceWorkerInitializer() {
  useEffect(() => {
    // Register service worker
    serviceWorkerRegistration.register();
    
    // Request permission for notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Add online/offline network status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'network-status';
    statusIndicator.className = navigator.onLine 
      ? 'fixed top-4 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs z-50' 
      : 'fixed top-4 right-4 bg-red-500 text-white px-2 py-1 rounded text-xs z-50';
    statusIndicator.textContent = navigator.onLine ? 'Online' : 'Offline';
    document.body.appendChild(statusIndicator);
    
    return () => {
      // Clean up status indicator on unmount
      const indicator = document.getElementById('network-status');
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    };
  }, []);
  
  // This component doesn't render anything
  return null;
} 