// Settings page script for Intention Tube
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const extensionToggle = document.getElementById('extension-toggle');
  const extensionStatus = document.getElementById('extension-status');
  const blockingDuration = document.getElementById('blocking-duration');
  const durationValue = document.getElementById('duration-value');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');
  const exportHistoryBtn = document.getElementById('export-history');

  // Load settings
  const settings = await IntentionTubeSettings.loadSettings();
  
  // Initialize UI with current settings
  darkModeToggle.checked = settings.darkMode;
  extensionToggle.checked = settings.isEnabled;
  blockingDuration.value = settings.blockingDuration;
  durationValue.textContent = settings.blockingDuration;
  
  // Apply dark mode if enabled
  if (settings.darkMode) {
    document.body.classList.add('dark-mode');
  }
  
  // Update extension status text
  extensionStatus.textContent = settings.isEnabled ? 'Enabled' : 'Disabled';
  
  // Load history
  await loadHistory();
  
  // Event Listeners
  
  // Dark mode toggle
  darkModeToggle.addEventListener('change', async () => {
    settings.darkMode = darkModeToggle.checked;
    document.body.classList.toggle('dark-mode', settings.darkMode);
    await IntentionTubeSettings.saveSettings(settings);
  });
  
  // Extension toggle
  extensionToggle.addEventListener('change', async () => {
    settings.isEnabled = extensionToggle.checked;
    extensionStatus.textContent = settings.isEnabled ? 'Enabled' : 'Disabled';
    await IntentionTubeSettings.saveSettings(settings);
  });
  
  // Blocking duration slider
  blockingDuration.addEventListener('input', () => {
    durationValue.textContent = blockingDuration.value;
  });
  
  blockingDuration.addEventListener('change', async () => {
    settings.blockingDuration = parseInt(blockingDuration.value);
    await IntentionTubeSettings.saveSettings(settings);
  });
  
  // Clear history button
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await IntentionTubeDB.clearAllReasons();
      await loadHistory();
    }
  });
  
  // Export history button
  exportHistoryBtn.addEventListener('click', async () => {
    try {
      const reasons = await IntentionTubeDB.getAllReasons();
      const dataStr = JSON.stringify(reasons, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'intention-tube-history.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error exporting history:', error);
      alert('Failed to export history. Please try again.');
    }
  });
  
  // Function to load and display history
  async function loadHistory() {
    try {
      const reasons = await IntentionTubeDB.getAllReasons();
      
      if (reasons.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No history available yet.</div>';
        return;
      }
      
      // Sort reasons by timestamp (newest first)
      reasons.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Create HTML for history items
      const historyHTML = reasons.map(item => {
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const statusClass = item.watched ? 'watched' : 'cancelled';
        const statusText = item.watched ? 'Watched' : 'Cancelled';
        
        return `
          <div class="history-item">
            <div class="history-reason">${escapeHTML(item.reason)}</div>
            <div class="history-meta">
              <span>${formattedDate}</span>
              <span class="history-status ${statusClass}">${statusText}</span>
            </div>
            <div class="history-url">
              <a href="${item.videoUrl}" target="_blank">${truncateUrl(item.videoUrl)}</a>
            </div>
          </div>
        `;
      }).join('');
      
      historyList.innerHTML = historyHTML;
    } catch (error) {
      console.error('Error loading history:', error);
      historyList.innerHTML = '<div class="empty-history">Error loading history.</div>';
    }
  }
  
  // Helper function to escape HTML
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // Helper function to truncate URL
  function truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      return `YouTube: ${videoId}`;
    } catch (e) {
      // If URL parsing fails, just truncate the string
      return url.length > 50 ? url.substring(0, 47) + '...' : url;
    }
  }
});
