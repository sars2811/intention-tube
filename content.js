// Content script for Intention Tube
// Use a namespace to avoid variable redeclaration issues
window.intentionTube = window.intentionTube || {
  videoBlocked: false,
  timerInterval: null,
  originalVideoState: null,
  settings: { blockingDuration: 5, isEnabled: true }
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
function createBlockerOverlay() {
  // Check if overlay already exists
  if (document.getElementById('intention-tube-overlay')) {
    return;
  }

  // First, add a style to prevent scrolling on the body
  const bodyStyle = document.createElement('style');
  bodyStyle.id = 'intention-tube-body-style';
  bodyStyle.textContent = `
    body, html {
      overflow: hidden !important;
      height: 100% !important;
      width: 100% !important;
      position: relative !important;
    }
  `;
  document.head.appendChild(bodyStyle);

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'intention-tube-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.98);
    z-index: 2147483647; /* Maximum z-index value */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: Arial, sans-serif;
    color: white;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    overflow: hidden;
    pointer-events: auto !important;
  `;

  // Create content container
  const container = document.createElement('div');
  container.style.cssText = `
    background-color: #2b2b2b;
    padding: 40px;
    border-radius: 12px;
    text-align: center;
    max-width: 600px;
    width: 90%;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  `;

  // Create title
  const title = document.createElement('h2');
  title.textContent = 'Why are you watching this video?';
  title.style.cssText = `
    margin-top: 0;
    color: white;
  `;

  // Create timer
  const timer = document.createElement('div');
  timer.id = 'intention-tube-timer';
  timer.textContent = `Wait ${window.intentionTube.settings.blockingDuration} seconds`;
  timer.style.cssText = `
    font-size: 18px;
    margin: 15px 0;
    color: #ff9800;
  `;

  // Create reason input
  const reasonInput = document.createElement('textarea');
  reasonInput.id = 'intention-tube-reason';
  reasonInput.placeholder = 'Enter your reason for watching this video...';
  reasonInput.style.cssText = `
    width: 100%;
    padding: 12px;
    margin: 15px 0;
    border-radius: 5px;
    border: none;
    resize: vertical;
    min-height: 80px;
    box-sizing: border-box;
    font-family: Arial, sans-serif;
    font-size: 16px;
  `;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
  `;

  // Create watch button (initially disabled)
  const watchButton = document.createElement('button');
  watchButton.id = 'intention-tube-watch';
  watchButton.textContent = 'Watch Now';
  watchButton.disabled = true;
  watchButton.style.cssText = `
    padding: 12px 24px;
    border: none;
    border-radius: 5px;
    background-color: #808080;
    color: white;
    font-size: 16px;
    cursor: not-allowed;
    transition: background-color 0.3s;
    flex: 1;
    margin-right: 10px;
  `;

  // Create cancel button
  const cancelButton = document.createElement('button');
  cancelButton.id = 'intention-tube-cancel';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    padding: 12px 24px;
    border: none;
    border-radius: 5px;
    background-color: #f44336;
    color: white;
    font-size: 16px;
    cursor: pointer;
    flex: 1;
    margin-left: 10px;
  `;

  // Assemble the overlay
  buttonContainer.appendChild(watchButton);
  buttonContainer.appendChild(cancelButton);
  container.appendChild(title);
  container.appendChild(timer);
  container.appendChild(reasonInput);
  container.appendChild(buttonContainer);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Start the timer
  let timeLeft = window.intentionTube.settings.blockingDuration;
  window.intentionTube.timerInterval = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft > 0 ? `Wait ${timeLeft} seconds` : 'Enter your reason to proceed';
    
    if (timeLeft <= 0) {
      clearInterval(window.intentionTube.timerInterval);
      checkReasonInput();
    }
  }, 1000);

  // Function to check if reason input has text and enable/disable button accordingly
  function checkReasonInput() {
    const reason = reasonInput.value.trim();
    if (reason) {
      watchButton.disabled = false;
      watchButton.style.backgroundColor = '#4CAF50';
      watchButton.style.cursor = 'pointer';
    } else {
      watchButton.disabled = true;
      watchButton.style.backgroundColor = '#808080';
      watchButton.style.cursor = 'not-allowed';
    }
  }
  
  // Add event listener to reason input to check on each change
  reasonInput.addEventListener('input', checkReasonInput);

  // Add event listeners
  watchButton.addEventListener('click', () => {
    if (!watchButton.disabled) {
      const reason = reasonInput.value.trim();
      if (reason) {
        // Save the reason to IndexedDB
        saveToIndexedDB(reason, true);
        // Remove the overlay
        removeOverlay();
        // Resume video playback
        resumeVideo();
      } else {
        alert('Please enter a reason for watching this video.');
      }
    }
  });

  cancelButton.addEventListener('click', () => {
    const reason = reasonInput.value.trim();
    if (reason) {
      // Save the reason to IndexedDB with watched=false
      saveToIndexedDB(reason, false);
    }

    // Send a message to the background script to close this tab
    chrome.runtime.sendMessage({ action: "closeTab" });
  });
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
    return; // Don't save if we can't get the ID
  }
  
  // Create a request to open the database
  const request = indexedDB.open('IntentionTubeDB', 1);
  
  request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
  };
  
  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    
    // Create object store for reasons if it doesn't exist
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
      videoUrl: videoId, // Use videoId here
      watched: watched,
      title: document.title // Optionally store title
    };
    
    store.add(data);
  };
}

// Remove the blocker overlay
function removeOverlay() {
  const overlay = document.getElementById('intention-tube-overlay');
  if (overlay) {
    document.body.removeChild(overlay);
  }
  
  if (window.intentionTube.timerInterval) {
    clearInterval(window.intentionTube.timerInterval);
  }
  
  // Remove the body style
  const bodyStyle = document.getElementById('intention-tube-body-style');
  if (bodyStyle) {
    document.head.removeChild(bodyStyle);
  }
  
  window.intentionTube.videoBlocked = false;
}

// Pause the YouTube video
function pauseVideo() {
  // Try multiple methods to ensure the video is paused
  
  // Method 1: Direct video element manipulation
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    window.intentionTube.originalVideoState = {
      paused: video.paused,
      currentTime: video.currentTime,
      muted: video.muted
    };
    
    // Force pause
    video.pause();
    
    // Also mute the video as a backup
    video.muted = true;
  });
  
  // Method 2: Try to click the YouTube pause button if video is playing
  const pauseButton = document.querySelector('.ytp-play-button');
  if (pauseButton) {
    // Check if video is playing (button would show pause icon)
    if (pauseButton.getAttribute('aria-label')?.includes('Pause') || 
        pauseButton.getAttribute('title')?.includes('Pause')) {
      pauseButton.click();
    }
  }
  
  // Method 3: Use the YouTube Player API if available
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
  
  // Method 4: Continuous checking to ensure video stays paused
  // Set up a short interval that keeps checking if the video is playing
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
  }, 500); // Check every 500ms
}

// Resume the YouTube video
function resumeVideo() {
  // Clear the pause check interval
  if (window.pauseCheckInterval) {
    clearInterval(window.pauseCheckInterval);
  }
  
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    // Restore original muted state
    if (window.intentionTube.originalVideoState && window.intentionTube.originalVideoState.hasOwnProperty('muted')) {
      video.muted = window.intentionTube.originalVideoState.muted;
    }
    
    // Play if it was playing before
    if (window.intentionTube.originalVideoState && !window.intentionTube.originalVideoState.paused) {
      video.play().catch(e => console.error('Error playing video:', e));
    }
  });
  
  // Try YouTube API as well
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
    callback(false); // Assume no reason if ID can't be extracted
    return;
  }

  const request = indexedDB.open('IntentionTubeDB', 1);
  
  request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
    callback(false); // Proceed with blocking if there's an error
  };
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    
    // Check if the object store exists
    if (!db.objectStoreNames.contains('reasons')) {
      callback(false);
      return;
    }
    
    const transaction = db.transaction(['reasons'], 'readonly');
    const store = transaction.objectStore('reasons');
    const index = store.index('videoUrl');
    
    // Get all records for this video ID
    const getRequest = index.getAll(videoId); // Use videoId here
    
    getRequest.onsuccess = (event) => {
      const records = event.target.result;
      
      // Check if there's at least one record where watched is true
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
function initBlocker() {
  if (!window.intentionTube.settings.isEnabled || window.intentionTube.videoBlocked) {
    return;
  }
  
  // Check if this video already has a reason before blocking
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
