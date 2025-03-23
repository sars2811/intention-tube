// Database operations for Intention Tube
const DB_NAME = 'IntentionTubeDB';
const DB_VERSION = 1;
const REASONS_STORE = 'reasons';

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
      
      // Create object store for reasons
      if (!db.objectStoreNames.contains(REASONS_STORE)) {
        const store = db.createObjectStore(REASONS_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('videoUrl', 'videoUrl', { unique: false });
        store.createIndex('watched', 'watched', { unique: false });
      }
    };
  });
}

// Save a reason to the database
function saveReason(reason, videoUrl, watched = true) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([REASONS_STORE], 'readwrite');
      const store = transaction.objectStore(REASONS_STORE);
      
      const record = {
        reason,
        videoUrl,
        timestamp: new Date().toISOString(),
        watched
      };
      
      const request = store.add(record);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error saving reason:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in saveReason:', error);
      reject(error);
    }
  });
}

// Get all reasons from the database
function getAllReasons() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([REASONS_STORE], 'readonly');
      const store = transaction.objectStore(REASONS_STORE);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error getting reasons:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in getAllReasons:', error);
      reject(error);
    }
  });
}

// Get statistics about watch behavior
function getWatchStats() {
  return new Promise(async (resolve, reject) => {
    try {
      const reasons = await getAllReasons();
      
      const stats = {
        total: reasons.length,
        watched: reasons.filter(r => r.watched).length,
        cancelled: reasons.filter(r => !r.watched).length
      };
      
      resolve(stats);
    } catch (error) {
      console.error('Error in getWatchStats:', error);
      reject(error);
    }
  });
}

// Clear all reasons from the database
function clearAllReasons() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([REASONS_STORE], 'readwrite');
      const store = transaction.objectStore(REASONS_STORE);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error clearing reasons:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('Error in clearAllReasons:', error);
      reject(error);
    }
  });
}

// Export the functions
window.IntentionTubeDB = {
  saveReason,
  getAllReasons,
  getWatchStats,
  clearAllReasons
};
