// Database operations for Intention Tube
const DB_NAME = 'IntentionTubeDB';
const DB_VERSION = 3; // Incremented version for schema change
const ATTEMPTS_STORE = 'attempts'; // Renamed from reasons
const TIMESTAMPS_STORE = 'watchTimestamps';

// Initialize the database
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening database:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction; // Use transaction for safety

      // Create new 'attempts' store
      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const store = db.createObjectStore(ATTEMPTS_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('videoId', 'videoId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('outcome', 'outcome', { unique: false }); // 'watched' or 'cancelled'
        console.log("'attempts' store created.");
      }

      // Create object store for watch timestamps (using videoId as key)
      if (!db.objectStoreNames.contains(TIMESTAMPS_STORE)) {
        db.createObjectStore(TIMESTAMPS_STORE);
        console.log("'watchTimestamps' store created/ensured.");
      }
    };
  });
}

// Save an attempt to the database
function saveAttempt(videoId, outcome, reason = null, title = 'Unknown Title') {
  return new Promise(async (resolve, reject) => {
    try {
      if (!videoId) {
        return reject('Video ID is required for saving an attempt.');
      }

      const db = await initDB();
      const transaction = db.transaction([ATTEMPTS_STORE], 'readwrite');
      const store = transaction.objectStore(ATTEMPTS_STORE);

      const record = {
        videoId,
        timestamp: new Date().toISOString(),
        outcome, // 'watched' or 'cancelled'
        reason: outcome === 'watched' ? reason : null, // Only save reason if watched
        title,
      };

      const request = store.add(record);

      request.onsuccess = () => {
        console.log(`Attempt saved (pending): Video ${videoId}, ID: ${request.result}`);
        resolve(request.result); // IMPORTANT: Resolve with the new record's ID
      };

      request.onerror = (event) => {
        console.error('Error saving attempt:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in saveAttempt:', error);
      reject(error);
    }
  });
}

// Update the outcome and reason of an existing attempt
function updateAttemptOutcome(attemptId, outcome, reason = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([ATTEMPTS_STORE], 'readwrite');
      const store = transaction.objectStore(ATTEMPTS_STORE);

      const getRequest = store.get(attemptId);

      getRequest.onsuccess = () => {
        const attempt = getRequest.result;
        if (attempt) {
          attempt.outcome = outcome;
          attempt.reason = outcome === 'watched' ? reason : null; // Only store reason if watched

          const updateRequest = store.put(attempt);

          updateRequest.onsuccess = () => {
            console.log(`Attempt updated: ID ${attemptId}, New Outcome: ${outcome}`);
            resolve();
          };
          updateRequest.onerror = (event) => {
            console.error(`Error updating attempt ${attemptId}:`, event.target.error);
            reject(event.target.error);
          };
        } else {
          console.error(`Attempt with ID ${attemptId} not found for update.`);
          reject(`Attempt with ID ${attemptId} not found.`);
        }
      };

      getRequest.onerror = (event) => {
        console.error(`Error fetching attempt ${attemptId} for update:`, event.target.error);
        reject(event.target.error);
      };

    } catch (error) {
      console.error('Error in updateAttemptOutcome:', error);
      reject(error);
    }
  });
}

// Get all attempts from the database
function getAllAttempts() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([ATTEMPTS_STORE], 'readonly');
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error('Error getting all attempts:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in getAllAttempts:', error);
      reject(error);
    }
  });
}

// Get attempt statistics
function getAttemptStats() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([ATTEMPTS_STORE], 'readonly');
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const attempts = request.result;
        const watchedCount = attempts.filter(a => a.outcome === 'watched').length;
        const cancelledCount = attempts.filter(a => a.outcome === 'cancelled').length;
        const total = watchedCount + cancelledCount;
        const intentionalityRate = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

        const stats = {
          total,
          watched: watchedCount,
          cancelled: cancelledCount,
          intentionalityRate,
        };

        resolve(stats);
      };

      request.onerror = (event) => {
        console.error('Error getting attempt stats:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in getAttemptStats:', error);
      reject(error);
    }
  });
}

// Clear all attempts from the database
function clearAllAttempts() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([ATTEMPTS_STORE], 'readwrite');
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error('Error clearing attempts:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in clearAllAttempts:', error);
      reject(error);
    }
  });
}

// Save/Update watch timestamp for a video ID
function saveWatchTimestampDB(videoId, timestamp) {
  return new Promise(async (resolve, reject) => {
    if (!videoId) return reject('Video ID is required');
    try {
      const db = await initDB();
      const transaction = db.transaction([TIMESTAMPS_STORE], 'readwrite');
      const store = transaction.objectStore(TIMESTAMPS_STORE);
      const request = store.put(timestamp, videoId); // Use videoId as key

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Get watch timestamp for a video ID
function getWatchTimestampDB(videoId) {
  return new Promise(async (resolve, reject) => {
    if (!videoId) return reject('Video ID is required');
    try {
      const db = await initDB();
      const transaction = db.transaction([TIMESTAMPS_STORE], 'readonly');
      const store = transaction.objectStore(TIMESTAMPS_STORE);
      const request = store.get(videoId); // Get by videoId key

      request.onsuccess = () => resolve(request.result); // Returns timestamp or undefined
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Delete watch timestamp for a video ID
function deleteWatchTimestampDB(videoId) {
  return new Promise(async (resolve, reject) => {
    if (!videoId) return reject('Video ID is required');
    try {
      const db = await initDB();
      const transaction = db.transaction([TIMESTAMPS_STORE], 'readwrite');
      const store = transaction.objectStore(TIMESTAMPS_STORE);
      const request = store.delete(videoId); // Delete by videoId key

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Export the functions
window.IntentionTubeDB = {
  saveAttempt,        
  getAllAttempts,
  getAttemptStats,    
  clearAllAttempts,   
  updateAttemptOutcome, 
  saveWatchTimestampDB,
  getWatchTimestampDB,
  deleteWatchTimestampDB
};
