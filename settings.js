// Settings management for Intention Tube
const DEFAULT_SETTINGS = {
  blockingDuration: 5, // Default blocking duration in seconds
  isEnabled: true,     // Extension enabled by default
  darkMode: false      // Light mode by default
};

// Load settings from storage
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (result) => {
      // If no settings found, use defaults
      const settings = result.settings || DEFAULT_SETTINGS;
      resolve(settings);
    });
  });
}

// Save settings to storage
function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve();
    });
  });
}

// Reset settings to defaults
function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}

// Export the functions
window.IntentionTubeSettings = {
  loadSettings,
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS
};
