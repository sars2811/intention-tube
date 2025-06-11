async function getMessageResponseFromBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const statusIcon = document.getElementById("status-icon");
  const statusText = document.getElementById("status-text");
  const toggleButton = document.getElementById("toggle-extension");
  const settingsButton = document.getElementById("open-settings");
  const watchedCount = document.getElementById("watched-count");
  const cancelledCount = document.getElementById("cancelled-count");
  const intentionalityRate = document.getElementById("intentionality-rate");
  const watchTimeLimitInput = document.getElementById("watchTimeLimitPopup");
  const watchTimeLimitValue = document.getElementById(
    "watchTimeLimitValuePopup"
  );

  const settings = await getMessageResponseFromBackground({
    action: "getSettings",
  });

  // Apply dark mode if enabled
  if (settings.darkMode) {
    document.body.classList.add("dark-mode");
  }

  updateStatusUI(settings.isEnabled);
  watchTimeLimitInput.value = settings.watchTimeLimit;
  watchTimeLimitValue.textContent = `Current: ${settings.watchTimeLimit} hours`;

  try {
    const stats = await getMessageResponseFromBackground({
      action: "getAttemptStats",
    });
    updateStatsUI(stats);
  } catch (error) {
    console.error("Error loading stats:", error);
  }

  toggleButton.addEventListener("click", async () => {
    settings.isEnabled = !settings.isEnabled;
    await chrome.runtime.sendMessage({
      action: "saveSettings",
      payload: settings,
    });
    updateStatusUI(settings.isEnabled);
  });

  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  watchTimeLimitInput.addEventListener("change", async () => {
    const value = parseFloat(watchTimeLimitInput.value);
    if (!isNaN(value) && value > 0) {
      settings.watchTimeLimit = value;
      watchTimeLimitValue.textContent = `Current: ${value} hours`;
      await chrome.runtime.sendMessage({
        action: "saveSettings",
        payload: settings,
      });
    } else {
      watchTimeLimitInput.value = settings.watchTimeLimit;
      watchTimeLimitValue.textContent = `Current: ${settings.watchTimeLimit} hours`;
    }
  });

  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusIcon.className = "status-icon enabled";
      statusText.textContent = "Extension is active";
      toggleButton.textContent = "Disable Extension";
    } else {
      statusIcon.className = "status-icon disabled";
      statusText.textContent = "Extension is disabled";
      toggleButton.textContent = "Enable Extension";
    }
  }

  function updateStatsUI(stats) {
    watchedCount.textContent = stats.watched || 0;
    cancelledCount.textContent = stats.cancelled || 0;
    intentionalityRate.textContent = `${stats.intentionalityRate || 0}%`;
  }
});
