const DEFAULT_SETTINGS = {
  blockingDuration: 5, // Default blocking duration in seconds
  isEnabled: true, // Extension enabled by default
  darkMode: false, // Light mode by default
  watchTimeLimit: 2, // Default watch time limit in hours
};

export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
      resolve(settings);
    });
  });
}

export function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve();
    });
  });
}

export function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}
