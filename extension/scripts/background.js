// Background service worker for Catify extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["enabled"], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({ enabled: true }, () => {
        console.log("Catify enabled by default.");
      });
    }
  });
});

const BACKEND_URL = "http://localhost:8000";

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchCats") {
    const limit = request.limit || 30;
    fetch(`${BACKEND_URL}/api/cats?limit=${limit}`)
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.error("Error in background fetchCats:", err);
        sendResponse({ success: false, error: err.toString() });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "incrementStats") {
    fetch(`${BACKEND_URL}/api/stats/increment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ increment: request.increment })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.error("Error in background incrementStats:", err);
        sendResponse({ success: false, error: err.toString() });
      });
    return true;
  }

  if (request.action === "getStats") {
    fetch(`${BACKEND_URL}/api/stats`)
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.error("Error in background getStats:", err);
        sendResponse({ success: false, error: err.toString() });
      });
    return true;
  }
});
