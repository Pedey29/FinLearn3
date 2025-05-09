// Service Worker for FinLearn
// Version 1.0.1

const CACHE_NAME = 'finlearn-cache-v1';
const OFFLINE_PAGE = '/offline.html';
const API_CACHE_NAME = 'finlearn-api-cache-v1';
const PENDING_REVIEWS_STORE = 'pendingReviews';
const PENDING_PDF_STORE = 'pendingPdfProcessing';

// Resources to cache
const PRE_CACHED_RESOURCES = [
  '/',
  '/offline.html',
  '/study',
  '/dashboard',
  '/auth',
  '/images/logo.svg',
  '/profile'
];

// IndexedDB setup
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FinLearnDB', 1);
    
    request.onerror = (event) => reject('Error opening IndexedDB');
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for pending reviews while offline
      if (!db.objectStoreNames.contains(PENDING_REVIEWS_STORE)) {
        db.createObjectStore(PENDING_REVIEWS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      
      // Store for pending PDF processing requests
      if (!db.objectStoreNames.contains(PENDING_PDF_STORE)) {
        db.createObjectStore(PENDING_PDF_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

// Installation - cache core resources
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching resources');
        return cache.addAll(PRE_CACHED_RESOURCES);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activation - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Special handling for API requests
  if (event.request.url.includes('/api/')) {
    // For API requests, try network first, then cache
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            // Cache successful GET responses
            if (response.ok) {
              const responseToCache = response.clone();
              caches.open(API_CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return response;
          })
          .catch(() => {
            // If offline, try to serve from cache
            return caches.match(event.request);
          })
      );
      return;
    } else if (event.request.method === 'POST' && navigator.onLine === false) {
      // Handle offline POST requests to specific endpoints
      
      if (event.request.url.includes('/api/reviews')) {
        // Store review data in IndexedDB for later sync
        event.respondWith(
          event.request.json().then(reviewData => {
            return storeOfflineReview(reviewData).then(() => {
              return new Response(JSON.stringify({
                success: true,
                offline: true,
                message: 'Review stored for sync when online'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
          })
        );
        return;
      }
      
      if (event.request.url.includes('/api/generate-content')) {
        // Store PDF processing request in IndexedDB for later
        event.respondWith(
          event.request.json().then(pdfData => {
            return storeOfflinePdfRequest(pdfData).then(() => {
              return new Response(JSON.stringify({
                success: true,
                offline: true,
                message: 'PDF processing request stored for sync when online'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
          })
        );
        return;
      }
    }
    
    // For all other API requests, just try the network
    return;
  }
  
  // Skip direct supabase requests
  if (event.request.url.includes('supabase')) {
    return;
  }
  
  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If offline, show the offline page
          return caches.match(OFFLINE_PAGE);
        })
    );
    return;
  }
  
  // Standard cache then network strategy for everything else
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Cache hit - return the response
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then((response) => {
            // If the request is not a GET request, don't cache it in this block.
            // Also ensure we have a valid response to cache.
            if (event.request.method !== 'GET' || !response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the fetched GET resource
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.log('[ServiceWorker] Fetch failed:', error);
            return caches.match(OFFLINE_PAGE);
          });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncReviews());
  }
  
  if (event.tag === 'sync-pdf-requests') {
    event.waitUntil(syncPdfRequests());
  }
});

// Store offline review data in IndexedDB
async function storeOfflineReview(reviewData) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_REVIEWS_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_REVIEWS_STORE);
    const request = store.add({
      timestamp: new Date().toISOString(),
      data: reviewData
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error storing offline review');
  });
}

// Store offline PDF processing request in IndexedDB
async function storeOfflinePdfRequest(pdfData) {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_PDF_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_PDF_STORE);
    const request = store.add({
      timestamp: new Date().toISOString(),
      data: pdfData
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error storing offline PDF request');
  });
}

// Sync lesson/quiz reviews that occurred while offline
async function syncReviews() {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction([PENDING_REVIEWS_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_REVIEWS_STORE);
    const reviews = await getAllFromStore(store);
    
    // Process each stored review
    for (const review of reviews) {
      try {
        // Send to the server
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(review.data)
        });
        
        if (response.ok) {
          // If successful, delete from pending store
          await deleteFromStore(store, review.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Error syncing review:', error);
        // Keep in store to try again later
      }
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('[ServiceWorker] Error in syncReviews:', error);
    return Promise.reject(error);
  }
}

// Sync PDF processing requests that were made while offline
async function syncPdfRequests() {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction([PENDING_PDF_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_PDF_STORE);
    const requests = await getAllFromStore(store);
    
    // Process each stored PDF request
    for (const request of requests) {
      try {
        // Send to the server
        const response = await fetch('/api/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data)
        });
        
        if (response.ok) {
          // If successful, delete from pending store
          await deleteFromStore(store, request.id);
          
          // Notify the client about the completed processing
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'PDF_PROCESSED',
              timestamp: new Date().toISOString()
            });
          });
        }
      } catch (error) {
        console.error('[ServiceWorker] Error syncing PDF request:', error);
        // Keep in store to try again later
      }
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('[ServiceWorker] Error in syncPdfRequests:', error);
    return Promise.reject(error);
  }
}

// Helper to get all items from an object store
function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Error getting items from store');
  });
}

// Helper to delete an item from an object store
function deleteFromStore(store, id) {
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error deleting item from store');
  });
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 