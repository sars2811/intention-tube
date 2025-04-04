// Background script for Intention Tube

// Listen for tab updates to detect YouTube video pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check if the page is fully loaded and is a YouTube video
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch?v=')) {
    try {
      // Load settings to check if extension is enabled
      const settings = await new Promise(resolve => {
        chrome.storage.local.get('settings', (result) => {
          resolve(result.settings || { isEnabled: true, blockingDuration: 5 });
        });
      });
      
      // Only proceed if the extension is enabled
      if (settings.isEnabled) {
        // Content script is now injected via manifest.json
        // No need to inject or send settings message from here
      }
    } catch (error) {
      console.error('Error in background script:', error);
    }
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    chrome.storage.local.get('settings', (result) => {
      sendResponse(result.settings || { isEnabled: true, blockingDuration: 5 });
    });
    return true; // Required for async sendResponse
  } else if (message.action === 'closeTab') {
    // Close the tab from which the message was sent
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
});
