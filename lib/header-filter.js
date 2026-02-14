/**
 * DevCurl - Header filter storage and presets
 * Chrome Extension (Manifest V3) - Vanilla JS, no bundler
 * Exposed as window.HeaderFilter for script tag loading
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "devcurl_filtered_headers";

  var DEFAULT_BROWSER_HEADERS = [
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-ch-ua-full-version-list",
    "sec-ch-ua-arch",
    "sec-ch-ua-bitness",
    "sec-ch-ua-model",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-user",
    "upgrade-insecure-requests",
    "priority",
    ":method",
    ":authority",
    ":scheme",
    ":path",
  ];

  var PRESETS = {
    essential: DEFAULT_BROWSER_HEADERS.concat([
      "accept-encoding",
      "accept-language",
      "connection",
      "host",
      "user-agent",
      "referer",
      "origin",
    ]),
    default: DEFAULT_BROWSER_HEADERS.slice(),
    "include-all": [],
  };

  var memoryStore = null;

  function hasChromeStorage() {
    return (
      typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync
    );
  }

  function getMemoryStore() {
    if (memoryStore === null) {
      memoryStore = DEFAULT_BROWSER_HEADERS.slice();
    }
    return memoryStore;
  }

  function setMemoryStore(list) {
    memoryStore = Array.isArray(list)
      ? list.slice()
      : DEFAULT_BROWSER_HEADERS.slice();
  }

  function getFilteredHeaders(callback) {
    if (typeof callback !== "function") return;

    if (hasChromeStorage()) {
      chrome.storage.sync.get(STORAGE_KEY, function (result) {
        var list = result[STORAGE_KEY];
        if (Array.isArray(list)) {
          callback(list);
        } else {
          callback(DEFAULT_BROWSER_HEADERS.slice());
        }
      });
    } else {
      callback(getMemoryStore().slice());
    }
  }

  function setFilteredHeaders(headerList, callback) {
    if (typeof callback !== "function") callback = function () {};

    var list = Array.isArray(headerList)
      ? headerList.slice()
      : DEFAULT_BROWSER_HEADERS.slice();

    if (hasChromeStorage()) {
      var obj = {};
      obj[STORAGE_KEY] = list;
      chrome.storage.sync.set(obj, callback);
    } else {
      setMemoryStore(list);
      callback();
    }
  }

  function addCustomHeader(headerName, callback) {
    if (typeof callback !== "function") callback = function () {};
    if (!headerName || typeof headerName !== "string") {
      callback();
      return;
    }

    var name = headerName.trim().toLowerCase();
    if (!name) {
      callback();
      return;
    }

    getFilteredHeaders(function (list) {
      if (list.indexOf(name) === -1) {
        list.push(name);
        setFilteredHeaders(list, callback);
      } else {
        callback();
      }
    });
  }

  function removeCustomHeader(headerName, callback) {
    if (typeof callback !== "function") callback = function () {};
    if (!headerName || typeof headerName !== "string") {
      callback();
      return;
    }

    var name = headerName.trim().toLowerCase();
    getFilteredHeaders(function (list) {
      var idx = list.indexOf(name);
      if (idx !== -1) {
        list.splice(idx, 1);
        setFilteredHeaders(list, callback);
      } else {
        callback();
      }
    });
  }

  function applyPreset(presetName, callback) {
    if (typeof callback !== "function") callback = function () {};

    var preset = PRESETS[presetName];
    if (!preset) {
      callback();
      return;
    }

    setFilteredHeaders(preset.slice(), callback);
  }

  function resetToDefault(callback) {
    if (typeof callback !== "function") callback = function () {};
    setFilteredHeaders(DEFAULT_BROWSER_HEADERS.slice(), callback);
  }

  function isFiltered(headerName, filteredHeaders) {
    if (!headerName || typeof headerName !== "string") return false;
    if (!Array.isArray(filteredHeaders)) return false;

    var nameLower = headerName.trim().toLowerCase();
    for (var i = 0; i < filteredHeaders.length; i++) {
      if (
        filteredHeaders[i] &&
        String(filteredHeaders[i]).toLowerCase() === nameLower
      ) {
        return true;
      }
    }
    return false;
  }

  global.HeaderFilter = {
    DEFAULT_BROWSER_HEADERS: DEFAULT_BROWSER_HEADERS,
    PRESETS: PRESETS,
    getFilteredHeaders: getFilteredHeaders,
    setFilteredHeaders: setFilteredHeaders,
    addCustomHeader: addCustomHeader,
    removeCustomHeader: removeCustomHeader,
    applyPreset: applyPreset,
    resetToDefault: resetToDefault,
    isFiltered: isFiltered,
  };
})(typeof window !== "undefined" ? window : this);
