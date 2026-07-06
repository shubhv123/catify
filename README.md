# Catify: Chrome Extension with Python Backend

Catify is a premium Chrome Extension (built using Manifest V3) that replaces all images on web pages with random, cute cat images. It is powered by a local Python FastAPI backend, which handles fetching image lists from The Cat API and tracking global replacement statistics.

---

## Folder Structure

```
Chrome Extension/
├── .gitignore
├── README.md
├── backend/
│   ├── app.py                  # FastAPI server with endpoint logic and caching
│   └── requirements.txt        # Python package dependencies
└── extension/
    ├── manifest.json           # Manifest V3 extension configuration
    ├── popup/
    │   ├── popup.html          # Extension UI structure (Google Fonts & elements)
    │   ├── popup.css           # Glassmorphism dark-theme popup styles
    │   └── popup.js            # State toggling & stats sync logic
    ├── scripts/
    │   ├── content.js          # Injected content script (MutationObserver & image swapping)
    │   └── background.js       # Service worker (mixed-content fetch broker)
    └── icons/
        ├── icon16.png          # Extension icon (16x16)
        ├── icon48.png          # Extension icon (48x48)
        └── icon128.png         # Extension icon (128x128)
```

---

## Features

- **Automated Replacement**: Replaces all `img` tags on page load.
- **Layout Shift Protection**: Preserves the original image dimensions to prevent layout reflows (CLS).
- **Dynamic Content Watcher**: Observes infinite scrolling (e.g. Google Images, blogs) via a `MutationObserver` and replaces newly added images.
- **Original Restore on Toggle**: Toggling "Auto-Catify" off instantly restores all original images on the page.
- **Global Counters**: Tracks the cumulative number of cats spawned across all pages in a persistent JSON database (`stats.json`).
- **Mixed Content Protection**: routes content script fetches through the `background.js` service worker, bypassing browser restrictions that block requests from HTTPS sites to insecure local API servers.

---

## Getting Started

### 1. Run the Python Backend

First, ensure you have Python 3 installed. Then set up and start the FastAPI server:

1. Navigate to the project root:
   ```bash
   cd "/Users/shubhverma/vscode/Chrome Extension"
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Run the FastAPI development server:
   ```bash
   python backend/app.py
   ```
   The backend will start running on `http://127.0.0.1:8000`.

---

### 2. Load the Extension in Chrome

1. Open Google Chrome.
2. In the address bar, navigate to `chrome://extensions/`.
3. In the top-right corner, toggle the **Developer mode** switch to **ON**.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the `extension/` directory (inside this project workspace).
6. Click the extension puzzle icon in your Chrome toolbar and pin **Catify** for quick access.

---

## How to Test

1. Open any image-heavy website (e.g., [wikipedia.org](https://wikipedia.org) or [unsplash.com](https://unsplash.com)).
2. Click the **Catify** extension icon 🐱 to open the popup:
   - Verify that it shows **Server Connected** (glowing green dot).
   - Watch the images on the page automatically transform into random cat images.
   - Click the toggle switch **Auto-Catify** to OFF and observe the original images immediately restored.
   - Click **Catify Page Now** to run a manual replace cycle at any time.
