// Popup script for Intention Tube
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const toggleButton = document.getElementById('toggle-extension');
  const settingsButton = document.getElementById('open-settings');
  const watchedCount = document.getElementById('watched-count');
  const cancelledCount = document.getElementById('cancelled-count');
  const intentionalityRate = document.getElementById('intentionality-rate');
  const watchTimeLimitInput = document.getElementById('watchTimeLimitPopup');
  const watchTimeLimitValue = document.getElementById('watchTimeLimitValuePopup');

  // Load settings
  const settings = await IntentionTubeSettings.loadSettings();
  
  // Update UI based on settings
  updateStatusUI(settings.isEnabled);
  watchTimeLimitInput.value = settings.watchTimeLimit;
  watchTimeLimitValue.textContent = `Current: ${settings.watchTimeLimit} hours`;
  
  // Load stats
  try {
    const stats = await IntentionTubeDB.getAttemptStats();
    updateStatsUI(stats);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
  
  // Toggle extension state
  toggleButton.addEventListener('click', async () => {
    settings.isEnabled = !settings.isEnabled;
    await IntentionTubeSettings.saveSettings(settings);
    updateStatusUI(settings.isEnabled);
  });
  
  // Open settings page
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Watch time limit input change
  watchTimeLimitInput.addEventListener('change', async () => {
    const value = parseFloat(watchTimeLimitInput.value);
    if (!isNaN(value) && value > 0) {
      settings.watchTimeLimit = value;
      watchTimeLimitValue.textContent = `Current: ${value} hours`;
      await IntentionTubeSettings.saveSettings(settings);
    } else {
      // Reset to the current saved value if input is invalid
      watchTimeLimitInput.value = settings.watchTimeLimit;
      watchTimeLimitValue.textContent = `Current: ${settings.watchTimeLimit} hours`;
    }
  });
  
  // Update status UI based on enabled state
  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusIcon.className = 'status-icon enabled';
      statusText.textContent = 'Extension is active';
      toggleButton.textContent = 'Disable Extension';
    } else {
      statusIcon.className = 'status-icon disabled';
      statusText.textContent = 'Extension is disabled';
      toggleButton.textContent = 'Enable Extension';
    }
  }
  
  // Update stats UI
  function updateStatsUI(stats) {
    watchedCount.textContent = stats.watched || 0;
    cancelledCount.textContent = stats.cancelled || 0;
    intentionalityRate.textContent = `${stats.intentionalityRate || 0}%`;
  }
});
