// Popup controller for Catify Chrome Extension
const BACKEND_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("enableToggle");
  const catifyBtn = document.getElementById("catifyNowBtn");
  const countDisplay = document.getElementById("statsCount");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  const hasChromeExtensionApi = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  // 1. Load initial enable state
  if (hasChromeExtensionApi) {
    chrome.storage.local.get(["enabled", "localCount"], (result) => {
      toggle.checked = result.enabled !== false;
      countDisplay.textContent = result.localCount || 0;
    });
  } else {
    // Local browser mock
    toggle.checked = localStorage.getItem("catify_enabled") !== "false";
    countDisplay.textContent = localStorage.getItem("catify_localCount") || 0;
  }

  // 2. Add listener to toggle
  toggle.addEventListener("change", () => {
    if (hasChromeExtensionApi) {
      chrome.storage.local.set({ enabled: toggle.checked }, () => {
        console.log(`Catify auto-replacement toggled: ${toggle.checked}`);
      });
    } else {
      localStorage.setItem("catify_enabled", toggle.checked);
      console.log(`[Mock] Catify auto-replacement toggled: ${toggle.checked}`);
    }
  });

  // 3. Add listener to Catify Now button
  catifyBtn.addEventListener("click", () => {
    if (hasChromeExtensionApi && chrome.tabs) {
      // Send message to the active tab to force catify
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "catifyNow" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.log("Could not communicate with page content script. Try reloading the webpage.");
                alert("Please reload the webpage first before catifying!");
              } else if (response) {
                console.log(response.status);
                setTimeout(syncStatsAndStatus, 500);
              }
            }
          );
        }
      });
    } else {
      // Local browser mock: Dispatch a custom event that local test page can listen to
      console.log("[Mock] Catify page now triggered");
      const event = new CustomEvent("mockCatifyTriggered");
      window.dispatchEvent(event);
      // Dispatch to parent window too if in iframe
      if (window.parent !== window) {
        window.parent.dispatchEvent(event);
      }
    }
  });

  // 4. Sync status with backend
  async function syncStatsAndStatus() {
    statusDot.className = "status-dot connecting";
    statusText.textContent = "Connecting...";

    try {
      const response = await fetch(`${BACKEND_URL}/api/stats`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (response.ok) {
        const stats = await response.json();
        const globalCount = stats.catified_count;
        
        // Update display
        countDisplay.textContent = globalCount;
        
        // Update local cache
        if (hasChromeExtensionApi) {
          chrome.storage.local.set({ localCount: globalCount });
        } else {
          localStorage.setItem("catify_localCount", globalCount);
        }

        // Update status dot
        statusDot.className = "status-dot connected";
        statusText.textContent = "Server Connected";
      } else {
        throw new Error("Server error status: " + response.status);
      }
    } catch (error) {
      console.warn("Could not sync with backend, using offline mode:", error);
      statusDot.className = "status-dot disconnected";
      statusText.textContent = "Offline (Local mode)";
      
      // Fallback: show local storage stats
      if (hasChromeExtensionApi) {
        chrome.storage.local.get(["localCount"], (result) => {
          countDisplay.textContent = result.localCount || 0;
        });
      } else {
        countDisplay.textContent = localStorage.getItem("catify_localCount") || 0;
      }
    }
  }

  // Initial sync
  await syncStatsAndStatus();
});
