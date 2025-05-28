const DB_NAME = "IntentionTubeDB";
const DB_VERSION = 3;
const ATTEMPTS_STORE = "attempts";
const TIMESTAMPS_STORE = "watchTimestamps";

var db;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Error opening database:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      const transaction = event.target.transaction;

      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const store = db.createObjectStore(ATTEMPTS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("videoId", "videoId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("outcome", "outcome", { unique: false });
      }

      if (!db.objectStoreNames.contains(TIMESTAMPS_STORE)) {
        const store = db.createObjectStore(TIMESTAMPS_STORE);
        store.createIndex("videoId", "videoId", { unique: true });
      }
    };
  });
}

export function saveAttempt(params) {
  const { videoId, outcome, reason, title = "Unknown Title" } = params;
  return new Promise(async (resolve, reject) => {
    try {
      if (!videoId) {
        return reject("Video ID is required for saving an attempt.");
      }

      const transaction = db.transaction([ATTEMPTS_STORE], "readwrite");
      const store = transaction.objectStore(ATTEMPTS_STORE);

      const record = {
        videoId,
        timestamp: new Date().toISOString(),
        outcome,
        reason: outcome === "watched" ? reason : null,
        title,
      };

      const request = store.add(record);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("Error saving attempt:", event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error("Error in saveAttempt:", error);
      reject(error);
    }
  });
}

export function updateAttemptOutcome(params) {
  const { attemptId, outcome, reason = null } = params;
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = db.transaction([ATTEMPTS_STORE], "readwrite");
      const store = transaction.objectStore(ATTEMPTS_STORE);

      const getRequest = store.get(attemptId);

      getRequest.onsuccess = () => {
        const attempt = getRequest.result;
        if (attempt) {
          attempt.outcome = outcome;
          attempt.reason = outcome === "watched" ? reason : null;

          const updateRequest = store.put(attempt);

          updateRequest.onsuccess = () => {
            resolve();
          };
          updateRequest.onerror = (event) => {
            console.error(
              `Error updating attempt ${attemptId}:`,
              event.target.error
            );
            reject(event.target.error);
          };
        } else {
          console.error(`Attempt with ID ${attemptId} not found for update.`);
          reject(`Attempt with ID ${attemptId} not found.`);
        }
      };

      getRequest.onerror = (event) => {
        console.error(
          `Error fetching attempt ${attemptId} for update:`,
          event.target.error
        );
        reject(event.target.error);
      };
    } catch (error) {
      console.error("Error in updateAttemptOutcome:", error);
      reject(error);
    }
  });
}

export function getAllAttempts() {
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = db.transaction([ATTEMPTS_STORE], "readonly");
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("Error getting all attempts:", event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error("Error in getAllAttempts:", error);
      reject(error);
    }
  });
}

export function getAttemptStats() {
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = db.transaction([ATTEMPTS_STORE], "readonly");
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const attempts = request.result;
        const watchedCount = attempts.filter(
          (a) => a.outcome === "watched"
        ).length;
        const cancelledCount = attempts.filter(
          (a) => a.outcome === "cancelled"
        ).length;
        const total = watchedCount + cancelledCount;
        const intentionalityRate =
          total > 0 ? Math.round((cancelledCount / total) * 100) : 0;

        const stats = {
          total,
          watched: watchedCount,
          cancelled: cancelledCount,
          intentionalityRate,
        };

        resolve(stats);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

export async function clearAllAttempts() {
  return new Promise(async (resolve, reject) => {
    try {
      const transaction = db.transaction([ATTEMPTS_STORE], "readwrite");
      const store = transaction.objectStore(ATTEMPTS_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error("Error clearing attempts:", event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error("Error in clearAllAttempts:", error);
      reject(error);
    }
  });
}

export function saveWatchTimestamp(params) {
  const { videoId, timestamp } = params;
  return new Promise(async (resolve, reject) => {
    if (!videoId) return reject("Video ID is required");
    try {
      const transaction = db.transaction([TIMESTAMPS_STORE], "readwrite");
      const store = transaction.objectStore(TIMESTAMPS_STORE);
      const request = store.put(timestamp, videoId);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

export function getWatchTimestamp(videoId) {
  return new Promise(async (resolve, reject) => {
    if (!videoId) return reject("Video ID is required");
    try {
      const transaction = db.transaction([TIMESTAMPS_STORE], "readonly");
      const store = transaction.objectStore(TIMESTAMPS_STORE);
      const request = store.get(videoId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}

export function deleteWatchTimestamp(videoId) {
  return new Promise(async (resolve, reject) => {
    if (!videoId) return reject("Video ID is required");
    try {
      const transaction = db.transaction([TIMESTAMPS_STORE], "readwrite");
      const store = transaction.objectStore(TIMESTAMPS_STORE);
      const request = store.delete(videoId);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    } catch (error) {
      reject(error);
    }
  });
}
