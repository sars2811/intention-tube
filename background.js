import { loadSettings, saveSettings } from "./settings.js";
import {
  saveAttempt,
  updateAttemptOutcome,
  getWatchTimestamp,
  initDB,
  getAllAttempts,
  getAttemptStats,
  clearAllAttempts,
  saveWatchTimestamp,
  deleteWatchTimestamp,
} from "./database.js";

initDB();

function getMessageResolver(func, sendResponse, message) {
  func(message.payload)
    .then((setts) => {
      sendResponse(setts);
    })
    .catch((err) => {
      sendResponse({ error: err.message });
    });

  return true;
}

function closeTab(sender) {
  if (sender.tab && sender.tab.id) {
    chrome.tabs.remove(sender.tab.id);
  }
}

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
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        });
      }
    } catch (error) {
      console.error("Error in background script:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "getSettings":
      return getMessageResolver(loadSettings, sendResponse, message);
    case "saveSettings":
      return getMessageResolver(saveSettings, sendResponse, message);
    case "closeTab":
      closeTab(sender);
      break;
    case "getWatchTimestamp":
      return getMessageResolver(getWatchTimestamp, sendResponse, message);
    case "saveAttempt":
      return getMessageResolver(saveAttempt, sendResponse, message);
    case "updateAttemptOutcome":
      return getMessageResolver(updateAttemptOutcome, sendResponse, message);
    case "getAllAttempts":
      return getMessageResolver(getAllAttempts, sendResponse, message);
    case "getAttemptStats":
      return getMessageResolver(getAttemptStats, sendResponse, message);
    case "clearAllAttempts":
      return getMessageResolver(clearAllAttempts, sendResponse, message);
    case "saveWatchTimestamp":
      return getMessageResolver(saveWatchTimestamp, sendResponse, message);
    case "deleteWatchTimestamp":
      return getMessageResolver(deleteWatchTimestamp, sendResponse, message);
    default:
      break;
  }
});
