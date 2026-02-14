/**
 * DevCurl Panel - Main DevTools panel logic
 * Request capture, filtering, multi-format code generation, response view
 * v2.0: Screen Map - page-to-API mapping with scan
 */
(function () {
  "use strict";

  var XHR_FETCH_TYPES = ["xhr", "fetch"];

  // State
  var state = {
    requests: [],
    selectedIndex: -1,
    urlSearch: "",
    methods: ["ALL"],
    statuses: ["ALL"],
    filteredHeaders: [],
    activeTab: "curl", // curl | fetch | axios | response
    selectedEntry: null,
    sortOrder: "newest", // newest | oldest
    // v2.0: Screen Map state
    activeView: "requests", // requests | screenmap
    screenMap: null,
    selectedPageUrl: null,
    pageSearch: "",
    scanHarEntries: {}, // url -> harEntry[] for curl generation
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function qs(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function qsAll(sel, ctx) {
    return (ctx || document).querySelectorAll(sel);
  }

  // Check if request is XHR or Fetch
  function isXhrOrFetch(entry) {
    var rt = entry._resourceType;
    if (!rt) return true;
    return XHR_FETCH_TYPES.indexOf(String(rt).toLowerCase()) !== -1;
  }

  // Extract pathname from URL
  function getPathname(url) {
    try {
      return new URL(url).pathname || url;
    } catch (e) {
      return url;
    }
  }

  // Debounce helper
  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
        timer = null;
      }, ms);
    };
  }

  // Get status class (2xx, 3xx, etc.)
  function getStatusClass(statusCode) {
    if (!statusCode) return "other";
    var n = parseInt(statusCode, 10);
    if (n >= 200 && n < 300) return "2xx";
    if (n >= 300 && n < 400) return "3xx";
    if (n >= 400 && n < 500) return "4xx";
    if (n >= 500) return "5xx";
    return "other";
  }

  // Get method class
  function getMethodClass(method) {
    var m = (method || "GET").toUpperCase();
    var map = {
      GET: "get",
      POST: "post",
      PUT: "put",
      DELETE: "delete",
      PATCH: "patch",
    };
    return map[m] || "other";
  }

  function escapeHtml(str) {
    if (str == null) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════
  // TOP NAVIGATION - View Switching
  // ═══════════════════════════════════════════════

  function initTopNav() {
    qsAll(".top-nav-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var view = tab.getAttribute("data-view");
        if (!view) return;
        switchView(view);
      });
    });
  }

  function switchView(viewName) {
    state.activeView = viewName;

    // Update tab active state
    qsAll(".top-nav-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === viewName);
    });

    // Show/hide views
    var requestsView = getEl("requestsView");
    var screenmapView = getEl("screenmapView");

    if (requestsView) {
      requestsView.classList.toggle("hidden", viewName !== "requests");
    }
    if (screenmapView) {
      screenmapView.classList.toggle("hidden", viewName !== "screenmap");
    }

    // Load screen map data when switching to that view
    if (viewName === "screenmap") {
      loadScreenMap();
    }
  }

  // ═══════════════════════════════════════════════
  // REQUESTS VIEW (기존 v1.x 기능)
  // ═══════════════════════════════════════════════

  // Filter requests based on state
  function getFilteredRequests() {
    var url = state.urlSearch.trim().toLowerCase();
    var methods = state.methods;
    var statuses = state.statuses;
    var allMethods = methods.indexOf("ALL") !== -1;
    var allStatuses = statuses.indexOf("ALL") !== -1;

    var filtered = state.requests.filter(function (entry) {
      var req = entry.request || {};
      var res = entry.response || {};
      var path = getPathname(req.url || "");
      var method = (req.method || "GET").toUpperCase();
      var status = res.status || 0;
      var statusClass = getStatusClass(status);

      if (url && path.toLowerCase().indexOf(url) === -1) return false;
      if (!allMethods && methods.indexOf(method) === -1) return false;
      if (!allStatuses && statuses.indexOf(statusClass) === -1) return false;
      return true;
    });

    // Sort: newest first reverses the array (requests are appended in order)
    if (state.sortOrder === "newest") {
      filtered = filtered.slice().reverse();
    }

    return filtered;
  }

  // Render request list
  function renderRequestList() {
    var list = getEl("requestList");
    if (!list) return;

    var filtered = getFilteredRequests();
    list.innerHTML = "";

    filtered.forEach(function (entry, idx) {
      var req = entry.request || {};
      var res = entry.response || {};
      var method = req.method || "GET";
      var path = getPathname(req.url || "");
      var status = res.status || "—";
      var methodClass = getMethodClass(method);
      var statusClass = getStatusClass(status);

      var li = document.createElement("li");
      li.className =
        "request-item" + (state.selectedIndex === idx ? " selected" : "");
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(idx));
      li.innerHTML =
        '<span class="method-badge ' +
        methodClass +
        '">' +
        escapeHtml(method) +
        "</span>" +
        '<span class="request-path" title="' +
        escapeHtml(path) +
        '">' +
        escapeHtml(path || "/") +
        "</span>" +
        '<span class="request-status status-' +
        statusClass +
        '">' +
        escapeHtml(String(status)) +
        "</span>";
      li.addEventListener("click", function () {
        selectRequest(parseInt(li.getAttribute("data-index"), 10));
      });
      list.appendChild(li);
    });
  }

  // Select request and update detail view
  function selectRequest(index) {
    var filtered = getFilteredRequests();
    if (index < 0 || index >= filtered.length) {
      state.selectedIndex = -1;
      state.selectedEntry = null;
      showEmptyState();
      return;
    }
    state.selectedIndex = index;
    state.selectedEntry = filtered[index];
    renderRequestList();
    renderDetail(state.selectedEntry);
  }

  function showEmptyState() {
    var empty = getEl("emptyState");
    var content = getEl("detailContent");
    if (empty) empty.classList.remove("hidden");
    if (content) content.classList.add("hidden");
  }

  function hideEmptyState() {
    var empty = getEl("emptyState");
    var content = getEl("detailContent");
    if (empty) empty.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  }

  // ─── Syntax Highlighting ───

  function highlightCurl(text) {
    var escaped = escapeHtml(text);
    return escaped
      .replace(/\bcurl\b/g, '<span class="syn-keyword">curl</span>')
      .replace(/(-[XHdbF])(?=\s|$)/g, function (m) {
        return '<span class="syn-flag">' + m + "</span>";
      })
      .replace(/'(https?:\/\/[^']*)'/g, function (m, url) {
        return '\'<span class="syn-url">' + url + "</span>'";
      });
  }

  function highlightJs(text) {
    var escaped = escapeHtml(text);
    return escaped
      .replace(
        /\b(const|let|var|await|async|new|return|function|import|from|true|false|null)\b/g,
        '<span class="syn-keyword">$1</span>',
      )
      .replace(
        /'([^'\\]*(\\.[^'\\]*)*)'/g,
        "'<span class=\"syn-string\">$1</span>'",
      )
      .replace(
        /\b(fetch|axios|JSON|FormData|response|data|formData)\b/g,
        '<span class="syn-builtin">$1</span>',
      )
      .replace(
        /\.(stringify|get|post|put|patch|delete|append|json)\b/g,
        '.<span class="syn-method">$1</span>',
      )
      .replace(
        /(\s+)(method|headers|body|params)(\s*:)/g,
        '$1<span class="syn-key">$2</span>$3',
      )
      .replace(/(\/\/.*)/g, '<span class="syn-comment">$1</span>');
  }

  function highlightJson(text) {
    var escaped = escapeHtml(text);
    return escaped
      .replace(
        /&quot;([^&]*?)&quot;\s*:/g,
        '&quot;<span class="syn-key">$1</span>&quot;:',
      )
      .replace(
        /:\s*&quot;([^&]*?)&quot;/g,
        ': &quot;<span class="syn-string">$1</span>&quot;',
      )
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="syn-number">$1</span>')
      .replace(
        /:\s*(true|false|null)\b/g,
        ': <span class="syn-keyword">$1</span>',
      );
  }

  // ─── Detail Rendering ───

  function renderDetail(entry) {
    hideEmptyState();

    if (!window.CurlGenerator || !window.HeaderFilter) {
      var codeEl = getEl("codeOutput");
      if (codeEl) codeEl.innerHTML = "Libraries not loaded.";
      return;
    }

    var summary = window.CurlGenerator.extractResponseSummary(entry);
    var statusClass = getStatusClass(summary.statusCode);

    var statusDot = getEl("statusDot");
    var statusCode = getEl("statusCode");
    var statusText = getEl("statusText");
    var contentType = getEl("contentType");
    var responseTime = getEl("responseTime");

    if (statusDot) {
      statusDot.className = "status-dot status-" + statusClass;
    }
    if (statusCode) {
      statusCode.textContent = summary.statusCode || "—";
      statusCode.className = "status-code status-" + statusClass;
    }
    if (statusText) statusText.textContent = summary.statusText || "—";
    if (contentType) contentType.textContent = summary.contentType || "—";
    if (responseTime)
      responseTime.textContent =
        summary.responseTime >= 0 ? summary.responseTime + "ms" : "—";

    renderActiveTab(entry);
  }

  function renderActiveTab(entry) {
    if (!entry) return;

    var codePanel = getEl("codePanel");
    var responsePanel = getEl("responsePanel");

    if (state.activeTab === "response") {
      if (codePanel) codePanel.classList.add("hidden");
      if (responsePanel) responsePanel.classList.remove("hidden");
      renderResponseTab(entry);
    } else {
      if (codePanel) codePanel.classList.remove("hidden");
      if (responsePanel) responsePanel.classList.add("hidden");
      renderCodeTab(entry, state.activeTab);
    }
  }

  function renderCodeTab(entry, format) {
    window.HeaderFilter.getFilteredHeaders(function (filtered) {
      state.filteredHeaders = filtered;
      var code = "";
      var highlighted = "";

      switch (format) {
        case "curl":
          code = window.CurlGenerator.generateCurl(entry, filtered);
          highlighted = highlightCurl(code);
          break;
        case "fetch":
          if (window.CodeGenerator) {
            code = window.CodeGenerator.generateFetch(entry, filtered);
          }
          highlighted = highlightJs(code);
          break;
        case "axios":
          if (window.CodeGenerator) {
            code = window.CodeGenerator.generateAxios(entry, filtered);
          }
          highlighted = highlightJs(code);
          break;
        default:
          code = window.CurlGenerator.generateCurl(entry, filtered);
          highlighted = highlightCurl(code);
      }

      var codeEl = getEl("codeOutput");
      if (codeEl) {
        codeEl.innerHTML = highlighted;
      }
    });
  }

  function renderResponseTab(entry) {
    if (!window.CodeGenerator) return;

    var resp = window.CodeGenerator.extractResponse(entry);

    var headersBody = getEl("responseHeadersBody");
    var headerCount = getEl("headerCount");

    if (headersBody) {
      headersBody.innerHTML = "";
      resp.headers.forEach(function (h) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="header-name">' +
          escapeHtml(h.name) +
          "</td>" +
          '<td class="header-value">' +
          escapeHtml(h.value) +
          "</td>";
        headersBody.appendChild(tr);
      });
    }

    if (headerCount) {
      headerCount.textContent = resp.headers.length;
    }

    var bodyEl = getEl("responseBody");
    if (bodyEl) {
      if (resp.bodyParsed) {
        var prettyJson = JSON.stringify(resp.bodyParsed, null, 2);
        bodyEl.innerHTML = highlightJson(prettyJson);
      } else if (resp.body) {
        bodyEl.textContent = resp.body;
      } else {
        bodyEl.innerHTML =
          '<span class="syn-comment">// No response body</span>';
      }
    }
  }

  // ─── Tab Management ───

  function initTabs() {
    qsAll(".detail-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var tabName = tab.getAttribute("data-tab");
        if (!tabName) return;

        state.activeTab = tabName;
        qsAll(".detail-tab").forEach(function (t) {
          t.classList.toggle("active", t.getAttribute("data-tab") === tabName);
        });

        if (state.selectedEntry) {
          renderActiveTab(state.selectedEntry);
        }
      });
    });
  }

  // ─── Response Headers Toggle ───

  function initResponseHeadersToggle() {
    var toggle = getEl("responseHeadersToggle");
    var headers = getEl("responseHeaders");
    if (toggle && headers) {
      toggle.addEventListener("click", function () {
        var isCollapsed = headers.classList.contains("collapsed");
        headers.classList.toggle("collapsed");
        var icon = toggle.querySelector(".toggle-icon");
        if (icon) {
          icon.textContent = isCollapsed ? "▼" : "▶";
        }
      });
    }
  }

  // ─── Copy to Clipboard ───

  function copyCode() {
    var codeEl = getEl("codeOutput");
    if (!codeEl) return;
    var text = codeEl.textContent || codeEl.innerText;
    if (!text) return;
    var btn = getEl("copyBtn");
    performCopy(text, btn);
  }

  function copyResponse() {
    var bodyEl = getEl("responseBody");
    if (!bodyEl) return;
    var text = bodyEl.textContent || bodyEl.innerText;
    if (!text) return;
    var btn = getEl("copyResponseBtn");
    performCopy(text, btn);
  }

  function performCopy(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          showCopiedFeedback(btn);
        })
        .catch(function () {
          fallbackCopy(text, btn);
        });
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showCopiedFeedback(btn);
    } catch (e) {
      if (btn) btn.textContent = "Copy failed";
      setTimeout(function () {
        if (btn) btn.textContent = "Copy";
      }, 1500);
    }
    document.body.removeChild(ta);
  }

  function showCopiedFeedback(btn) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(function () {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1500);
  }

  // ─── Request Management ───

  function addRequest(entry) {
    if (!entry || !entry.request) return;
    if (!isXhrOrFetch(entry)) return;
    state.requests.push(entry);
    renderRequestList();
  }

  function clearRequests() {
    state.requests = [];
    state.selectedIndex = -1;
    state.selectedEntry = null;
    renderRequestList();
    showEmptyState();
  }

  // ─── Filter Handlers ───

  function initFilters() {
    var urlInput = getEl("urlSearch");
    if (urlInput) {
      urlInput.addEventListener(
        "input",
        debounce(function () {
          state.urlSearch = urlInput.value;
          renderRequestList();
          if (state.selectedIndex >= 0) {
            var filtered = getFilteredRequests();
            if (state.selectedIndex < filtered.length) {
              renderDetail(filtered[state.selectedIndex]);
            } else {
              showEmptyState();
            }
          }
        }, 300),
      );
    }

    // Method filters
    qsAll("#methodFilters .filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var method = btn.getAttribute("data-method");
        if (method === "ALL") {
          state.methods = ["ALL"];
          qsAll("#methodFilters .filter-btn").forEach(function (b) {
            b.classList.toggle(
              "active",
              b.getAttribute("data-method") === "ALL",
            );
          });
        } else {
          state.methods = state.methods.filter(function (m) {
            return m !== "ALL";
          });
          if (state.methods.indexOf(method) !== -1) {
            state.methods = state.methods.filter(function (m) {
              return m !== method;
            });
          } else {
            state.methods.push(method);
          }
          if (state.methods.length === 0) state.methods = ["ALL"];
          qsAll("#methodFilters .filter-btn").forEach(function (b) {
            var m = b.getAttribute("data-method");
            b.classList.toggle(
              "active",
              m === "ALL"
                ? state.methods.indexOf("ALL") !== -1
                : state.methods.indexOf(m) !== -1,
            );
          });
        }
        renderRequestList();
        updateDetailIfSelected();
      });
    });

    // Status filters
    qsAll("#statusFilters .filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var status = btn.getAttribute("data-status");
        if (status === "ALL") {
          state.statuses = ["ALL"];
          qsAll("#statusFilters .filter-btn").forEach(function (b) {
            b.classList.toggle(
              "active",
              b.getAttribute("data-status") === "ALL",
            );
          });
        } else {
          state.statuses = state.statuses.filter(function (s) {
            return s !== "ALL";
          });
          if (state.statuses.indexOf(status) !== -1) {
            state.statuses = state.statuses.filter(function (s) {
              return s !== status;
            });
          } else {
            state.statuses.push(status);
          }
          if (state.statuses.length === 0) state.statuses = ["ALL"];
          qsAll("#statusFilters .filter-btn").forEach(function (b) {
            var s = b.getAttribute("data-status");
            b.classList.toggle(
              "active",
              s === "ALL"
                ? state.statuses.indexOf("ALL") !== -1
                : state.statuses.indexOf(s) !== -1,
            );
          });
        }
        renderRequestList();
        updateDetailIfSelected();
      });
    });

    // Sort buttons
    qsAll(".sort-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sort = btn.getAttribute("data-sort");
        if (!sort || sort === state.sortOrder) return;
        state.sortOrder = sort;
        qsAll(".sort-btn").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-sort") === sort);
        });
        state.selectedIndex = -1;
        state.selectedEntry = null;
        renderRequestList();
        showEmptyState();
      });
    });
  }

  function updateDetailIfSelected() {
    if (state.selectedIndex < 0) return;
    var filtered = getFilteredRequests();
    if (state.selectedIndex < filtered.length) {
      state.selectedEntry = filtered[state.selectedIndex];
      renderDetail(state.selectedEntry);
    } else {
      showEmptyState();
    }
  }

  // ─── Settings Overlay ───

  var settingsOverlay = null;
  var settingsMessageHandler = null;

  function showSettingsOverlay() {
    if (settingsOverlay) return;

    var overlay = document.createElement("div");
    overlay.id = "devcurl-settings-overlay";
    overlay.className = "settings-overlay";
    var settingsUrl =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("settings/settings.html")
        : "../settings/settings.html";
    overlay.innerHTML =
      '<div class="settings-overlay-backdrop"></div>' +
      '<div class="settings-overlay-frame">' +
      '<iframe src="' +
      settingsUrl +
      '" title="헤더 필터 설정"></iframe>' +
      "</div>";

    overlay
      .querySelector(".settings-overlay-backdrop")
      .addEventListener("click", closeSettingsOverlay);

    overlay._escHandler = function (e) {
      if (e.key === "Escape") closeSettingsOverlay();
    };
    document.addEventListener("keydown", overlay._escHandler);

    settingsMessageHandler = function (e) {
      if (e.type === "devcurl-settings-closed") {
        closeSettingsOverlay();
      } else if (e.type === "devcurl-settings-changed") {
        updateDetailIfSelected();
      }
    };

    window.addEventListener("devcurl-settings-closed", settingsMessageHandler);
    window.addEventListener("devcurl-settings-changed", settingsMessageHandler);

    document.body.appendChild(overlay);
    settingsOverlay = overlay;
  }

  function closeSettingsOverlay() {
    if (!settingsOverlay) return;
    window.removeEventListener(
      "devcurl-settings-closed",
      settingsMessageHandler,
    );
    window.removeEventListener(
      "devcurl-settings-changed",
      settingsMessageHandler,
    );
    if (settingsOverlay._escHandler) {
      document.removeEventListener("keydown", settingsOverlay._escHandler);
    }
    settingsMessageHandler = null;
    settingsOverlay.remove();
    settingsOverlay = null;
  }

  // ─── Bottom Actions ───

  function initActions() {
    var clearBtn = getEl("clearBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearRequests);

    var settingsBtn = getEl("settingsBtn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", showSettingsOverlay);
    }

    var copyBtn = getEl("copyBtn");
    if (copyBtn) copyBtn.addEventListener("click", copyCode);

    var copyResponseBtn = getEl("copyResponseBtn");
    if (copyResponseBtn)
      copyResponseBtn.addEventListener("click", copyResponse);
  }

  // ─── Compact Mode ───

  function initCompactMode() {
    var leftPanel = document.querySelector(".left-panel");
    var toggle = getEl("panelToggle");
    var container = document.querySelector(".panel-container");

    function checkWidth() {
      var w = window.innerWidth;
      if (w < 600) {
        if (toggle) toggle.classList.remove("hidden");
        if (container) container.classList.add("compact");
      } else {
        if (toggle) toggle.classList.add("hidden");
        if (container) container.classList.remove("compact");
        if (leftPanel) leftPanel.classList.remove("collapsed");
        if (toggle) toggle.classList.remove("collapsed");
      }
    }

    if (toggle && leftPanel) {
      toggle.addEventListener("click", function () {
        leftPanel.classList.toggle("collapsed");
        toggle.classList.toggle("collapsed");
      });
    }

    window.addEventListener("resize", debounce(checkWidth, 100));
    checkWidth();
  }

  // ─── Chrome DevTools Network Capture ───

  function initNetworkCapture() {
    if (
      typeof chrome === "undefined" ||
      !chrome.devtools ||
      !chrome.devtools.network
    ) {
      return;
    }

    chrome.devtools.network.onRequestFinished.addListener(function (request) {
      addRequest(request);
    });

    chrome.devtools.network.getHAR(function (harLog) {
      if (!harLog || !harLog.entries) return;
      harLog.entries.forEach(function (entry) {
        addRequest(entry);
      });
    });
  }

  // ═══════════════════════════════════════════════
  // SCREEN MAP VIEW (v2.0)
  // ═══════════════════════════════════════════════

  // ─── Scan Button ───

  function initScanButton() {
    var scanBtn = getEl("scanBtn");
    if (!scanBtn) return;

    scanBtn.addEventListener("click", function () {
      if (!window.ScreenScanner) return;

      // Visual feedback: scanning
      scanBtn.classList.add("scanning");
      scanBtn.innerHTML = '<span class="scan-icon">⊙</span> Scanning...';

      window.ScreenScanner.scan(function (result) {
        // Store HAR entries for curl generation
        if (result._harEntries) {
          state.scanHarEntries[result.url] = result._harEntries;
        }

        // Done: restore button
        scanBtn.classList.remove("scanning");
        scanBtn.innerHTML = '<span class="scan-icon">⊙</span> Scan';

        // Switch to screen map view and show result
        switchView("screenmap");
        loadScreenMap(function () {
          selectPage(result.url);
        });
      });
    });
  }

  // ─── Screen Map Data Loading ───

  function loadScreenMap(callback) {
    if (!window.ScreenScanner) {
      if (callback) callback();
      return;
    }

    window.ScreenScanner.loadAllScans(function (map) {
      state.screenMap = map;
      renderPageList();
      updateScreenMapEmptyState();
      if (callback) callback();
    });
  }

  function updateScreenMapEmptyState() {
    var emptyEl = getEl("screenMapEmpty");
    var detailEl = getEl("screenMapDetail");
    var hasPages =
      state.screenMap &&
      state.screenMap.pages &&
      Object.keys(state.screenMap.pages).length > 0;

    if (hasPages && state.selectedPageUrl) {
      if (emptyEl) emptyEl.classList.add("hidden");
      if (detailEl) detailEl.classList.remove("hidden");
    } else if (hasPages && !state.selectedPageUrl) {
      if (emptyEl) emptyEl.classList.add("hidden");
      if (detailEl) detailEl.classList.add("hidden");
    } else {
      if (emptyEl) emptyEl.classList.remove("hidden");
      if (detailEl) detailEl.classList.add("hidden");
    }
  }

  // ─── Page List Rendering ───

  function getFilteredPages() {
    if (!state.screenMap || !state.screenMap.pages)
      return { scanned: [], unscanned: [] };

    var pages = state.screenMap.pages;
    var search = state.pageSearch.trim().toLowerCase();
    var scanned = [];
    var unscannedMap = {};

    var urls = Object.keys(pages);
    urls.forEach(function (url) {
      var page = pages[url];
      if (search && url.toLowerCase().indexOf(search) === -1) return;
      scanned.push(page);

      // Collect unscanned linked pages
      if (page.links) {
        page.links.forEach(function (link) {
          if (!pages[link] && !unscannedMap[link]) {
            if (!search || link.toLowerCase().indexOf(search) !== -1) {
              unscannedMap[link] = true;
            }
          }
        });
      }
    });

    // Sort by scannedAt descending
    scanned.sort(function (a, b) {
      return (b.scannedAt || "").localeCompare(a.scannedAt || "");
    });

    return {
      scanned: scanned,
      unscanned: Object.keys(unscannedMap),
    };
  }

  function renderPageList() {
    var list = getEl("pageList");
    if (!list) return;
    list.innerHTML = "";

    var filtered = getFilteredPages();

    // Scanned pages
    filtered.scanned.forEach(function (page) {
      var li = document.createElement("li");
      var isSelected = state.selectedPageUrl === page.url;
      li.className =
        "request-item sm-page-item" + (isSelected ? " selected" : "");
      li.setAttribute("role", "option");

      var displayName = page.route || page.url;
      var apiCount = page.apis ? page.apis.length : 0;
      var timeAgo = getTimeAgo(page.scannedAt);

      li.innerHTML =
        '<div class="sm-page-row">' +
        '<span class="sm-scan-status scanned">✅</span>' +
        '<div class="sm-page-info-col">' +
        '<span class="sm-page-name" title="' +
        escapeHtml(displayName) +
        '">' +
        escapeHtml(displayName) +
        "</span>" +
        (page.route && page.url !== page.route
          ? '<span class="sm-page-url">' + escapeHtml(page.url) + "</span>"
          : "") +
        '<span class="sm-page-meta">' +
        escapeHtml(timeAgo) +
        " · API " +
        apiCount +
        "개</span>" +
        "</div>" +
        "</div>";

      li.addEventListener("click", function () {
        selectPage(page.url);
      });
      list.appendChild(li);
    });

    // Unscanned pages
    filtered.unscanned.forEach(function (url) {
      var li = document.createElement("li");
      li.className = "request-item sm-page-item unscanned";
      li.setAttribute("role", "option");

      li.innerHTML =
        '<div class="sm-page-row">' +
        '<span class="sm-scan-status">⬜</span>' +
        '<div class="sm-page-info-col">' +
        '<span class="sm-page-name">' +
        escapeHtml(url) +
        "</span>" +
        '<span class="sm-page-meta">(스캔 안 됨)</span>' +
        "</div>" +
        "</div>";

      list.appendChild(li);
    });
  }

  function getTimeAgo(isoString) {
    if (!isoString) return "";
    var diff = Date.now() - new Date(isoString).getTime();
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return sec + "초 전";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + "분 전";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + "시간 전";
    var day = Math.floor(hr / 24);
    return day + "일 전";
  }

  // ─── Page Selection & Detail ───

  function selectPage(url) {
    state.selectedPageUrl = url;
    renderPageList();
    renderPageDetail(url);
  }

  function renderPageDetail(url) {
    if (
      !state.screenMap ||
      !state.screenMap.pages ||
      !state.screenMap.pages[url]
    ) {
      updateScreenMapEmptyState();
      return;
    }

    var page = state.screenMap.pages[url];

    var emptyEl = getEl("screenMapEmpty");
    var detailEl = getEl("screenMapDetail");
    if (emptyEl) emptyEl.classList.add("hidden");
    if (detailEl) detailEl.classList.remove("hidden");

    // Page info
    var smRoute = getEl("smRoute");
    var smUrl = getEl("smUrl");
    var smFramework = getEl("smFramework");
    var smScannedAt = getEl("smScannedAt");

    if (smRoute) smRoute.textContent = page.route || "(감지 불가)";
    if (smUrl) smUrl.textContent = page.url || "—";
    if (smFramework) {
      smFramework.textContent = page.framework || "unknown";
      smFramework.className = "sm-value sm-fw-" + (page.framework || "unknown");
    }
    if (smScannedAt) smScannedAt.textContent = formatDate(page.scannedAt);

    // API list
    var apiListEl = getEl("smApiList");
    var apiCountEl = getEl("smApiCount");
    var apis = page.apis || [];

    if (apiCountEl) apiCountEl.textContent = apis.length;
    if (apiListEl) {
      apiListEl.innerHTML = "";

      if (apis.length === 0) {
        apiListEl.innerHTML = '<div class="sm-no-data">API 호출 없음</div>';
      } else {
        apis.forEach(function (api, idx) {
          var card = document.createElement("div");
          card.className = "sm-api-card";

          var methodClass = getMethodClass(api.method);
          var statusClass = getStatusClass(api.status);

          var schemaHtml = "";
          if (api.requestSchema) {
            schemaHtml +=
              '<div class="sm-schema-row">' +
              '<span class="sm-schema-label">Request:</span>' +
              '<span class="sm-schema-value">' +
              escapeHtml(formatSchema(api.requestSchema)) +
              "</span>" +
              "</div>";
          }
          if (api.responseSchema) {
            schemaHtml +=
              '<div class="sm-schema-row">' +
              '<span class="sm-schema-label">Response:</span>' +
              '<span class="sm-schema-value">' +
              escapeHtml(formatSchema(api.responseSchema)) +
              "</span>" +
              "</div>";
          }
          if (!api.requestSchema && !api.responseSchema) {
            schemaHtml =
              '<div class="sm-schema-row"><span class="sm-schema-label">(스키마 없음)</span></div>';
          }

          card.innerHTML =
            '<div class="sm-api-header">' +
            '<span class="method-badge ' +
            methodClass +
            '">' +
            escapeHtml(api.method) +
            "</span>" +
            '<span class="sm-api-path" title="' +
            escapeHtml(api.path) +
            '">' +
            escapeHtml(api.path) +
            "</span>" +
            '<span class="request-status status-' +
            statusClass +
            '">' +
            escapeHtml(String(api.status)) +
            "</span>" +
            '<span class="sm-api-time">' +
            (api.time || 0) +
            "ms</span>" +
            '<button class="sm-curl-btn" data-api-index="' +
            idx +
            '" title="curl 복사">curl 📋</button>' +
            "</div>" +
            '<div class="sm-api-body">' +
            schemaHtml +
            "</div>";

          // Curl copy button
          var curlBtn = card.querySelector(".sm-curl-btn");
          if (curlBtn) {
            curlBtn.addEventListener("click", function (e) {
              e.stopPropagation();
              copyCurlForApi(url, idx);
            });
          }

          apiListEl.appendChild(card);
        });
      }
    }

    // Linked pages
    var linkListEl = getEl("smLinkList");
    var linkCountEl = getEl("smLinkCount");
    var links = page.links || [];

    if (linkCountEl) linkCountEl.textContent = links.length;
    if (linkListEl) {
      linkListEl.innerHTML = "";

      if (links.length === 0) {
        linkListEl.innerHTML =
          '<div class="sm-no-data">연결된 페이지 없음</div>';
      } else {
        links.forEach(function (link) {
          var div = document.createElement("div");
          div.className = "sm-link-item";
          var isScanned = state.screenMap.pages && state.screenMap.pages[link];
          div.innerHTML =
            '<span class="sm-link-status">' +
            (isScanned ? "✅" : "⬜") +
            "</span>" +
            '<span class="sm-link-path">' +
            escapeHtml(link) +
            "</span>" +
            '<span class="sm-link-label">' +
            (isScanned ? "스캔 완료" : "스캔 안 됨") +
            "</span>";

          if (isScanned) {
            div.style.cursor = "pointer";
            div.addEventListener("click", function () {
              selectPage(link);
            });
          }
          linkListEl.appendChild(div);
        });
      }
    }
  }

  function formatSchema(schema) {
    if (typeof schema === "string") return schema;
    if (!schema) return "null";

    if (schema._type === "array") {
      return "[" + formatSchema(schema._items) + "]";
    }

    if (typeof schema === "object") {
      var keys = Object.keys(schema);
      var parts = keys.map(function (k) {
        var val = schema[k];
        if (typeof val === "string") return k + ": " + val;
        if (val && val._type === "array") return k + ": " + formatSchema(val);
        if (typeof val === "object") return k + ": {...}";
        return k + ": " + String(val);
      });
      return "{ " + parts.join(", ") + " }";
    }

    return String(schema);
  }

  function formatDate(isoString) {
    if (!isoString) return "—";
    try {
      var d = new Date(isoString);
      return (
        d.getFullYear() +
        "-" +
        pad(d.getMonth() + 1) +
        "-" +
        pad(d.getDate()) +
        " " +
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes()) +
        ":" +
        pad(d.getSeconds())
      );
    } catch (e) {
      return isoString;
    }
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  // ─── Curl Copy from Screen Map ───

  function copyCurlForApi(pageUrl, apiIndex) {
    // Try to get HAR entry from current session
    var harEntries = state.scanHarEntries[pageUrl];
    if (harEntries && harEntries[apiIndex]) {
      window.HeaderFilter.getFilteredHeaders(function (filtered) {
        var curl = window.CurlGenerator.generateCurl(
          harEntries[apiIndex],
          filtered,
        );
        performCopy(curl, null);

        // Show feedback on the button
        var btns = qsAll('.sm-curl-btn[data-api-index="' + apiIndex + '"]');
        if (btns.length > 0) {
          var btn = btns[0];
          var orig = btn.textContent;
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(function () {
            btn.textContent = orig;
            btn.classList.remove("copied");
          }, 1500);
        }
      });
    } else {
      // No HAR entry available (loaded from storage), generate basic curl
      var page = state.screenMap && state.screenMap.pages[pageUrl];
      if (!page || !page.apis || !page.apis[apiIndex]) return;
      var api = page.apis[apiIndex];
      var basicCurl = "curl '" + api.fullUrl + "'";
      if (api.method !== "GET") {
        basicCurl += " \\\n  -X " + api.method;
      }
      performCopy(basicCurl, null);

      var btns = qsAll('.sm-curl-btn[data-api-index="' + apiIndex + '"]');
      if (btns.length > 0) {
        var btn = btns[0];
        var orig = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = orig;
          btn.classList.remove("copied");
        }, 1500);
      }
    }
  }

  // ─── Screen Map Actions ───

  function initScreenMapActions() {
    var clearScansBtn = getEl("clearScansBtn");
    if (clearScansBtn) {
      clearScansBtn.addEventListener("click", function () {
        if (!window.ScreenScanner) return;
        window.ScreenScanner.clearAllScans(function () {
          state.screenMap = { version: "2.0.0", pages: {} };
          state.selectedPageUrl = null;
          state.scanHarEntries = {};
          renderPageList();
          updateScreenMapEmptyState();
        });
      });
    }

    var exportBtn = getEl("exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (!window.ScreenScanner) return;
        window.ScreenScanner.exportJson(function (filename) {
          var orig = exportBtn.textContent;
          exportBtn.textContent = "✓ " + filename;
          setTimeout(function () {
            exportBtn.textContent = orig;
          }, 2000);
        });
      });
    }

    // Page search
    var pageSearchInput = getEl("pageSearch");
    if (pageSearchInput) {
      pageSearchInput.addEventListener(
        "input",
        debounce(function () {
          state.pageSearch = pageSearchInput.value;
          renderPageList();
        }, 300),
      );
    }
  }

  // ═══════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════

  function init() {
    // Top navigation
    initTopNav();

    // Requests view (v1.x)
    initFilters();
    initTabs();
    initActions();
    initResponseHeadersToggle();
    initCompactMode();
    initNetworkCapture();
    renderRequestList();
    showEmptyState();

    // Screen Map view (v2.0)
    initScanButton();
    initScreenMapActions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
