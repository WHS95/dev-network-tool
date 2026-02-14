# Privacy Policy - DevCurl

**Last updated: February 14, 2026**

## Overview

DevCurl ("the Extension") is a Chrome DevTools extension that converts network requests into clean curl commands. This privacy policy explains how the Extension handles user data.

## Data Collection

**DevCurl does NOT collect, transmit, or store any personal data.**

Specifically:

- **No analytics or tracking** — The Extension does not use any analytics services (Google Analytics, Mixpanel, etc.)
- **No external network requests** — The Extension never makes any HTTP requests to external servers
- **No user data transmission** — Network request data captured by the Extension stays entirely within your browser
- **No remote storage** — All data remains local to your browser session

## Data Usage

The Extension accesses the following browser APIs for its core functionality:

| API | Purpose |
|-----|---------|
| `chrome.devtools.network` | Captures HTTP request data displayed in DevTools to generate curl commands |
| `chrome.storage.sync` | Stores your header filter preferences (which headers to include/exclude in curl output) |

### chrome.devtools.network

- Used to read HTTP request details (URL, headers, body, response status) that are already visible in Chrome DevTools
- This data is processed **locally** to generate curl commands
- This data is **never** sent to any external server
- This data is **not** persisted — it only exists while the DevTools panel is open

### chrome.storage.sync

- Used **only** to save your header filter settings (a list of header names)
- Synced across your Chrome browsers via your Google account (standard Chrome storage behavior)
- Contains **no personal information** — only header names like "sec-ch-ua", "sec-fetch-dest", etc.

## Data Retention

- **Network request data**: Not retained. Cleared when you close DevTools or click the clear button.
- **Header filter settings**: Retained in Chrome storage until you reset them or uninstall the Extension.

## Third-Party Services

DevCurl does **not** use any third-party services, SDKs, or libraries that collect data.

## Children's Privacy

DevCurl does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

If this privacy policy is updated, the changes will be noted with a new "Last updated" date at the top.

## Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.

---

*This Extension is open source and its complete source code can be reviewed to verify these privacy claims.*
