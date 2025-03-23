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
        // Inject the content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        // Send the settings to the content script
        chrome.tabs.sendMessage(tabId, { 
          action: 'initBlocker',
          settings: settings
        });
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
  }
});
