chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("youtube.com/watch?v=")
  ) {
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get("settings", (result) => {
          resolve(result.settings || { isEnabled: true, blockingDuration: 5 });
        });
      });

      if (settings.isEnabled) {
      }
    } catch (error) {
      console.error("Error in background script:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSettings") {
    chrome.storage.local.get("settings", (result) => {
      sendResponse(result.settings || { isEnabled: true, blockingDuration: 5 });
    });
    return true;
  } else if (message.action === "closeTab") {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
});
