'use client';

// This optional code is used to register a service worker.
// register() is not called by default.

// Extending ServiceWorkerRegistration type to include sync
declare global {
  interface ServiceWorkerRegistration {
    sync: {
      register(tag: string): Promise<void>;
    };
  }
}

export function register() {
  // Register service worker only in production and if the browser supports it
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
    );

    window.addEventListener('load', () => {
      const swUrl = '/service-worker.js';

      if (isLocalhost) {
        // Running on localhost. Check if a service worker still exists or not.
        checkValidServiceWorker(swUrl);
      } else {
        // Not localhost. Just register service worker
        registerValidSW(swUrl);
      }
    });

    // Add event listeners for online/offline status changes
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Register a callback for service worker messages
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
  }
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      // Check for updates on page load
      registration.update();
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated content has been fetched
              console.log('New content is available and will be used when all tabs are closed.');
              
              // Optionally show a notification to refresh the page
              showUpdateNotification();
            } else {
              // At this point, everything has been precached.
              console.log('Content is cached for offline use.');
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl: string) {
  // Check if the service worker can be found.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

// Function to handle online/offline status changes
function handleOnlineStatusChange() {
  const statusElement = document.getElementById('network-status');
  
  if (statusElement) {
    if (navigator.onLine) {
      statusElement.textContent = 'Online';
      statusElement.className = 'bg-green-500 text-white px-2 py-1 rounded text-xs';
      
      // Trigger background sync
      triggerBackgroundSync();
    } else {
      statusElement.textContent = 'Offline';
      statusElement.className = 'bg-red-500 text-white px-2 py-1 rounded text-xs';
    }
  }
}

// Function to trigger background sync
function triggerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      // Sync review data
      registration.sync.register('sync-reviews');
      
      // Sync PDF processing requests
      registration.sync.register('sync-pdf-requests');
    });
  }
}

// Function to handle service worker messages
function handleServiceWorkerMessage(event: MessageEvent) {
  if (event.data && event.data.type === 'PDF_PROCESSED') {
    console.log('PDF processing completed:', event.data.timestamp);
    
    // Show notification to the user
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('FinLearn', {
        body: 'Your PDF has been processed successfully!',
        icon: '/images/icon-192.png'
      });
    }
  }
}

// Function to show an update notification
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50';
  notification.innerHTML = `
    <div class="flex items-center justify-between">
      <div>New content is available!</div>
      <button id="update-button" class="ml-4 bg-white text-blue-600 px-3 py-1 rounded hover:bg-blue-100">
        Update
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  document.getElementById('update-button')?.addEventListener('click', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  });
} 