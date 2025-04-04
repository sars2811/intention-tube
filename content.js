// Content script for Intention Tube
// Use a namespace to avoid variable redeclaration issues
window.intentionTube = window.intentionTube || {
  videoBlocked: false,
  timerInterval: null,
  originalVideoState: null,
  settings: { 
    blockingDuration: 5, 
    isEnabled: true, 
    watchTimeLimit: 2 // Default watch time limit in hours
  }
};

// Get settings from storage on initialization
function getSettingsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        window.intentionTube.settings = result.settings;
      }
      resolve(window.intentionTube.settings);
    });
  });
}

// Create and inject the blocker overlay
async function createBlockerOverlay() { 
  // Check if overlay already exists
  if (document.getElementById('intention-tube-overlay')) {
    return;
  }

  // First, add a style to prevent scrolling on the body
  const bodyStyle = document.createElement('style');
  bodyStyle.id = 'intention-tube-body-style';
  bodyStyle.textContent = `body, html { overflow: hidden !important; }`;
  document.head.appendChild(bodyStyle);

  // Inject the CSS file
  const cssLink = document.createElement('link');
  cssLink.id = 'intention-tube-styles';
  cssLink.rel = 'stylesheet';
  cssLink.type = 'text/css';
  cssLink.href = chrome.runtime.getURL('overlay.css');
  document.head.appendChild(cssLink);

  // Create the main overlay div (for background dimming and positioning)
  const overlay = document.createElement('div');
  overlay.id = 'intention-tube-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
    pointer-events: none; 
  `;

  try {
    const response = await fetch(chrome.runtime.getURL('overlay.html'));
    if (!response.ok) {
      throw new Error(`Failed to fetch overlay.html: ${response.statusText}`);
    }
    const htmlText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const container = doc.querySelector('#intention-tube-container');

    if (!container) {
      throw new Error('#intention-tube-container not found in overlay.html');
    }
    
    container.style.pointerEvents = 'auto'; 
    overlay.appendChild(container); 
    document.body.appendChild(overlay); 

    const timer = overlay.querySelector('#intention-tube-timer');
    const reasonInput = overlay.querySelector('#intention-tube-reason');
    const watchButton = overlay.querySelector('#intention-tube-watch');
    const cancelButton = overlay.querySelector('#intention-tube-cancel');

    timer.textContent = `Wait ${window.intentionTube.settings.blockingDuration} seconds`;
    watchButton.disabled = true; 

    let timeLeft = window.intentionTube.settings.blockingDuration;
    window.intentionTube.timerInterval = setInterval(() => {
      timeLeft--;
      timer.textContent = timeLeft > 0 ? `Wait ${timeLeft} seconds` : 'Enter your reason to proceed';
      
      if (timeLeft <= 0) {
        clearInterval(window.intentionTube.timerInterval);
        checkReasonInput(); 
      }
    }, 1000);

    function checkReasonInput() {
      const reason = reasonInput.value.trim();
      watchButton.disabled = !reason;
    }
    
    reasonInput.addEventListener('input', checkReasonInput);

    watchButton.addEventListener('click', () => {
      if (!watchButton.disabled) {
        const reason = reasonInput.value.trim();
        const videoId = getVideoIdFromUrl(window.location.href);
        if (reason) {
          saveToIndexedDB(reason, true);
          if (videoId) {
            saveWatchTimestamp(videoId); // Save timestamp when unblocked
          }
          removeOverlay();
          resumeVideo();
        } else {
          alert('Please enter a reason for watching this video.');
        }
      }
    });

    cancelButton.addEventListener('click', () => {
      const reason = reasonInput.value.trim();
      if (reason) {
        saveToIndexedDB(reason, false);
      }
      chrome.runtime.sendMessage({ action: "closeTab" });
    });

  } catch (error) {
    console.error("Error creating Intention Tube overlay:", error);
    removeOverlay(); 
  }
}

// Helper function to extract video ID from YouTube URL
function getVideoIdFromUrl(url) {
  try {
    const urlObject = new URL(url);
    if (urlObject.hostname.includes('youtube.com') && urlObject.pathname === '/watch') {
      return urlObject.searchParams.get('v');
    }
  } catch (e) {
    console.error("Error parsing URL:", url, e);
  }
  return null;
}

// Save reason to IndexedDB
function saveToIndexedDB(reason, watched) {
  const currentUrl = window.location.href;
  const videoId = getVideoIdFromUrl(currentUrl);

  if (!videoId) {
    console.error("Could not extract video ID from URL:", currentUrl);
    return; 
  }
  
  const request = indexedDB.open('IntentionTubeDB', 1);
  
  request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
  };
  
  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    
    if (!db.objectStoreNames.contains('reasons')) {
      const store = db.createObjectStore('reasons', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('videoUrl', 'videoUrl', { unique: false });
      store.createIndex('watched', 'watched', { unique: false });
    }
  };
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['reasons'], 'readwrite');
    const store = transaction.objectStore('reasons');
    
    const data = {
      reason: reason,
      timestamp: new Date(),
      videoUrl: videoId, 
      watched: watched,
      title: document.title 
    };
    
    store.add(data);
  };
}

// Save the timestamp when a video was unblocked
async function saveWatchTimestamp(videoId) {
  if (!videoId) return;
  const key = `watchTimestamp_${videoId}`;
  const data = {};
  data[key] = Date.now();
  try {
    await chrome.storage.local.set(data);
    console.log(`Timestamp saved for video ${videoId}`);
  } catch (error) {
    console.error(`Error saving timestamp for video ${videoId}:`, error);
  }
}

// Check if the allowed watch time has expired
async function hasWatchTimeExpired(videoId) {
  if (!videoId) return true; // If no video ID, assume expired/block

  const key = `watchTimestamp_${videoId}`;
  try {
    const result = await chrome.storage.local.get(key);
    const timestamp = result[key];

    if (!timestamp) {
      console.log(`No timestamp found for video ${videoId}, blocking.`);
      return true; // No timestamp means it wasn't unblocked recently
    }

    const watchTimeLimitHours = window.intentionTube.settings.watchTimeLimit || 2; // Use default if setting not loaded
    const watchTimeLimitMillis = watchTimeLimitHours * 60 * 60 * 1000;
    const expiryTime = timestamp + watchTimeLimitMillis;

    if (Date.now() >= expiryTime) {
      // Time expired, remove the timestamp
      await chrome.storage.local.remove(key);
      return true;
    } else {
      // Time is still valid
      return false;
    }
  } catch (error) {
    console.error(`Error checking timestamp for video ${videoId}:`, error);
    return true; // Assume expired on error
  }
}

// Remove the blocker overlay
function removeOverlay() {
  const overlay = document.getElementById('intention-tube-overlay');
  if (overlay) {
    overlay.remove();
  }

  const bodyStyle = document.getElementById('intention-tube-body-style');
  if (bodyStyle) {
    bodyStyle.remove();
  }

  const cssLink = document.getElementById('intention-tube-styles');
  if (cssLink) {
    cssLink.remove();
  }

  if (window.intentionTube.timerInterval) {
    clearInterval(window.intentionTube.timerInterval);
    window.intentionTube.timerInterval = null;
  }
  window.intentionTube.videoBlocked = false;
}

// Pause the YouTube video
function pauseVideo() {
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    window.intentionTube.originalVideoState = {
      paused: video.paused,
      currentTime: video.currentTime,
      muted: video.muted
    };
    
    video.pause();
    
    video.muted = true;
  });
  
  const pauseButton = document.querySelector('.ytp-play-button');
  if (pauseButton) {
    if (pauseButton.getAttribute('aria-label')?.includes('Pause') || 
        pauseButton.getAttribute('title')?.includes('Pause')) {
      pauseButton.click();
    }
  }
  
  if (window.yt && window.yt.player && window.yt.player.getPlayerByElement) {
    try {
      const playerContainer = document.querySelector('#movie_player');
      if (playerContainer) {
        const player = window.yt.player.getPlayerByElement(playerContainer);
        if (player && typeof player.pauseVideo === 'function') {
          player.pauseVideo();
        }
      }
    } catch (e) {
      console.error('Error using YouTube Player API:', e);
    }
  }
  
  if (window.pauseCheckInterval) {
    clearInterval(window.pauseCheckInterval);
  }
  
  window.pauseCheckInterval = setInterval(() => {
    if (window.intentionTube.videoBlocked) {
      videoElements.forEach(video => {
        if (!video.paused) {
          video.pause();
          video.muted = true;
        }
      });
    } else {
      clearInterval(window.pauseCheckInterval);
    }
  }, 500); 
}

// Resume the YouTube video
function resumeVideo() {
  if (window.pauseCheckInterval) {
    clearInterval(window.pauseCheckInterval);
  }
  
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    if (window.intentionTube.originalVideoState && window.intentionTube.originalVideoState.hasOwnProperty('muted')) {
      video.muted = window.intentionTube.originalVideoState.muted;
    }
    
    if (window.intentionTube.originalVideoState && !window.intentionTube.originalVideoState.paused) {
      video.play().catch(e => console.error('Error playing video:', e));
    }
  });
  
  if (window.yt && window.yt.player && window.yt.player.getPlayerByElement) {
    try {
      const playerContainer = document.querySelector('#movie_player');
      if (playerContainer) {
        const player = window.yt.player.getPlayerByElement(playerContainer);
        if (player && typeof player.playVideo === 'function' && !window.intentionTube.originalVideoState?.paused) {
          player.playVideo();
        }
      }
    } catch (e) {
      console.error('Error using YouTube Player API:', e);
    }
  }
}

// Function to check if this video already has a reason
function checkForExistingReason(callback) {
  const currentUrl = window.location.href;
  const videoId = getVideoIdFromUrl(currentUrl);

  if (!videoId) {
    callback(false); 
    return;
  }

  const request = indexedDB.open('IntentionTubeDB', 1);
  
  request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
    callback(false); 
  };
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    
    if (!db.objectStoreNames.contains('reasons')) {
      callback(false);
      return;
    }
    
    const transaction = db.transaction(['reasons'], 'readonly');
    const store = transaction.objectStore('reasons');
    const index = store.index('videoUrl');
    
    const getRequest = index.getAll(videoId); 
    
    getRequest.onsuccess = (event) => {
      const records = event.target.result;
      
      const hasWatchedReason = records.some(record => record.watched === true);
      
      callback(hasWatchedReason);
    };
    
    getRequest.onerror = (event) => {
      console.error('Error getting records:', event.target.error);
      callback(false);
    };
  };
}

// Initialize the blocker
async function initBlocker() {
  await getSettingsFromStorage(); 
  
  if (!window.intentionTube.settings.isEnabled) {
    console.log('Intention Tube is disabled. Skipping blocker.');
    return;
  }

  const videoId = getVideoIdFromUrl(window.location.href);
  const expired = await hasWatchTimeExpired(videoId);

  if (!expired) {
    console.log('Watch time limit still active, not blocking.');
    // Ensure video plays if we are within the time limit
    // (May not be strictly necessary if YT resumes automatically, but good safety)
    resumeVideo(); 
    return; // Don't block if time limit is still valid
  }

  // Proceed with blocking only if expired or never unblocked
  console.log('Initializing Intention Tube blocker...');
   
  if (window.intentionTube.videoBlocked) {
    return;
  }
  
  checkForExistingReason((hasReason) => {
    if (hasReason) {
      return;
    }
    
    window.intentionTube.videoBlocked = true;
    pauseVideo();
    createBlockerOverlay();
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'initBlocker') {
    Object.assign(window.intentionTube.settings, message.settings);
    initBlocker();
    sendResponse({ success: true });
  }
  return true;
});

// Initialize when the content script is first loaded
getSettingsFromStorage().then(settings => {
  Object.assign(window.intentionTube.settings, settings);
  initBlocker();
});
