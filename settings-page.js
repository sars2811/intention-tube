document.addEventListener("DOMContentLoaded", async () => {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const extensionToggle = document.getElementById("extension-toggle");
  const extensionStatus = document.getElementById("extension-status");
  const blockingDuration = document.getElementById("blocking-duration");
  const durationValue = document.getElementById("duration-value");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history");
  const exportHistoryBtn = document.getElementById("export-history");
  const watchTimeLimitInput = document.getElementById("watchTimeLimit");
  const watchTimeLimitValue = document.getElementById("watchTimeLimitValue");

  const settings = await IntentionTubeSettings.loadSettings();

  darkModeToggle.checked = settings.darkMode;
  extensionToggle.checked = settings.isEnabled;
  settings.watchTimeLimit = settings.watchTimeLimit ?? 2;

  blockingDuration.value = settings.blockingDuration;
  durationValue.textContent = settings.blockingDuration;
  watchTimeLimitInput.value = settings.watchTimeLimit;
  watchTimeLimitValue.textContent = `${settings.watchTimeLimit} hours`;

  if (settings.darkMode) {
    document.body.classList.add("dark-mode");
  }

  extensionStatus.textContent = settings.isEnabled ? "Enabled" : "Disabled";

  await loadHistory();

  darkModeToggle.addEventListener("change", async () => {
    settings.darkMode = darkModeToggle.checked;
    document.body.classList.toggle("dark-mode", settings.darkMode);
    await IntentionTubeSettings.saveSettings(settings);
  });

  extensionToggle.addEventListener("change", async () => {
    settings.isEnabled = extensionToggle.checked;
    extensionStatus.textContent = settings.isEnabled ? "Enabled" : "Disabled";
    await IntentionTubeSettings.saveSettings(settings);
  });

  blockingDuration.addEventListener("input", () => {
    durationValue.textContent = blockingDuration.value;
  });

  blockingDuration.addEventListener("change", async () => {
    settings.blockingDuration = parseInt(blockingDuration.value);
    await IntentionTubeSettings.saveSettings(settings);
  });

  watchTimeLimitInput.addEventListener("input", () => {
    const value = parseFloat(watchTimeLimitInput.value);
    if (!isNaN(value) && value > 0) {
      watchTimeLimitValue.textContent = `${value} hours`;
    }
  });

  watchTimeLimitInput.addEventListener("change", async () => {
    const value = parseFloat(watchTimeLimitInput.value);
    if (!isNaN(value) && value > 0) {
      settings.watchTimeLimit = value;
      watchTimeLimitValue.textContent = `${value} hours`;
      await IntentionTubeSettings.saveSettings(settings);
    } else {
      watchTimeLimitInput.value = settings.watchTimeLimit;
      watchTimeLimitValue.textContent = `${settings.watchTimeLimit} hours`;
    }
  });

  clearHistoryBtn.addEventListener("click", async () => {
    if (
      confirm(
        "Are you sure you want to clear all history? This cannot be undone."
      )
    ) {
      await IntentionTubeDB.clearAllAttempts();
      await loadHistory();
    }
  });

  exportHistoryBtn.addEventListener("click", async () => {
    try {
      const attempts = await IntentionTubeDB.getAllAttempts();
      const dataStr = JSON.stringify(attempts, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = "intention-tube-history.json";

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error("Error exporting history:", error);
      alert("Failed to export history. Please try again.");
    }
  });

  async function loadHistory() {
    try {
      const attempts = await IntentionTubeDB.getAllAttempts();

      if (attempts.length === 0) {
        historyList.innerHTML =
          '<div class="empty-history">No history available yet.</div>';
        return;
      }

      attempts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const historyHTML = attempts
        .map((attempt) => {
          const date = new Date(attempt.timestamp);
          const formattedDate =
            date.toLocaleDateString() + " " + date.toLocaleTimeString();
          const statusClass =
            attempt.outcome === "watched" ? "watched" : "cancelled";
          const statusText =
            attempt.outcome === "watched" ? "Watched" : "Cancelled";

          return `
          <div class="history-item">
            <div class="history-reason">${escapeHTML(
              attempt.title || attempt.videoId
            )}</div>
            <div class="history-meta">
              <span>${formattedDate}</span>
              <span class="history-status ${statusClass}">${statusText}</span>
            </div>
            <div class="history-url">
              <a href="https://www.youtube.com/watch?v=${
                attempt.videoId
              }" target="_blank">${truncateUrl(
            `https://www.youtube.com/watch?v=${attempt.videoId}`
          )}</a>
            </div>
          </div>
        `;
        })
        .join("");

      historyList.innerHTML = historyHTML;
    } catch (error) {
      console.error("Error loading history:", error);
      historyList.innerHTML =
        '<div class="empty-history">Error loading history.</div>';
    }
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get("v");
      return `YouTube: ${videoId}`;
    } catch (e) {
      return url.length > 50 ? url.substring(0, 47) + "..." : url;
    }
  }
});
