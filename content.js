window.intentionTube = window.intentionTube || {
  videoBlocked: false,
  timerInterval: null,
  originalVideoState: null,
  settings: {
    blockingDuration: 5,
    isEnabled: true,
    watchTimeLimit: 2,
  },
};

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

async function createBlockerOverlay() {
  if (document.getElementById("intention-tube-overlay")) {
    return;
  }

  const videoId = getVideoIdFromUrl(window.location.href);
  let attemptId = null;

  if (videoId) {
    try {
      attemptId = await getMessageResponseFromBackground({
        action: "saveAttempt",
        payload: {
          videoId,
          outcome: "cancelled",
          title: document.title,
        },
      });
    } catch (error) {
      console.error("Error saving pending attempt:", error);
      resumeVideo();
      return;
    }
  }

  // First, add a style to prevent scrolling on the body
  const bodyStyle = document.createElement("style");
  bodyStyle.id = "intention-tube-body-style";
  bodyStyle.textContent = `body, html { overflow: hidden !important; }`;
  document.head.appendChild(bodyStyle);

  // Inject the CSS file
  const cssLink = document.createElement("link");
  cssLink.id = "intention-tube-styles";
  cssLink.rel = "stylesheet";
  cssLink.type = "text/css";
  cssLink.href = chrome.runtime.getURL("overlay.css");
  document.head.appendChild(cssLink);

  // Create the main overlay div (for background dimming and positioning)
  const overlay = document.createElement("div");
  overlay.id = "intention-tube-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
    pointer-events: none; 
  `;

  try {
    const response = await fetch(chrome.runtime.getURL("overlay.html"));
    if (!response.ok) {
      throw new Error(`Failed to fetch overlay.html: ${response.statusText}`);
    }
    const htmlText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const container = doc.querySelector("#intention-tube-container");

    if (!container) {
      throw new Error("#intention-tube-container not found in overlay.html");
    }

    container.style.pointerEvents = "auto";
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    const timer = overlay.querySelector("#intention-tube-timer");
    const reasonInput = overlay.querySelector("#intention-tube-reason");
    const watchButton = overlay.querySelector("#intention-tube-watch");
    const cancelButton = overlay.querySelector("#intention-tube-cancel");

    timer.textContent = `Wait ${window.intentionTube.settings.blockingDuration} seconds`;
    watchButton.disabled = true;

    let timeLeft = window.intentionTube.settings.blockingDuration;
    window.intentionTube.timerInterval = setInterval(() => {
      timeLeft--;
      timer.textContent =
        timeLeft > 0
          ? `Wait ${timeLeft} seconds`
          : "Enter your reason to proceed";

      if (timeLeft <= 0) {
        clearInterval(window.intentionTube.timerInterval);
        checkReasonInput();
      }
    }, 1000);

    function checkReasonInput() {
      const reason = reasonInput.value.trim();
      watchButton.disabled = !reason;
    }

    reasonInput.addEventListener("input", checkReasonInput);

    watchButton.addEventListener("click", async () => {
      if (!attemptId) {
        console.error("Cannot update attempt: No attempt ID available.");
        // just proceed with unblocking
        removeOverlay();
        resumeVideo();
        return;
      }

      const reason = reasonInput.value.trim();
      if (reason) {
        try {
          await chrome.runtime.sendMessage({
            action: "updateAttemptOutcome",
            payload: {
              attemptId,
              reason,
              outcome: "watched",
            },
          });
          if (videoId) {
            saveWatchTimestamp(videoId);
          }
          removeOverlay();
          resumeVideo();
        } catch (error) {
          console.error("Error saving watched attempt:", error);
        }
      } else {
        alert("Please enter a reason for watching this video.");
      }
    });

    cancelButton.addEventListener("click", async () => {
      chrome.runtime.sendMessage({ action: "closeTab" });
    });
  } catch (error) {
    console.error("Error creating Intention Tube overlay:", error);
    removeOverlay();
  }
}

function getVideoIdFromUrl(url) {
  try {
    const urlObject = new URL(url);
    if (
      urlObject.hostname.includes("youtube.com") &&
      urlObject.pathname === "/watch"
    ) {
      return urlObject.searchParams.get("v");
    }
  } catch (e) {
    console.error("Error parsing URL:", url, e);
  }
  return null;
}

async function saveWatchTimestamp(videoId) {
  if (!videoId) return;
  try {
    await chrome.runtime.sendMessage({
      action: "saveWatchTimestamp",
      payload: {
        videoId,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error(
      `Error saving timestamp for video ${videoId} to IndexedDB:`,
      error
    );
  }
}

async function hasWatchTimeExpired(videoId) {
  if (!videoId) return true;

  const timestamp = await getMessageResponseFromBackground({
    action: "getWatchTimestamp",
    payload: videoId,
  });

  if (!timestamp) {
    return true;
  }

  const watchTimeLimitHours = window.intentionTube.settings.watchTimeLimit || 2;
  const watchTimeLimitMillis = watchTimeLimitHours * 60 * 60 * 1000;
  const expiryTime = timestamp + watchTimeLimitMillis;

  if (Date.now() >= expiryTime) {
    await chrome.runtime.sendMessage({
      action: "deleteWatchTimestamp",
      payload: videoId,
    });
    return true;
  } else {
    return false;
  }
}

function removeOverlay() {
  const overlay = document.getElementById("intention-tube-overlay");
  if (overlay) {
    overlay.remove();
  }

  const bodyStyle = document.getElementById("intention-tube-body-style");
  if (bodyStyle) {
    bodyStyle.remove();
  }

  const cssLink = document.getElementById("intention-tube-styles");
  if (cssLink) {
    cssLink.remove();
  }

  if (window.intentionTube.timerInterval) {
    clearInterval(window.intentionTube.timerInterval);
    window.intentionTube.timerInterval = null;
  }
  window.intentionTube.videoBlocked = false;
}

function pauseVideo() {
  const videoElements = document.querySelectorAll("video");
  videoElements.forEach((video) => {
    window.intentionTube.originalVideoState = {
      paused: video.paused,
      currentTime: video.currentTime,
      muted: video.muted,
    };

    video.pause();

    video.muted = true;
  });

  const pauseButton = document.querySelector(".ytp-play-button");
  if (pauseButton) {
    if (
      pauseButton.getAttribute("aria-label")?.includes("Pause") ||
      pauseButton.getAttribute("title")?.includes("Pause")
    ) {
      pauseButton.click();
    }
  }

  if (window.yt && window.yt.player && window.yt.player.getPlayerByElement) {
    try {
      const playerContainer = document.querySelector("#movie_player");
      if (playerContainer) {
        const player = window.yt.player.getPlayerByElement(playerContainer);
        if (player && typeof player.pauseVideo === "function") {
          player.pauseVideo();
        }
      }
    } catch (e) {
      console.error("Error using YouTube Player API:", e);
    }
  }

  if (window.pauseCheckInterval) {
    clearInterval(window.pauseCheckInterval);
  }

  window.pauseCheckInterval = setInterval(() => {
    if (window.intentionTube.videoBlocked) {
      videoElements.forEach((video) => {
        if (!video.paused) {
          video.pause();
          video.muted = true;
        }
      });
    } else {
      clearInterval(window.pauseCheckInterval);
    }
  }, 500);
}

function resumeVideo() {
  if (window.pauseCheckInterval) {
    clearInterval(window.pauseCheckInterval);
  }

  const videoElements = document.querySelectorAll("video");
  videoElements.forEach((video) => {
    const originallyMuted =
      window.intentionTube.originalVideoState?.muted ?? false;

    // Restore the original muted state directly on the video element
    video.muted = originallyMuted;

    // Attempt to play the video
    if (!window.intentionTube.originalVideoState?.paused) {
      video.play().catch((e) => console.error("Error playing video:", e));
    }

    // Force unmute via UI click if it was originally unmuted but might still be muted
    if (!originallyMuted) {
      // Short delay to ensure player UI is potentially updated after play()
      setTimeout(() => {
        // Double-check the video element's muted status
        if (video.muted) {
          console.log("Video still muted, attempting UI unmute click.");
          video.muted = false; // Try setting again just in case
          const muteButton = document.querySelector(".ytp-mute-button");
          // Check if the button title indicates it's currently muted (needs unmuting)
          if (
            muteButton &&
            (muteButton.getAttribute("title")?.includes("Unmute") ||
              muteButton.getAttribute("data-title-on")?.includes("Unmute"))
          ) {
            muteButton.click();
            console.log("Clicked unmute button.");
          }
        } else {
          console.log("Video correctly unmuted via property setting.");
        }
      }, 100);
    }
  });

  if (window.yt && window.yt.player && window.yt.player.getPlayerByElement) {
    try {
      const playerContainer = document.querySelector("#movie_player");
      if (playerContainer) {
        const player = window.yt.player.getPlayerByElement(playerContainer);
        if (
          player &&
          typeof player.playVideo === "function" &&
          !window.intentionTube.originalVideoState?.paused
        ) {
          player.playVideo();
        }
      }
    } catch (e) {
      console.error("Error using YouTube Player API:", e);
    }
  }
}

async function initBlocker() {
  if (!window.intentionTube.settings.isEnabled) {
    return;
  }

  const videoId = getVideoIdFromUrl(window.location.href);
  const expired = await hasWatchTimeExpired(videoId);

  if (!expired) {
    resumeVideo();
    return;
  }

  if (window.intentionTube.videoBlocked) {
    return;
  }

  window.intentionTube.videoBlocked = true;
  pauseVideo();
  createBlockerOverlay();
}

// --- Main Initialization ---
(async () => {
  try {
    const loadedSettings = await getMessageResponseFromBackground({
      action: "getSettings",
    });
    window.intentionTube.settings = loadedSettings;

    initBlocker();
  } catch (error) {
    console.error("Error initializing Intention Tube content script:", error);
  }
})();
