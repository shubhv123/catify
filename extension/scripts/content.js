// Content script for Catify Chrome Extension
let enabled = true;
let catUrls = [];
let fetchingCats = false;
const BACKEND_URL = "http://localhost:8000";

// Load configuration and start
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(["enabled"], (result) => {
    enabled = result.enabled !== false;
    if (enabled) {
      initCatification();
    }
  });
} else {
  enabled = localStorage.getItem("catify_enabled") !== "false";
  if (enabled) {
    initCatification();
  }
}

// Listen for messages/changes from the popup
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.enabled) {
      enabled = changes.enabled.newValue;
      if (enabled) {
        initCatification();
      } else {
        restoreOriginalImages();
      }
    }
  });
}

// Listener for custom triggers (like "Catify Now!" button in popup)
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "catifyNow") {
      catifyPage(true); // Force run immediately
      sendResponse({ status: "Catifying page now" });
    }
    return true;
  });
}

// Fetch a batch of cat URLs via background service worker or direct fallback
async function fetchCatUrls() {
  if (fetchingCats) return;
  fetchingCats = true;
  
  const hasChromeExtensionApi = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;

  if (hasChromeExtensionApi) {
    chrome.runtime.sendMessage({ action: "fetchCats", limit: 30 }, (response) => {
      fetchingCats = false;
      if (response && response.success && response.data && response.data.images) {
        catUrls = [...catUrls, ...response.data.images];
        console.log(`[Catify] Loaded ${response.data.images.length} cat images from backend via background.`);
      } else {
        console.warn("[Catify] Backend fetch via background failed, using client fallbacks", response);
        useClientFallbacks();
      }
    });
  } else {
    // Direct fetch fallback for local testing environments
    try {
      const response = await fetch(`${BACKEND_URL}/api/cats?limit=30`);
      const data = await response.json();
      if (data.success && data.images && data.images.length > 0) {
        catUrls = [...catUrls, ...data.images];
      } else {
        useClientFallbacks();
      }
    } catch (error) {
      console.warn("[Catify] Error fetching directly from backend:", error);
      useClientFallbacks();
    } finally {
      fetchingCats = false;
    }
  }
}

function useClientFallbacks() {
  const clientFallbacks = [
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500",
    "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=500",
    "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=500",
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=500"
  ];
  catUrls = [...catUrls, ...clientFallbacks];
}

// Get a cat URL from cache, and fetch more in the background if running low
async function getCatUrl() {
  if (catUrls.length < 5) {
    fetchCatUrls(); // Pre-fetch more
  }
  if (catUrls.length === 0) {
    await fetchCatUrls();
    // Yield brief moment to allow fetch response callbacks to populate array
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return catUrls.length > 0 ? catUrls[Math.floor(Math.random() * catUrls.length)] : null;
}

// Report count of catified images via background service worker or direct fallback
async function reportCatifiedCount(count) {
  if (count <= 0) return;
  
  const hasChromeExtensionApi = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;

  if (hasChromeExtensionApi) {
    chrome.runtime.sendMessage({ action: "incrementStats", increment: count }, (response) => {
      // Also update local extension storage cache
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["localCount"], (res) => {
          const current = res.localCount || 0;
          chrome.storage.local.set({ localCount: current + count });
        });
      }
    });
  } else {
    // Direct POST fallback for local testing
    try {
      await fetch(`${BACKEND_URL}/api/stats/increment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ increment: count })
      });
      const current = parseInt(localStorage.getItem("catify_localCount") || "0");
      localStorage.setItem("catify_localCount", current + count);
    } catch (e) {
      console.warn("[Catify] Could not sync stats directly with backend:", e);
    }
  }
}

// Initialize catification process
async function initCatification() {
  await fetchCatUrls();
  catifyPage();
  setupMutationObserver();
}

// Catify all images currently on the page
async function catifyPage(force = false) {
  if (!enabled && !force) return;

  const images = document.querySelectorAll("img:not([data-catified='true'])");
  if (images.length === 0) return;

  let replacedCount = 0;

  for (let img of images) {
    // Skip tiny images (tracking pixels, icons, emojis)
    const rect = img.getBoundingClientRect();
    if (!force && rect.width > 0 && rect.width < 16 && rect.height > 0 && rect.height < 16) {
      continue;
    }

    const catUrl = await getCatUrl();
    if (!catUrl) continue;

    // Save original properties to restore later if disabled
    img.dataset.originalSrc = img.src;
    if (img.srcset) {
      img.dataset.originalSrcset = img.srcset;
      img.removeAttribute("srcset");
    }

    // Set dimensions to prevent layouts from shifting
    const currentWidth = img.offsetWidth || img.width || rect.width;
    const currentHeight = img.offsetHeight || img.height || rect.height;
    
    if (currentWidth > 0) img.style.width = `${currentWidth}px`;
    if (currentHeight > 0) img.style.height = `${currentHeight}px`;
    img.style.objectFit = "cover";

    // Perform replacement
    img.src = catUrl;
    img.dataset.catified = "true";
    replacedCount++;
  }

  if (replacedCount > 0) {
    reportCatifiedCount(replacedCount);
  }
}

// Restore original images if the extension is disabled
function restoreOriginalImages() {
  const images = document.querySelectorAll("img[data-catified='true']");
  for (let img of images) {
    if (img.dataset.originalSrc) {
      img.src = img.dataset.originalSrc;
    }
    if (img.dataset.originalSrcset) {
      img.srcset = img.dataset.originalSrcset;
    } else {
      img.removeAttribute("srcset");
    }
    delete img.dataset.catified;
    delete img.dataset.originalSrc;
    delete img.dataset.originalSrcset;
  }
}

// Observe dynamic content additions (infinite scroll)
let observer = null;
function setupMutationObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    
    let hasNewImages = false;
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === "IMG" && !node.dataset.catified) {
            hasNewImages = true;
            break;
          }
          if (node.querySelector && node.querySelector("img:not([data-catified='true'])")) {
            hasNewImages = true;
            break;
          }
        }
      }
      if (hasNewImages) break;
    }

    if (hasNewImages) {
      // Debounce slightly to handle bulk updates
      clearTimeout(window.catifyTimeout);
      window.catifyTimeout = setTimeout(() => {
        catifyPage();
      }, 250);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Listen for custom trigger notifications in local testing
window.addEventListener("message", (event) => {
  if (event.data && event.data.action === "catifyNow") {
    catifyPage(true);
  }
});
