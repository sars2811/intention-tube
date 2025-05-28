const DEFAULT_SETTINGS = {
  blockingDuration: 5, // Default blocking duration in seconds
  isEnabled: true, // Extension enabled by default
  darkMode: false, // Light mode by default
  watchTimeLimit: 2, // Default watch time limit in hours
};

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
      resolve(settings);
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve();
    });
  });
}

function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}

window.IntentionTubeSettings = {
  loadSettings,
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
};
