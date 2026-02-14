/**
 * DevCurl Screen Scanner - Scan current page for route + API mapping
 * Detects Next.js (__NEXT_DATA__) or falls back to URL-only mode.
 * Stores scan results in chrome.storage.local.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "devcurl_screen_map";
  var VERSION = "2.0.0";

  // ─── Framework Detection & Route Extraction ───

  /**
   * Detect framework and extract route info from current page.
   * Returns promise-like callback with page info.
   */
  function detectPageInfo(callback) {
    if (
      typeof chrome === "undefined" ||
      !chrome.devtools ||
      !chrome.devtools.inspectedWindow
    ) {
      callback({
        route: null,
        url: window.location.pathname,
        params: null,
        framework: "unknown",
      });
      return;
    }

    var script =
      "(function() {" +
      "  var info = { url: location.pathname + location.search, framework: 'unknown', route: null, params: null };" +
      "  if (window.__NEXT_DATA__) {" +
      "    info.framework = 'nextjs';" +
      "    info.route = window.__NEXT_DATA__.page || null;" +
      "    info.params = window.__NEXT_DATA__.query || null;" +
      "  }" +
      "  return info;" +
      "})()";

    chrome.devtools.inspectedWindow.eval(script, function (result, error) {
      if (error || !result) {
        callback({
          route: null,
          url: "/",
          params: null,
          framework: "unknown",
        });
        return;
      }
      callback(result);
    });
  }

  // ─── Link Extraction ───

  /**
   * Extract internal links from the current page DOM.
   */
  function extractLinks(callback) {
    if (
      typeof chrome === "undefined" ||
      !chrome.devtools ||
      !chrome.devtools.inspectedWindow
    ) {
      callback([]);
      return;
    }

    var script =
      "(function() {" +
      "  var links = [];" +
      "  var seen = {};" +
      "  var origin = location.origin;" +
      "  var anchors = document.querySelectorAll('a[href]');" +
      "  for (var i = 0; i < anchors.length; i++) {" +
      "    try {" +
      "      var href = anchors[i].href;" +
      "      if (!href) continue;" +
      "      var url = new URL(href, origin);" +
      "      if (url.origin !== origin) continue;" +
      "      var path = url.pathname;" +
      "      if (path && !seen[path] && path !== location.pathname) {" +
      "        seen[path] = true;" +
      "        links.push(path);" +
      "      }" +
      "    } catch(e) {}" +
      "  }" +
      "  return links;" +
      "})()";

    chrome.devtools.inspectedWindow.eval(script, function (result, error) {
      if (error || !result) {
        callback([]);
        return;
      }
      callback(result);
    });
  }

  // ─── Schema Extraction ───

  /**
   * Extract type schema from a JSON value.
   * Returns structure like { name: "string", age: "number", posts: "array" }
   */
  function extractSchema(value) {
    if (value === null || value === undefined) return null;

    if (Array.isArray(value)) {
      if (value.length === 0) return "array(empty)";
      // Extract schema from first element
      var first = extractSchema(value[0]);
      return { _type: "array", _items: first };
    }

    if (typeof value === "object") {
      var schema = {};
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = value[k];
        if (v === null || v === undefined) {
          schema[k] = "null";
        } else if (Array.isArray(v)) {
          schema[k] = extractSchema(v);
        } else if (typeof v === "object") {
          schema[k] = extractSchema(v);
        } else {
          schema[k] = typeof v;
        }
      }
      return schema;
    }

    return typeof value;
  }

  /**
   * Try to parse JSON string and extract schema.
   */
  function parseAndExtractSchema(text) {
    if (!text || typeof text !== "string") return null;
    try {
      var parsed = JSON.parse(text);
      return extractSchema(parsed);
    } catch (e) {
      return null;
    }
  }

  // ─── HAR Collection ───

  var XHR_FETCH_TYPES = ["xhr", "fetch"];

  function isXhrOrFetch(entry) {
    var rt = entry._resourceType;
    if (!rt) return true;
    return XHR_FETCH_TYPES.indexOf(String(rt).toLowerCase()) !== -1;
  }

  /**
   * Collect API calls from HAR, extract schemas from responses.
   * Uses getContent() for response body.
   */
  function collectApis(callback) {
    if (
      typeof chrome === "undefined" ||
      !chrome.devtools ||
      !chrome.devtools.network
    ) {
      callback([]);
      return;
    }

    chrome.devtools.network.getHAR(function (harLog) {
      if (!harLog || !harLog.entries) {
        callback([]);
        return;
      }

      var xhrEntries = harLog.entries.filter(isXhrOrFetch);
      var apis = [];
      var pending = xhrEntries.length;

      if (pending === 0) {
        callback([]);
        return;
      }

      xhrEntries.forEach(function (entry) {
        var req = entry.request || {};
        var res = entry.response || {};

        var apiInfo = {
          method: req.method || "GET",
          path: getPathWithQuery(req.url || ""),
          fullUrl: req.url || "",
          status: res.status || 0,
          contentType: getContentType(res),
          time: Math.round(entry.time || 0),
          requestSchema: extractRequestSchema(req),
          responseSchema: null,
          harEntry: entry,
        };

        // Try to get response content
        if (typeof entry.getContent === "function") {
          entry.getContent(function (content) {
            apiInfo.responseSchema = parseAndExtractSchema(content);
            apis.push(apiInfo);
            pending--;
            if (pending === 0) callback(apis);
          });
        } else {
          // Fallback: try response body from HAR
          var body = res.content && res.content.text ? res.content.text : null;
          apiInfo.responseSchema = parseAndExtractSchema(body);
          apis.push(apiInfo);
          pending--;
          if (pending === 0) callback(apis);
        }
      });
    });
  }

  function getPathWithQuery(url) {
    try {
      var u = new URL(url);
      return u.pathname + u.search;
    } catch (e) {
      return url;
    }
  }

  function getContentType(response) {
    if (!response || !response.headers) return null;
    for (var i = 0; i < response.headers.length; i++) {
      if (response.headers[i].name.toLowerCase() === "content-type") {
        return response.headers[i].value.split(";")[0].trim();
      }
    }
    return null;
  }

  function extractRequestSchema(request) {
    if (!request || !request.postData || !request.postData.text) return null;
    var mimeType = (request.postData.mimeType || "").toLowerCase();
    if (mimeType.indexOf("json") !== -1) {
      return parseAndExtractSchema(request.postData.text);
    }
    return null;
  }

  // ─── Storage ───

  function getStorage(callback) {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(STORAGE_KEY, function (data) {
        var map = data[STORAGE_KEY] || { version: VERSION, pages: {} };
        callback(map);
      });
    } else {
      // Fallback: in-memory
      if (!window._devcurlScreenMap) {
        window._devcurlScreenMap = { version: VERSION, pages: {} };
      }
      callback(window._devcurlScreenMap);
    }
  }

  function saveStorage(map, callback) {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      var data = {};
      data[STORAGE_KEY] = map;
      chrome.storage.local.set(data, function () {
        if (callback) callback();
      });
    } else {
      window._devcurlScreenMap = map;
      if (callback) callback();
    }
  }

  // ─── Main Scan ───

  /**
   * Perform a full scan of the current page.
   * Callback receives the scan result for this page.
   */
  function scan(callback) {
    detectPageInfo(function (pageInfo) {
      collectApis(function (apis) {
        extractLinks(function (links) {
          // Build clean API list (without harEntry for storage)
          var cleanApis = apis.map(function (a) {
            return {
              method: a.method,
              path: a.path,
              fullUrl: a.fullUrl,
              status: a.status,
              contentType: a.contentType,
              time: a.time,
              requestSchema: a.requestSchema,
              responseSchema: a.responseSchema,
            };
          });

          var scanResult = {
            route: pageInfo.route,
            url: pageInfo.url,
            params: pageInfo.params,
            framework: pageInfo.framework,
            scannedAt: new Date().toISOString(),
            apis: cleanApis,
            links: links,
          };

          // Save to storage (overwrite same URL)
          getStorage(function (map) {
            map.pages[pageInfo.url] = scanResult;
            map.version = VERSION;
            saveStorage(map, function () {
              // Return both scan result and raw HAR entries (for curl generation)
              scanResult._harEntries = apis.map(function (a) {
                return a.harEntry;
              });
              callback(scanResult);
            });
          });
        });
      });
    });
  }

  // ─── Load All Scans ───

  function loadAllScans(callback) {
    getStorage(function (map) {
      callback(map);
    });
  }

  // ─── Clear All Scans ───

  function clearAllScans(callback) {
    var empty = { version: VERSION, pages: {} };
    saveStorage(empty, function () {
      if (callback) callback();
    });
  }

  // ─── Export ───

  function exportJson(callback) {
    getStorage(function (map) {
      var json = JSON.stringify(map, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var date = new Date().toISOString().slice(0, 10);
      var filename = "devcurl-screen-map-" + date + ".json";

      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (callback) callback(filename);
    });
  }

  // ─── Public API ───

  window.ScreenScanner = {
    scan: scan,
    loadAllScans: loadAllScans,
    clearAllScans: clearAllScans,
    exportJson: exportJson,
    extractSchema: extractSchema,
  };
})();
